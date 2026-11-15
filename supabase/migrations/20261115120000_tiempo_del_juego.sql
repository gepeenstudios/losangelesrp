-- Tiempo coherente: 1 día del juego = 2 horas reales (1 hora del juego = 5 min reales; 1 mes = 2.5 días reales; 1 año ≈ 1 mes real).
-- Día 1 del juego (1 ene 2026, 00:00) = 15 nov 2026 00:00 de Monterrey. Todo lo «diario» (nómina, intereses, ingresos de negocios,
-- predial, tarjeta de crédito) ahora cuenta días del juego. Prisión, elecciones y cuotas de staff siguen en tiempo real (por jugabilidad).
create or replace function game_start(d date) returns timestamptz language sql immutable as $$
  select timestamptz '2026-11-15 06:00:00+00' + (d - date '2026-01-01') * interval '2 hours' $$;
create or replace function game_day(ts timestamptz default now()) returns date language sql stable as $$
  select date '2026-01-01' + floor(extract(epoch from ts - timestamptz '2026-11-15 06:00:00+00') / 7200)::int $$;

delete from pay_log;  -- los registros eran por día real; ahora son por día del juego
update employments set last_qualified = game_day() where status <> 'fired';
update settings set value = '40' where key = 'job_min_minutes' and value#>>'{}' = '60';   -- turno de 8 horas del juego
update settings set value = '84' where key = 'visa_days' and value#>>'{}' = '7';          -- 84 días del juego = 1 semana real
insert into settings values('last_gday', to_jsonb((game_day() - 1)::text)) on conflict(key) do update set value=excluded.value;

create or replace function pay_day(day date, uid uuid default null) returns int language plpgsql security definer set search_path=public as $$
declare g uuid := gov_acc(); e record; acc record; mins numeric; a uuid; n int := 0;
        minm numeric := coalesce((select (value#>>'{}')::numeric from settings where key='job_min_minutes'),40);
        smin numeric := coalesce((select (value#>>'{}')::numeric from settings where key='staff_min_minutes'),30);
begin
  for e in select em.*, r.salary from employments em join dept_ranks r on r.dept=em.dept and r.rank=em.rank
           join characters c on c.id=em.character_id where em.status<>'fired' and c.status='active' and (uid is null or c.user_id = uid) loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),game_start(day+1)) - greatest(started_at,game_start(day)))/60),0)
      into mins from work_shifts where character_id=e.character_id and dept=e.dept and started_at < game_start(day+1) and coalesce(ended_at,now()) > game_start(day);
    if e.status='vacation' or mins >= minm then
      update employments set last_qualified=greatest(last_qualified, day) where id=e.id;
      a := personal_acc(e.character_id);
      if a is not null then
        insert into pay_log(kind, ref, day) values('job', e.id, day) on conflict do nothing;
        if found then
          begin perform move_money(g, a, round((e.salary*cpi() - income_tax(e.salary*cpi()))/365,2), 'Nómina neta · '||e.dept||' · '||e.rank||' (ya con retención de impuestos)'); n := n+1;
          exception when others then delete from pay_log where kind='job' and ref=e.id and pay_log.day=pay_day.day; end;
        end if;
      end if;
    end if;
  end loop;
  -- staff: sueldo anual ÷ 365 si estuvo en servicio el mínimo del día (a su primera vida activa)
  for acc in select p.id, p.staff_role from profiles p where p.staff_role is not null and (uid is null or p.id = uid) loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),game_start(day+1)) - greatest(started_at,game_start(day)))/60),0)
      into mins from shifts where user_id=acc.id and started_at < game_start(day+1) and coalesce(ended_at,now()) > game_start(day);
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

create or replace function pay_now() returns int language sql security definer set search_path=public as $$ select pay_day(game_day(), auth.uid()) $$;

