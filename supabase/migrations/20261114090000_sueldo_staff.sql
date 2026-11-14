-- Sueldo diario para el staff (Helper, Mod, Admin, Co-Owner, Owner) si cumplió su tiempo en servicio
create or replace function daily_tick() returns text language plpgsql security definer set search_path=public as $$
declare d date := current_date - 1; g uuid := gov_acc(); e record; mins numeric; a uuid; n int := 0; f int := 0;
        minm numeric := coalesce((select (value#>>'{}')::numeric from settings where key='job_min_minutes'),60);
        rate numeric := coalesce((select (value#>>'{}')::numeric from settings where key='fed_rate'),4.5); acc record;
begin
  perform election_tick();
  if coalesce((select (value#>>'{}')::date from settings where key='last_tick'),'1970-01-01') >= current_date then return 'ya corrió hoy'; end if;
  insert into settings values('last_tick', to_jsonb(current_date::text)) on conflict(key) do update set value=excluded.value;
  update employments set status='active', vacation_until=null where status='vacation' and vacation_until < d;
  for e in select em.*, r.salary from employments em join dept_ranks r on r.dept=em.dept and r.rank=em.rank
           join characters c on c.id=em.character_id where em.status<>'fired' and c.status='active' loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),(d+1)::timestamptz) - greatest(started_at,d::timestamptz))/60),0)
      into mins from work_shifts where character_id=e.character_id and dept=e.dept and started_at < (d+1)::timestamptz and coalesce(ended_at,now()) > d::timestamptz;
    if e.status='vacation' or mins >= minm then
      update employments set last_qualified=d where id=e.id;
      a := personal_acc(e.character_id);
      if a is not null then
        begin perform move_money(g, a, round(e.salary/365*cpi(),2), 'Nómina · '||e.dept||' · '||e.rank); n := n+1;
        exception when others then null; end;
      end if;
    elsif e.last_qualified < d - 6 then
      update employments set status='fired' where id=e.id;
  perform set_config('app.trusted','on',true);
      update characters set roles = array_remove(roles, e.dept) where id=e.character_id; f := f+1;
    end if;
  end loop;
  insert into price_history(company_id,price) select id, share_price(id) from companies;
  for acc in select id, balance from accounts where kind='savings' and balance > 0 loop
    begin perform move_money(g, acc.id, round(acc.balance*rate/100/365,2), 'Intereses de ahorro'); exception when others then null; end;
  end loop;
  -- los negocios del rol no venden de verdad: el gobierno les paga según su giro (dueño con vida activa)
  for acc in select co.account_id, co.industry from companies co where co.account_id is not null
             and exists(select 1 from characters ch where ch.id = any(co.owners) and ch.status='active') loop
    begin perform move_money(g, acc.account_id, round(coalesce((select (value->>acc.industry)::numeric from settings where key='biz_income'),400)*cpi(),2),
      'Ingresos del negocio · '||coalesce(acc.industry,'')); exception when others then null; end;
  end loop;
  -- el staff también cobra por moderar: sueldo anual ÷ 365 si estuvo en servicio el mínimo del día (a su primera vida activa)
  for acc in select p.id, p.staff_role from profiles p where p.staff_role is not null loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),(d+1)::timestamptz) - greatest(started_at,d::timestamptz))/60),0)
      into mins from shifts where user_id=acc.id and started_at < (d+1)::timestamptz and coalesce(ended_at,now()) > d::timestamptz;
    a := (select personal_acc(c.id) from characters c where c.user_id=acc.id and c.status='active' order by c.created_at limit 1);
    if mins >= coalesce((select (value#>>'{}')::numeric from settings where key='staff_min_minutes'),30) and a is not null then
      begin perform move_money(g, a, round(coalesce((select (value->>acc.staff_role)::numeric from settings where key='staff_salary'),40000)/365*cpi(),2),
        'Nómina · Staff · '||acc.staff_role); n := n+1; exception when others then null; end;
    end if;
  end loop;
  return n||' pagos, '||f||' despidos';
end $$;
