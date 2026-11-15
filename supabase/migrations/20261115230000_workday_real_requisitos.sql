-- Workday en tiempo real: los minutos y la nómina cuentan por día real (Monterrey), no por día del juego.
create or replace function real_day() returns date language sql stable as $$ select (now() at time zone 'America/Monterrey')::date $$;
update employments set last_qualified = real_day() where status <> 'fired';
insert into settings values('last_rday', to_jsonb((real_day() - 1)::text)) on conflict(key) do nothing;

create or replace function pay_day(day date, uid uuid default null) returns int language plpgsql security definer set search_path=public as $$
declare g uuid := gov_acc(); e record; acc record; mins numeric; a uuid; n int := 0;
        minm numeric := coalesce((select (value#>>'{}')::numeric from settings where key='job_min_minutes'),40);
        smin numeric := coalesce((select (value#>>'{}')::numeric from settings where key='staff_min_minutes'),30);
begin
  for e in select em.*, r.salary from employments em join dept_ranks r on r.dept=em.dept and r.rank=em.rank
           join characters c on c.id=em.character_id where em.status<>'fired' and c.status='active' and (uid is null or c.user_id = uid) loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),((day+1)::timestamp at time zone 'America/Monterrey')) - greatest(started_at,(day::timestamp at time zone 'America/Monterrey')))/60),0)
      into mins from work_shifts where character_id=e.character_id and dept=e.dept and started_at < ((day+1)::timestamp at time zone 'America/Monterrey') and coalesce(ended_at,now()) > (day::timestamp at time zone 'America/Monterrey');
    if e.status='vacation' or mins >= minm then
      update employments set last_qualified=greatest(last_qualified, day) where id=e.id;
      a := personal_acc(e.character_id);
      if a is not null then
        insert into pay_log(kind, ref, day) values('job', e.id, day) on conflict do nothing;
        if found then
          begin perform move_money(coalesce(dept_acc(e.dept), g), a, round((e.salary*cpi() - income_tax(e.salary*cpi()))/365,2), 'Nómina neta · '||e.dept||' · '||e.rank||' (ya con retención de impuestos)'); n := n+1;
          exception when others then delete from pay_log where kind='job' and ref=e.id and pay_log.day=pay_day.day; end;
        end if;
      end if;
    end if;
  end loop;
  -- staff: sueldo anual ÷ 365 si estuvo en servicio el mínimo del día (a su primera vida activa)
  for acc in select p.id, p.staff_role from profiles p where p.staff_role is not null and (uid is null or p.id = uid) loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),((day+1)::timestamp at time zone 'America/Monterrey')) - greatest(started_at,(day::timestamp at time zone 'America/Monterrey')))/60),0)
      into mins from shifts where user_id=acc.id and started_at < ((day+1)::timestamp at time zone 'America/Monterrey') and coalesce(ended_at,now()) > (day::timestamp at time zone 'America/Monterrey');
    a := (select personal_acc(c.id) from characters c where c.user_id=acc.id and c.status='active' order by c.created_at limit 1);
    if mins >= smin and a is not null then
      insert into pay_log(kind, ref, day) values('staff', acc.id, day) on conflict do nothing;
      if found then
        declare y numeric := coalesce((select (value->>acc.staff_role)::numeric from settings where key='staff_salary'),40000)*cpi(); begin
          perform move_money(g, a, round((y - income_tax(y))/365,2), 'Nómina neta · Staff · '||acc.staff_role||' (ya con retención de impuestos)'); n := n+1;
        exception when others then delete from pay_log where kind='staff' and ref=acc.id and pay_log.day=pay_day.day; end;
      end if;
    end if;
  end loop;
  return n;
end $$;

create or replace function pay_now() returns int language sql security definer set search_path=public as $$ select pay_day(real_day(), auth.uid()) $$;

