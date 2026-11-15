-- Buscados y presos: cuentas congeladas, cuenta encriptada nueva, recompensa al informante, requisitos sin antecedentes y envío de cripto.
alter table accounts drop constraint if exists accounts_kind_check;
alter table accounts add constraint accounts_kind_check check (kind in ('personal','business','gov','savings','dept','encrypted'));
alter table calls911 add column if not exists wanted_char uuid references characters on delete set null;

create or replace function in_jail(c uuid) returns bool language sql stable security definer set search_path=public as $$
  select exists(select 1 from inmates where character_id = c and (status = 'preventiva' or (status = 'en_prision' and ends_at > now()))) $$;
create or replace function is_wanted(c uuid) returns bool language sql stable security definer set search_path=public as $$
  select exists(select 1 from records where character_id = c and kind = 'orden' and not paid) $$;
create or replace function char_is_police(c uuid) returns bool language sql stable security definer set search_path=public as $$
  select coalesce((select roles from characters where id = c), '{}') && array['Policía','SWAT','FBI','DEA','CIA','US Seal','US Navy Seal','Servicio Secreto','Seguridad Pública','Custodio','Juez de Distrito','Corte Suprema','Tribunales Inferiores'] $$;
create or replace function char_guard(c uuid) returns void language plpgsql security definer set search_path=public as $$
begin if in_jail(c) then raise exception 'Estás en prisión: no puedes hacer esto hasta que salgas'; end if; end $$;
-- solo frena al dueño (sus propias acciones); el Estado puede cobrar multas aunque esté congelada (app.seize)
create or replace function acc_guard(a uuid) returns void language plpgsql security definer set search_path=public as $$
declare ac accounts;
begin
  if auth.uid() is null or coalesce(current_setting('app.seize', true), '') = 'on' then return; end if;
  select * into ac from accounts where id = a;
  if exists(select 1 from characters ch where ch.id = any(ac.owners) and ch.user_id = auth.uid() and in_jail(ch.id)) then
    raise exception 'Estás en prisión: no puedes usar tu dinero hasta que salgas'; end if;
  if ac.kind in ('personal','savings') and exists(select 1 from characters ch where ch.id = any(ac.owners) and ch.user_id = auth.uid() and is_wanted(ch.id)) then
    raise exception 'Tu cuenta está congelada por una orden de arresto. Usa tu cuenta encriptada 🔐'; end if;
end $$;

create or replace function move_money(f uuid, t uuid, amt numeric, concept text) returns void
language plpgsql security definer set search_path=public as $$
declare have numeric;
begin
  if amt is null or amt <= 0 then raise exception 'Monto inválido'; end if;
  if f is not null then perform acc_guard(f); end if; -- presos y buscados no pueden mover su dinero
  perform set_config('app.money', 'on', true);
  if f is not null then
    update accounts set balance=balance-amt where id=f and balance>=amt;
    if not found then
      select balance into have from accounts where id=f;
      raise exception 'Fondos insuficientes: se necesitan $% y la cuenta % tiene $%', to_char(amt,'FM999,999,999,990.00'),
        coalesce((select case when kind='gov' then 'de la Tesorería' when kind='personal' then 'personal' else '«'||name||'»' end from accounts where id=f),''), to_char(coalesce(have,0),'FM999,999,999,990.00');
    end if;
  end if;
  if t is not null then update accounts set balance=balance+amt where id=t; end if;
  insert into transactions(from_acc,to_acc,amount,concept) values(f,t,amt,concept);
  perform set_config('app.money', 'off', true);
end $$;
revoke all on function move_money(uuid,uuid,numeric,text) from public, anon, authenticated;

-- al emitir una orden: le abren una cuenta encriptada nueva (vacía) para que pueda seguir operando
create or replace function wanted_account() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from accounts where kind = 'encrypted' and owners = array[new.character_id]) then
    insert into accounts(kind, name, owners) values('encrypted', 'Cuenta encriptada 🔐', array[new.character_id]); end if;
  return new;