create or replace function daily_tick() returns text language plpgsql security definer set search_path=public as $$
declare last date; d date; g uuid := gov_acc(); e record; n int := 0; f int := 0; k int := 0;
        rate numeric := coalesce((select (value#>>'{}')::numeric from settings where key='fed_rate'),4.5); acc record;
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
    n := n + pay_day(d);   -- lo que no se cobró al momento (pay_now) se paga aquí, una sola vez
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
  -- despido por no trabajar en 84 días del juego (1 semana real)
  for e in select em.* from employments em join characters c on c.id=em.character_id where em.status not in ('fired','vacation') and c.status='active' and em.last_qualified < game_day() - 84 loop
    update employments set status='fired' where id=e.id;
    perform set_config('app.trusted','on',true);
    update characters set roles = array_remove(roles, e.dept) where id=e.character_id; f := f+1;
  end loop;
  insert into price_history(company_id,price) select id, share_price(id) from companies;
  insert into settings values('last_gday', to_jsonb(d::text)) on conflict(key) do update set value=excluded.value;
  return k||' días del juego cerrados · '||n||' pagos · '||f||' despidos';
end $$;

alter table credit_cards alter column last_tick set default game_day(), alter column stmt_due set default game_day() + 7;
update credit_cards set last_tick = game_day(), stmt_due = game_day() + 7 where status <> 'closed';

create or replace function credit_score(c uuid) returns int language sql stable security definer set search_path=public as $$
  select greatest(300, least(850, round(620
    + 12 * least((select count(*) from credit_events where character_id=c and kind='pago_a_tiempo'), 15)
    - 45 * (select count(*) from credit_events where character_id=c and kind='pago_tarde' and created_at > now() - interval '120 hours')
    - 160 * (select count(*) from credit_events where character_id=c and kind='impago' and created_at > now() - interval '120 hours')
    - coalesce((select 80 * greatest(owed / nullif(credit_limit,0) - 0.3, 0) from credit_cards where character_id=c and status<>'closed'), 0)
    + least(30, coalesce((select floor(extract(epoch from now() - min(created_at)) / 7200) from credit_events where character_id=c), 0))
  )))::int $$;

create or replace function card_tick(c uuid) returns credit_cards language plpgsql security definer set search_path=public as $$
declare k credit_cards; d date; i int := 0;
begin
  select * into k from credit_cards where character_id=c and status<>'closed' for update;
  if k.id is null then return null; end if;
  d := k.last_tick;
  while d < game_day() and i < 90 loop
    d := d + 1; i := i + 1;
    if k.owed > 0 then k.int_cycle := k.int_cycle + round(k.owed * k.apr / 365, 2); k.owed := k.owed + round(k.owed * k.apr / 365, 2); end if;   -- interés diario
    if d >= k.stmt_due then                                                      -- corte
      if k.int_cycle > 0 then insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'intereses', k.int_cycle, 'Intereses del periodo (' || round(k.apr*100) || '% anual)', game_start(d)); k.int_cycle := 0; end if;
      if k.stmt_min > 0 and k.stmt_paid >= k.stmt_min then
        insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'pago_a_tiempo', k.stmt_paid, 'Pagaste tu mínimo a tiempo', game_start(d));
        k.missed := 0;
        declare s int := credit_score(c); begin
          if s >= 650 and k.owed <= k.credit_limit * 0.5 then
            k.credit_limit := round(least(k.credit_limit * case when s >= 800 then 2 when s >= 760 then 1.5 when s >= 700 then 1.25 else 1.1 end, credit_cap(s)), 2);
          end if; end;
      elsif k.stmt_min > 0 then
        k.missed := k.missed + 1; k.owed := k.owed + round(25 * cpi(), 2);
        insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'pago_tarde', k.stmt_min, 'No cubriste tu pago mínimo · cargo por atraso', game_start(d));
        k.credit_limit := round(greatest(k.credit_limit * 0.8, 500), 2);
        if k.missed >= 3 then
          k.status := 'closed';
          insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'impago', k.owed, '3 pagos vencidos: tarjeta cancelada, la deuda sigue', game_start(d));
        elsif k.missed >= 2 then k.status := 'frozen'; end if;
      end if;
      k.stmt_min := case when k.owed <= 0 then 0 else round(greatest(least(k.owed, 50 * cpi()), k.owed * 0.1), 2) end;
      k.stmt_paid := 0; k.stmt_due := d + 7;
    end if;
  end loop;
  k.last_tick := d;
  update credit_cards set owed=k.owed, credit_limit=k.credit_limit, status=k.status, last_tick=k.last_tick, stmt_due=k.stmt_due, stmt_min=k.stmt_min,
    stmt_paid=k.stmt_paid, missed=k.missed, int_cycle=k.int_cycle where id=k.id;
  return k;
end $$;
