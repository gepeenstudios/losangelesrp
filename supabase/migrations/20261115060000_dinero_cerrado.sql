-- Economía cerrada: el dinero no se crea en ningún lado salvo cuando el Presidente lo emite (y eso causa inflación).
-- * staff_pay ya no puede crear dinero: todo sale de la Tesorería (solo el primer presupuesto de una economía vacía se crea).
-- * Nadie, ni el staff, puede cambiar un saldo a mano: los saldos solo cambian por move_money.
create or replace function move_money(f uuid, t uuid, amt numeric, concept text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if amt is null or amt <= 0 then raise exception 'Monto inválido'; end if;
  perform set_config('app.money', 'on', true);
  if f is not null then
    update accounts set balance=balance-amt where id=f and balance>=amt;
    if not found then raise exception 'Fondos insuficientes'; end if;
  end if;
  if t is not null then update accounts set balance=balance+amt where id=t; end if;
  insert into transactions(from_acc,to_acc,amount,concept) values(f,t,amt,concept);
  perform set_config('app.money', 'off', true);
end $$;
revoke all on function move_money(uuid,uuid,numeric,text) from public, anon, authenticated;

create or replace function guard_balance() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and coalesce(current_setting('app.money', true), 'off') <> 'on'
     and (tg_op = 'INSERT' and coalesce(new.balance, 0) <> 0 or tg_op = 'UPDATE' and new.balance is distinct from old.balance) then
    raise exception 'Los saldos solo cambian con movimientos de dinero (el dinero no se crea)';
  end if;
  return new;
end $$;
drop trigger if exists accounts_guard_balance on accounts;
create trigger accounts_guard_balance before insert or update on accounts for each row execute function guard_balance();

create or replace function staff_pay(acc uuid, amount numeric, concept text, mint bool default false) returns void
language plpgsql security definer set search_path=public as $$
begin
  if staff_level() < 3 then raise exception 'Solo admins'; end if;
  if mint and amount > 0 then
    if coalesce((select sum(balance) from accounts), 0) > 0 then raise exception 'El dinero no se crea: solo el Presidente puede emitir más (Reserva Federal)'; end if;
    perform move_money(null, acc, amount, concept);  -- presupuesto inicial de una economía vacía
  elsif amount >= 0 then perform move_money(gov_acc(), acc, amount, concept);
  else perform move_money(acc, gov_acc(), -amount, concept); end if;
end $$;