end $$;
drop trigger if exists records_wanted_acc on records;
create trigger records_wanted_acc after insert on records for each row when (new.kind = 'orden') execute function wanted_account();

create or replace function collect_fines(c uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r records; acc uuid := personal_acc(c); have numeric; take numeric;
begin
  if acc is null then return; end if;
  perform set_config('app.seize', 'on', true); -- el Estado sí cobra aunque la cuenta esté congelada
  for r in select * from records where character_id = c and kind in ('multa','arresto') and not paid and coalesce(amount,0) > 0 order by created_at for update loop
    select balance into have from accounts where id = acc;
    take := least(have, r.amount - coalesce(r.collected,0));
    if take > 0 then perform move_money(acc, fines_acc(), take, 'Multa: ' || left(coalesce(r.description,''), 60)); end if;
    update records set collected = coalesce(collected,0) + greatest(take,0), paid = coalesce(collected,0) + greatest(take,0) >= amount where id = r.id;
    exit when have - greatest(take,0) <= 0;
  end loop;
  perform set_config('app.seize', 'off', true);
end $$;

drop function if exists capture_orders(uuid, uuid);
create or replace function capture_orders(c uuid, officer uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare total numeric := 0; r records; since timestamptz; tip record;
begin
  if not is_police() then raise exception 'Solo la policía'; end if;
  select min(created_at) into since from records where character_id = c and kind = 'orden' and not paid;
  for r in select * from records where character_id = c and kind = 'orden' and not paid loop total := total + bounty(r); delete from records where id = r.id; end loop;
  -- la recompensa es para el último ciudadano que dio información (911 / app Se Busca); policías y el propio buscado no cuentan
  select k.caller_char id into tip from calls911 k join characters ch on ch.id = k.caller_char
   where k.wanted_char = c and k.created_at >= coalesce(since, now()) and k.caller_char <> c and ch.status = 'active' and not char_is_police(k.caller_char)
   order by k.created_at desc limit 1;
  if total > 0 and tip.id is not null then
    begin perform set_config('app.seize', 'on', true);
      perform move_money(fines_acc(), personal_acc(tip.id), total, 'Recompensa: tu información llevó a la captura de ' || (select first_name||' '||last_name from characters where id = c));
      perform set_config('app.seize', 'off', true);
    exception when others then total := 0; end;
  else total := 0; end if;
  return jsonb_build_object('paid', total, 'to', tip.id);
end $$;
grant execute on function capture_orders(uuid, uuid) to authenticated;

create or replace function crypto_trade(c uuid, s text, side text, amount numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare k crypto_coins; x numeric; q numeric; usd numeric; h crypto_hold; fee numeric := 0.005; np numeric;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  perform char_guard(c);
  if not exists(select 1 from characters where id=c and status='active') then raise exception 'Tu vida debe estar activa'; end if;
  perform crypto_tick();
  select * into k from crypto_coins where sym = s for update; if k.sym is null then raise exception 'Moneda desconocida'; end if;
  x := k.virt_usd + k.pool_usd;
  if side = 'buy' then -- amount = dólares
    usd := round(amount, 2); if usd is null or usd < 1 then raise exception 'Mínimo $1'; end if;
    q := trunc(k.pool_coin - x * k.pool_coin / (x + usd * (1 - fee)), 8);
    if q <= 0 then raise exception 'Muy poco para comprar'; end if;
    perform move_money(personal_acc(c), crypto_acc(), usd, 'Bitso · compra ' || s);
    update crypto_coins set pool_usd = pool_usd + usd, pool_coin = pool_coin - q where sym = s returning * into k;
    insert into crypto_hold values(c, s, q, usd) on conflict (character_id, sym) do update set qty = crypto_hold.qty + q, cost = crypto_hold.cost + usd;
  elsif side = 'sell' then -- amount = monedas
    q := round(amount, 8); select * into h from crypto_hold where character_id = c and sym = s for update;
    if q is null or q <= 0 then raise exception 'Cantidad inválida'; end if;
    if coalesce(h.qty, 0) < q then raise exception 'No tienes tanto %', s; end if;
    usd := trunc((x - x * k.pool_coin / (k.pool_coin + q)) * (1 - fee), 2);
    if usd < 0.01 then raise exception 'Muy poco para vender'; end if;
    if usd > k.pool_usd then raise exception 'La reserva no alcanza'; end if;
    update crypto_hold set qty = qty - q, cost = case when qty - q <= 0 then 0 else cost * (qty - q) / qty end where character_id = c and sym = s;
    perform move_money(crypto_acc(), personal_acc(c), usd, 'Bitso · venta ' || s);
    update crypto_coins set pool_usd = pool_usd - usd, pool_coin = pool_coin + q where sym = s returning * into k;
  else raise exception 'Operación inválida'; end if;
  np := round((k.virt_usd + k.pool_usd) / k.pool_coin, 8);
  update crypto_coins set price = np where sym = s;
  insert into crypto_hist values(s, now(), np) on conflict (sym, t) do update set price = excluded.price;
  insert into crypto_trades(character_id, sym, side, qty, price, usd) values(c, s, side, q, round(usd / q, 8), usd);
  return jsonb_build_object('qty', q, 'usd', usd, 'price', round(usd / q, 8), 'new_price', np);
end $$;

create or replace function card_charge(c uuid, dest text, amount numeric, concept text default 'Compra con tarjeta') returns jsonb language plpgsql security definer set search_path=public as $$
declare k credit_cards; t uuid; fee numeric := 0; amt numeric := round(amount, 2);
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  perform char_guard(c);
  k := card_tick(c);
  if k.id is null then raise exception 'No tienes tarjeta de crédito'; end if;
  if k.status <> 'active' then raise exception 'Tu tarjeta está congelada por pagos atrasados. Paga tu mínimo.'; end if;
  if amt is null or amt < 1 then raise exception 'Monto inválido'; end if;
  select id into t from accounts where number = dest;
  if t is null then raise exception 'Cuenta destino no encontrada'; end if;
  if t = personal_acc(c) then fee := round(amt * 0.03, 2); end if;
  if k.owed + plan_left(c) + amt + fee > k.credit_limit then raise exception 'Te pasas de tu línea de crédito (disponible %)', round(k.credit_limit - k.owed - plan_left(c), 2); end if;
  perform move_money(gov_acc(), t, amt, 'Tarjeta de crédito RRVA · ' || coalesce(nullif(concept,''), 'Compra'));
  update credit_cards set owed = owed + amt + fee where id = k.id;
  insert into credit_events(character_id, kind, amount, note) values(c, 'cargo', amt + fee, coalesce(nullif(concept,''), 'Compra') || case when fee > 0 then ' (retiro de efectivo, comisión 3%)' else '' end);
  return jsonb_build_object('owed', k.owed + amt + fee, 'available', k.credit_limit - k.owed - amt - fee);
end $$;

create or replace function card_plan(c uuid, dest text, amount numeric, months int, concept text default 'Compra a plazos') returns jsonb language plpgsql security definer set search_path=public as $$
declare k credit_cards; t uuid; amt numeric := round(amount, 2); tot numeric; mo numeric;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  perform char_guard(c);
  k := card_tick(c);
  if k.id is null then raise exception 'No tienes tarjeta de crédito'; end if;
  if k.status <> 'active' then raise exception 'Tu tarjeta está congelada por pagos atrasados. Paga tu mínimo.'; end if;
  if plan_rate(months) is null then raise exception 'Plazo no válido (1, 3, 6 o 12 meses)'; end if;
  if amt is null or amt < 100 then raise exception 'Las compras a plazos son desde $100'; end if;
  select id into t from accounts where number = replace(dest, ' ', '');
  if t is null then raise exception 'Cuenta destino no encontrada'; end if;
  if t = personal_acc(c) then raise exception 'A plazos no puedes retirar efectivo a tu propia cuenta'; end if;
  tot := round(amt * (1 + plan_rate(months)), 2); mo := round(tot / months, 2);
  if k.owed + plan_left(c) + tot > k.credit_limit then raise exception 'Te pasas de tu línea de crédito (disponible %)', round(k.credit_limit - k.owed - plan_left(c), 2); end if;
  perform move_money(gov_acc(), t, amt, 'Tarjeta de crédito RRVA · ' || coalesce(nullif(concept,''), 'Compra') || ' (a ' || months || ' meses)');
  insert into credit_plans(character_id, concept, principal, total, months, monthly, next_due) values(c, coalesce(nullif(concept,''), 'Compra a plazos'), amt, tot, months, mo, game_day() + 30);
  insert into credit_events(character_id, kind, amount, note) values(c, 'cargo', amt, coalesce(nullif(concept,''), 'Compra') || ' a ' || months || ' meses: total ' || tot || ' en ' || months || ' mensualidades de ' || mo);
  return jsonb_build_object('total', tot, 'monthly', mo);
end $$;

-- enviar cripto a otra persona (Bitso)
create or replace function crypto_send(c uuid, to_char uuid, s text, amount numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare h crypto_hold; q numeric := round(amount, 8); part numeric; p numeric;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  perform char_guard(c);
  if to_char is null or to_char = c or not exists(select 1 from characters where id = to_char and status = 'active') then raise exception 'Destinatario no válido'; end if;
  select * into h from crypto_hold where character_id = c and sym = s for update;
  if q is null or q <= 0 then raise exception 'Cantidad inválida'; end if;
  if coalesce(h.qty, 0) < q then raise exception 'No tienes tanto %', s; end if;
  part := round(h.cost * q / h.qty, 2); p := (select price from crypto_coins where sym = s);
  update crypto_hold set qty = qty - q, cost = cost - part where character_id = c and sym = s;
  insert into crypto_hold values(to_char, s, q, part) on conflict (character_id, sym) do update set qty = crypto_hold.qty + q, cost = crypto_hold.cost + part;
  insert into crypto_trades(character_id, sym, side, qty, price, usd) values(c, s, 'send', q, p, round(q * p, 2)), (to_char, s, 'receive', q, p, round(q * p, 2));
  return jsonb_build_object('qty', q, 'usd', round(q * p, 2));
end $$;
grant execute on function crypto_send(uuid, uuid, text, numeric) to authenticated;

-- policía, fuerzas de seguridad y jueces: sin antecedentes penales
insert into settings values('clean_record', '["Policía","SWAT","FBI","CIA","DEA","Servicio Secreto","Seguridad Pública","Custodio","Juez de Distrito","Corte Suprema","Tribunales Inferiores","Abogado Público","Ejército","US Seal","US Navy Seal"]') on conflict(key) do nothing;
create or replace function has_record(c uuid) returns bool language sql stable security definer set search_path=public as $$
  select exists(select 1 from records where character_id = c and (kind = 'arresto' or (kind = 'orden' and not paid))) or exists(select 1 from inmates where character_id = c) $$;

create or replace function employments_military() returns trigger language plpgsql security definer set search_path=public as $$
declare need text[]; miss text[];
begin
  if new.status = 'fired' or staff_level() >= 3 then return new; end if;
  select coalesce(array_agg(x), '{}') into need from jsonb_array_elements_text(coalesce((select value->new.dept from settings where key='job_reqs'), '[]'::jsonb)) x;
  if coalesce((select value from settings where key='military_required'), '[]'::jsonb) ? new.dept then need := need || array['servicio_militar']; end if;
  select coalesce(array_agg(t), '{}') into miss from unnest(need) t
   where not exists(select 1 from requests where character_id = new.character_id and type = t and status = 'approved');
  if coalesce((select value from settings where key='clean_record'), '[]'::jsonb) ? new.dept and has_record(new.character_id) then
    raise exception 'Para trabajar en % necesitas no tener antecedentes penales (arrestos, prisión u órdenes de arresto)', new.dept; end if;
  if array_length(miss, 1) > 0 then raise exception 'Para trabajar en % te falta: %', new.dept, array_to_string(miss, ', '); end if;
  return new;
end $$;
