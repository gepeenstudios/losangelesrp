-- Nómina al momento: en cuanto cumples tus minutos del día (empleo o servicio de staff) cobras ese día; sin pagos dobles.
-- También: renunciar a un empleo.
create table if not exists pay_log(kind text not null, ref uuid not null, day date not null, paid_at timestamptz default now(), primary key(kind, ref, day));
alter table pay_log enable row level security; -- solo lo tocan las funciones

-- paga el día «day» a quien ya cumplió (uid = solo esa cuenta; null = todos). Devuelve cuántos pagos hizo.
create or replace function pay_day(day date, uid uuid default null) returns int language plpgsql security definer set search_path=public as $$
declare g uuid := gov_acc(); e record; acc record; mins numeric; a uuid; n int := 0;
        minm numeric := coalesce((select (value#>>'{}')::numeric from settings where key='job_min_minutes'),60);
        smin numeric := coalesce((select (value#>>'{}')::numeric from settings where key='staff_min_minutes'),30);
begin
  for e in select em.*, r.salary from employments em join dept_ranks r on r.dept=em.dept and r.rank=em.rank
           join characters c on c.id=em.character_id where em.status<>'fired' and c.status='active' and (uid is null or c.user_id = uid) loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),(day+1)::timestamptz) - greatest(started_at,day::timestamptz))/60),0)
      into mins from work_shifts where character_id=e.character_id and dept=e.dept and started_at < (day+1)::timestamptz and coalesce(ended_at,now()) > day::timestamptz;
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
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),(day+1)::timestamptz) - greatest(started_at,day::timestamptz))/60),0)
      into mins from shifts where user_id=acc.id and started_at < (day+1)::timestamptz and coalesce(ended_at,now()) > day::timestamptz;
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
revoke execute on function pay_day(date, uuid) from public, anon, authenticated;

-- la web lo llama sola mientras estás en turno: cobras hoy en cuanto cumples tus minutos
create or replace function pay_now() returns int language sql security definer set search_path=public as $$ select pay_day(current_date, auth.uid()) $$;
grant execute on function pay_now() to authenticated;

create or replace function daily_tick() returns text language plpgsql security definer set search_path=public as $$
declare d date := current_date - 1; g uuid := gov_acc(); e record; mins numeric; a uuid; n int := 0; f int := 0;
        minm numeric := coalesce((select (value#>>'{}')::numeric from settings where key='job_min_minutes'),60);
        rate numeric := coalesce((select (value#>>'{}')::numeric from settings where key='fed_rate'),4.5); acc record;
begin
  perform election_tick();
  if coalesce((select (value#>>'{}')::date from settings where key='last_tick'),'1970-01-01') >= current_date then return 'ya corrió hoy'; end if;
  insert into settings values('last_tick', to_jsonb(current_date::text)) on conflict(key) do update set value=excluded.value;
  update employments set status='active', vacation_until=null where status='vacation' and vacation_until < d;
  -- roles vencidos (los quita también de Discord en la siguiente sincronización)
  perform set_config('app.trusted','on',true);
  update characters c set roles = (select coalesce(array_agg(r),'{}') from unnest(c.roles) r where not (coalesce(c.role_expiry,'{}') ? r and (c.role_expiry->>r)::timestamptz < now()))
   where exists(select 1 from jsonb_each_text(coalesce(c.role_expiry,'{}')) x where x.value::timestamptz < now());
  n := n + pay_day(d); -- lo que no se cobró al momento (pay_now) se paga aquí, una sola vez
  for e in select em.* from employments em join characters c on c.id=em.character_id where em.status not in ('fired','vacation') and c.status='active' and em.last_qualified < d - 6 loop
    update employments set status='fired' where id=e.id;
    perform set_config('app.trusted','on',true);
    update characters set roles = array_remove(roles, e.dept) where id=e.character_id; f := f+1;
  end loop;
  insert into price_history(company_id,price) select id, share_price(id) from companies;
  for acc in select id, balance from accounts where kind='savings' and balance > 0 loop
    begin perform move_money(g, acc.id, round(acc.balance*rate/100/365,2), 'Intereses de ahorro'); exception when others then null; end;
  end loop;
  -- los negocios del rol no venden de verdad: el gobierno les paga según su giro (dueño con vida activa)
  for acc in select co.account_id, co.industry from companies co where co.account_id is not null
             and exists(select 1 from characters ch where ch.id = any(co.owners) and ch.status='active') loop
    begin perform move_money(g, acc.account_id, round(coalesce((select (value->>acc.industry)::numeric from settings where key='biz_income'),400)*cpi()*(1 - tax_cfg('corp', 29.84)/100),2),
      'Ingresos del negocio · '||coalesce(acc.industry,'')||' (neto de impuesto corporativo)'); exception when others then null; end;
  end loop;
  -- impuesto predial (property tax de LA): % anual del valor, cobrado por día a cada dueño
  for acc in select pr.price, pr.name, coalesce(personal_acc(pr.owner_char),(select account_id from companies where id=pr.owner_company)) a
             from properties pr where pr.owner_char is not null or pr.owner_company is not null loop
    if acc.a is not null then begin perform move_money(acc.a, g, round(acc.price*cpi()*tax_cfg('property', 1.2)/100/365,2), 'Impuesto predial · '||acc.name); exception when others then null; end; end if;
  end loop;
  return n||' pagos, '||f||' despidos';
end $$;

-- renunciar a tu empleo: cierra tu turno abierto y te quita el rol
create or replace function quit_job(emp uuid) returns void language plpgsql security definer set search_path=public as $$
declare e employments;
begin
  select * into e from employments where id = emp;
  if e.id is null or not owns_char(e.character_id) then raise exception 'Ese no es tu empleo'; end if;
  if e.status = 'fired' then raise exception 'Ya no trabajas ahí'; end if;
  update work_shifts set ended_at = now() where character_id = e.character_id and dept = e.dept and ended_at is null;
  update employments set status = 'fired' where id = emp;
  perform set_config('app.trusted','on',true);
  update characters set roles = array_remove(roles, e.dept) where id = e.character_id;
  perform set_config('app.trusted','off',true);
end $$;
grant execute on function quit_job(uuid) to authenticated;
