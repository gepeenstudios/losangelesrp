-- Presupuesto propio por departamento (cuenta 'dept'), financiado por el Estado. Nómina y multas salen/entran de ahí.
alter table accounts drop constraint if exists accounts_kind_check;
alter table accounts add constraint accounts_kind_check check (kind in ('personal','business','gov','savings','dept'));
alter table accounts add column if not exists dept text unique;

create or replace function dept_acc(d text) returns uuid language sql stable security definer set search_path=public as $$
  select id from accounts where kind='dept' and dept=d $$;
-- las multas las cobra la Policía (si ya tiene presupuesto); si no, la Tesorería
create or replace function fines_acc() returns uuid language sql stable security definer set search_path=public as $$
  select coalesce(dept_acc('Policía'), gov_acc()) $$;
create or replace function is_state() returns bool language sql stable security definer set search_path=public as $$
  select staff_level() >= 3 or exists(select 1 from characters where user_id = auth.uid() and status = 'active' and roles && array['Presidente','Gobernador']) $$;

-- el Estado da (monto > 0) o retira (monto < 0) presupuesto a un departamento
create or replace function budget_move(d text, amount numeric) returns numeric language plpgsql security definer set search_path=public as $$
declare a uuid := dept_acc(d);
begin
  if not is_state() then raise exception 'Solo el Presidente, el Gobernador o un admin manejan los presupuestos'; end if;
  if coalesce(trim(d),'') = '' then raise exception 'Departamento no válido'; end if;
  if a is null then perform set_config('app.money','on',true); insert into accounts(kind, name, dept) values('dept', 'Presupuesto · ' || d, d) returning id into a; end if;
  if amount > 0 then perform move_money(gov_acc(), a, amount, 'Presupuesto asignado · ' || d);
  elsif amount < 0 then perform move_money(a, gov_acc(), -amount, 'Presupuesto retirado · ' || d); end if;
  return (select balance from accounts where id = a);
end $$;

-- el jefe del departamento (o el Estado) gasta su presupuesto: transferencia a un número de cuenta
create or replace function dept_spend(d text, dest text, amount numeric, concept text) returns void language plpgsql security definer set search_path=public as $$
declare t uuid := (select id from accounts where number = replace(dest, ' ', ''));
begin
  if not (is_mgr(d) or is_state()) then raise exception 'Solo el jefe de % puede gastar su presupuesto', d; end if;
  if dept_acc(d) is null then raise exception '% todavía no tiene presupuesto', d; end if;
  if t is null then raise exception 'Esa cuenta no existe'; end if;
  perform move_money(dept_acc(d), t, amount, coalesce(nullif(concept,''), 'Gasto') || ' · ' || d);
end $$;
grant execute on function budget_move(text, numeric) to authenticated; grant execute on function dept_spend(text, text, numeric, text) to authenticated;

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
          begin perform move_money(coalesce(dept_acc(e.dept), g), a, round((e.salary*cpi() - income_tax(e.salary*cpi()))/365,2), 'Nómina neta · '||e.dept||' · '||e.rank||' (ya con retención de impuestos)'); n := n+1;
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

create or replace function collect_fines(c uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r records; acc uuid := personal_acc(c); have numeric; take numeric;
begin
  if acc is null then return; end if;
  for r in select * from records where character_id = c and kind in ('multa','arresto') and not paid and coalesce(amount,0) > 0 order by created_at for update loop
    select balance into have from accounts where id = acc;
    take := least(have, r.amount - coalesce(r.collected,0));
    if take > 0 then perform move_money(acc, fines_acc(), take, 'Multa: ' || left(coalesce(r.description,''), 60)); end if;
    update records set collected = coalesce(collected,0) + greatest(take,0), paid = coalesce(collected,0) + greatest(take,0) >= amount where id = r.id;
    exit when have - greatest(take,0) <= 0;
  end loop;
end $$;

create or replace function pay_fine(record uuid, acc uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r records; have numeric; take numeric;
begin
  select * into r from records where id=record and kind in ('multa','arresto') and not paid for update;
  if not found or not owns_char(r.character_id) then raise exception 'Multa no válida'; end if;
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select balance into have from accounts where id = acc;
  take := least(have, r.amount - coalesce(r.collected,0));
  if take <= 0 then raise exception 'No tienes saldo en esa cuenta'; end if;
  perform move_money(acc, fines_acc(), take, 'Multa');
  update records set collected = coalesce(collected,0) + take, paid = coalesce(collected,0) + take >= amount where id=record;
end $$;

-- Recompensas: cada orden de arresto sube $1 por cada día del juego que el buscado sigue libre, más lo que agregue la policía
alter table records add column if not exists bounty_extra numeric default 0;
create or replace function bounty(r records) returns numeric language sql stable as $$
  select greatest(game_day() - game_day(r.created_at), 0) + coalesce(r.bounty_extra, 0) $$;
create or replace function raise_bounty(rec uuid, amount numeric) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_police() then raise exception 'Solo la policía'; end if;
  if amount is null or amount <= 0 then raise exception 'Monto inválido'; end if;
  update records set bounty_extra = coalesce(bounty_extra,0) + raise_bounty.amount where id = rec and kind = 'orden' and not paid;
  if not found then raise exception 'Esa orden ya no está activa'; end if;
end $$;
-- capturado: sus órdenes se cierran y la recompensa sale del presupuesto de la Policía al oficial que lo capturó
create or replace function capture_orders(c uuid, officer uuid) returns numeric language plpgsql security definer set search_path=public as $$
declare total numeric := 0; r records; a uuid := personal_acc(officer);
begin
  if not is_police() then raise exception 'Solo la policía'; end if;
  for r in select * from records where character_id = c and kind = 'orden' and not paid loop total := total + bounty(r); delete from records where id = r.id; end loop;
  if total > 0 and a is not null then
    begin perform move_money(fines_acc(), a, total, 'Recompensa por captura de ' || (select first_name||' '||last_name from characters where id = c));
    exception when others then total := 0; end;
  end if;
  return total;
end $$;
grant execute on function raise_bounty(uuid, numeric) to authenticated; grant execute on function capture_orders(uuid, uuid) to authenticated;
