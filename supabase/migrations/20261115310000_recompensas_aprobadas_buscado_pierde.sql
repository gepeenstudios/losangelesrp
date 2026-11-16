-- 1) Cuenta encriptada: sin impuestos mientras el dinero se queda en cuentas encriptadas; al pasarlo a una cuenta normal paga impuestos.impuestos.encrypted (25%).
create or replace function transfer(from_acc uuid, dest text, amount numeric, concept text default 'Transferencia')
returns void language plpgsql security definer set search_path=public as $$
declare t uuid; tax numeric;
begin
  if not owns_acc(from_acc) then raise exception 'No es tu cuenta'; end if;
  select id into t from accounts where number=dest;
  if t is null and dest ~ '^[0-9a-f-]{36}$' then t := personal_acc(dest::uuid); end if;
  if t is null then raise exception 'Cuenta destino no encontrada'; end if;
  if t = from_acc then raise exception 'Es la misma cuenta'; end if;
  -- dinero de la cuenta encriptada: no paga impuestos mientras se queda en cuentas encriptadas; al pasar a una cuenta normal paga impuesto
  if (select kind from accounts where id = from_acc) = 'encrypted' and (select kind from accounts where id = t) <> 'encrypted' then
    tax := round(amount * tax_cfg('encrypted', 25) / 100, 2);
    perform move_money(from_acc, t, amount - tax, coalesce(nullif(concept,''),'Transferencia') || ' (desde cuenta encriptada, neto de impuesto)');
    if tax > 0 then perform set_config('app.seize', 'on', true); perform move_money(from_acc, gov_acc(), tax, 'Impuesto al sacar dinero de cuenta encriptada'); perform set_config('app.seize', 'off', true); end if;
    return;
  end if;
  perform move_money(from_acc, t, amount, coalesce(nullif(concept,''),'Transferencia'));
end $$;

-- 2) Al emitir una orden de arresto: además de la cuenta encriptada, pierde sus empleos (y sus roles) y sus candidaturas.
create or replace function wanted_account() returns trigger language plpgsql security definer set search_path=public as $$
declare e record;
begin
  if not exists(select 1 from accounts where kind = 'encrypted' and owners = array[new.character_id]) then
    insert into accounts(kind, name, owners) values('encrypted', 'Cuenta encriptada 🔐', array[new.character_id]); end if;
  perform set_config('app.trusted', 'on', true);
  for e in select * from employments where character_id = new.character_id and status <> 'fired' loop
    update employments set status = 'fired' where id = e.id;
    update characters set roles = array_remove(roles, e.dept) where id = new.character_id;
  end loop;
  delete from candidacies where character_id = new.character_id;
  perform set_config('app.trusted', 'off', true);
  return new;
end $$;

-- 3) Recompensas: al capturarlo, la recompensa queda pendiente; la policía decide qué aviso sirvió y entonces se paga
create table if not exists bounty_claims(id uuid primary key default gen_random_uuid(), wanted_char uuid references characters on delete cascade, amount numeric not null,
  status text not null default 'pending', paid_to uuid, call_id uuid, created_at timestamptz default now(), decided_at timestamptz);
alter table bounty_claims enable row level security;
drop policy if exists bc_sel on bounty_claims; create policy bc_sel on bounty_claims for select to authenticated using (is_police() or paid_to in (select id from characters where user_id = auth.uid()));

drop function if exists capture_orders(uuid, uuid);
create or replace function capture_orders(c uuid, officer uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare total numeric := 0; r records; tips int;
begin
  if not is_police() then raise exception 'Solo la policía'; end if;
  for r in select * from records where character_id = c and kind = 'orden' and not paid loop total := total + bounty(r); delete from records where id = r.id; end loop;
  select count(*) into tips from calls911 where wanted_char = c;
  if total > 0 and tips > 0 then insert into bounty_claims(wanted_char, amount) values(c, total); end if;
  return jsonb_build_object('pending', case when tips > 0 then total else 0 end, 'tips', tips);
end $$;

create or replace function bounty_pay(claim uuid, call uuid) returns numeric language plpgsql security definer set search_path=public as $$
declare b bounty_claims; k calls911;
begin
  if not is_police() then raise exception 'Solo la policía'; end if;
  select * into b from bounty_claims where id = claim for update;
  if b.id is null or b.status <> 'pending' then raise exception 'Esa recompensa ya se resolvió'; end if;
  select * into k from calls911 where id = call;
  if k.id is null or k.wanted_char is distinct from b.wanted_char then raise exception 'Ese aviso no es de este caso'; end if;
  if k.caller_char = b.wanted_char or char_is_police(k.caller_char) then raise exception 'Los policías y el propio buscado no cobran recompensas'; end if;
  perform set_config('app.seize', 'on', true);
  perform move_money(fines_acc(), personal_acc(k.caller_char), b.amount, 'Recompensa: tu información llevó a la captura de ' || (select first_name||' '||last_name from characters where id = b.wanted_char));
  perform set_config('app.seize', 'off', true);
  update bounty_claims set status = 'paid', paid_to = k.caller_char, call_id = k.id, decided_at = now() where id = claim;
  return b.amount;
end $$;
create or replace function bounty_reject(claim uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_police() then raise exception 'Solo la policía'; end if;
  update bounty_claims set status = 'none', decided_at = now() where id = claim and status = 'pending';
end $$;
grant execute on function capture_orders(uuid, uuid), bounty_pay(uuid, uuid), bounty_reject(uuid) to authenticated;