create or replace function daily_tick() returns text language plpgsql security definer set search_path=public as $$
declare last date; d date; rd date; g uuid := gov_acc(); e record; n int := 0; f int := 0; k int := 0;
        rate numeric := coalesce((select (value#>>'{}')::numeric from settings where key='savings_rate'),15); acc record;
begin
  perform election_tick();
  last := coalesce((select (value#>>'{}')::date from settings where key='last_gday'), game_day() - 1);
  if last >= game_day() - 1 then return 'ya corrió este día del juego'; end if;
  update employments set status='active', vacation_until=null where status='vacation' and vacation_until < current_date;
  perform set_config('app.trusted','on',true);
  update characters c set roles = (select coalesce(array_agg(r),'{}') from unnest(c.roles) r where not (coalesce(c.role_expiry,'{}') ? r and (c.role_expiry->>r)::timestamptz < now()))
   where exists(select 1 from jsonb_each_text(coalesce(c.role_expiry,'{}')) x where x.value::timestamptz < now());
  d := greatest(last, game_day() - 37);   -- si nadie entró en días, se ponen al corriente hasta 36 días del juego (3 días reales)
  while d < game_day() - 1 loop
    d := d + 1; k := k + 1;
    for acc in select id, balance from accounts where kind='savings' and balance > 0 loop
      begin perform move_money(g, acc.id, round(acc.balance*rate/100/365,2), 'Intereses de ahorro'); exception when others then null; end;
    end loop;
    for acc in select co.account_id, co.industry from companies co where co.account_id is not null
               and exists(select 1 from characters ch where ch.id = any(co.owners) and ch.status='active') loop
      begin perform move_money(g, acc.account_id, round(coalesce((select (value->>acc.industry)::numeric from settings where key='biz_income'),400)*cpi()*(1 - tax_cfg('corp', 29.84)/100),2),
        'Ingresos del negocio · '||coalesce(acc.industry,'')||' (neto de impuesto corporativo)'); exception when others then null; end;
    end loop;
    for acc in select pr.price, pr.name, coalesce(personal_acc(pr.owner_char),(select account_id from companies where id=pr.owner_company)) a
               from properties pr where pr.owner_char is not null or pr.owner_company is not null loop
      if acc.a is not null then begin perform move_money(acc.a, g, round(acc.price*cpi()*tax_cfg('property', 1.2)/100/365,2), 'Impuesto predial · '||acc.name); exception when others then null; end; end if;
    end loop;
  end loop;
  -- nómina por día REAL (Workday va en tiempo real): lo que no se cobró al momento se paga aquí, una sola vez por día
  rd := coalesce((select (value#>>'{}')::date from settings where key='last_rday'), real_day() - 1);
  while rd < real_day() - 1 loop rd := rd + 1; n := n + pay_day(rd); end loop;
  insert into settings values('last_rday', to_jsonb(rd::text)) on conflict(key) do update set value=excluded.value;
  -- despido por no cumplir sus minutos en 7 días reales
  for e in select em.* from employments em join characters c on c.id=em.character_id where em.status not in ('fired','vacation') and c.status='active' and em.last_qualified < real_day() - 7 loop
    update employments set status='fired' where id=e.id;
    perform set_config('app.trusted','on',true);
    update characters set roles = array_remove(roles, e.dept) where id=e.character_id; f := f+1;
  end loop;
  insert into price_history(company_id,price) select id, share_price(id) from companies;
  insert into settings values('last_gday', to_jsonb(d::text)) on conflict(key) do update set value=excluded.value;
  return k||' días del juego cerrados · '||n||' pagos · '||f||' despidos';
end $$;

-- Requisitos por empleo: trámites aprobados que necesitas (settings.job_reqs) + servicio militar donde lo pida la ley
insert into settings values('job_reqs', '{"Policía":["dni","licencia_conducir","licencia_armas"],"SWAT":["dni","licencia_conducir","licencia_armas"],"FBI":["dni","licencia_conducir","licencia_armas","titulo"],"CIA":["dni","pasaporte","titulo"],"DEA":["dni","licencia_conducir","licencia_armas"],"Bomberos":["dni","licencia_conducir"],"Servicios Médicos":["dni","titulo"],"DOT":["dni","licencia_conducir"],"Taxi":["dni","licencia_conducir"],"Juez de Distrito":["dni","titulo","licencia_juez"],"Abogado Público":["dni","titulo","licencia_abogado"],"Ejército":["dni"],"Seguridad Pública":["dni","licencia_armas"]}') on conflict(key) do nothing;
create or replace function employments_military() returns trigger language plpgsql security definer set search_path=public as $$
declare need text[]; miss text[];
begin
  if new.status = 'fired' or staff_level() >= 3 then return new; end if;
  select coalesce(array_agg(x), '{}') into need from jsonb_array_elements_text(coalesce((select value->new.dept from settings where key='job_reqs'), '[]'::jsonb)) x;
  if coalesce((select value from settings where key='military_required'), '[]'::jsonb) ? new.dept then need := need || array['servicio_militar']; end if;
  select coalesce(array_agg(t), '{}') into miss from unnest(need) t
   where not exists(select 1 from requests where character_id = new.character_id and type = t and status = 'approved');
  if array_length(miss, 1) > 0 then raise exception 'Para trabajar en % te falta: %', new.dept, array_to_string(miss, ', '); end if;
  return new;
end $$;
