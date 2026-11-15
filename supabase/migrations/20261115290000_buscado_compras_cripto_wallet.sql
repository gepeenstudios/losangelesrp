-- Buscados: su "cuenta personal" pasa a ser la encriptada (ahí les cae el sueldo y con ella compran),
-- pueden pagarle a otros jugadores y a sus empresas, pero no al gobierno ni a cuentas del sistema.
create or replace function personal_acc(c uuid) returns uuid language sql stable security definer set search_path=public as $$
  select coalesce(case when is_wanted(c) then (select id from accounts where kind='encrypted' and owners=array[c] limit 1) end,
                  (select id from accounts where kind='personal' and owners[1]=c limit 1)) $$;

create or replace function acc_guard(a uuid, t uuid) returns void language plpgsql security definer set search_path=public as $$
declare ac accounts; wanted bool;
begin
  if auth.uid() is null or coalesce(current_setting('app.seize', true), '') = 'on' then return; end if;
  select * into ac from accounts where id = a;
  if exists(select 1 from characters ch where ch.id = any(ac.owners) and ch.user_id = auth.uid() and in_jail(ch.id)) then
    raise exception 'Estás en prisión: no puedes usar tu dinero hasta que salgas'; end if;
  wanted := exists(select 1 from characters ch where ch.id = any(ac.owners) and ch.user_id = auth.uid() and is_wanted(ch.id));
  if not wanted then return; end if;
  if ac.kind in ('personal','savings') then raise exception 'Tu cuenta está congelada por una orden de arresto. Usa tu cuenta encriptada 🔐'; end if;
  if t is not null and exists(select 1 from accounts where id = t and (kind in ('gov','dept') or owners = '{}')) then
    raise exception 'Eres buscado: solo puedes comprarle a otros jugadores o a sus empresas, no al gobierno ni a tiendas oficiales'; end if;
end $$;

create or replace function move_money(f uuid, t uuid, amt numeric, concept text) returns void
language plpgsql security definer set search_path=public as $$
declare have numeric;
begin
  if amt is null or amt <= 0 then raise exception 'Monto inválido'; end if;
  if f is not null then perform acc_guard(f, t); end if; -- presos y buscados no pueden mover su dinero
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

-- Cripto como la real: cada quien tiene su dirección (wallet) por moneda; envías a una dirección, pagas una comisión de red y queda un hash de transacción
alter table crypto_trades add column if not exists txid text;
create or replace function crypto_addr(c uuid, s text) returns text language sql immutable as $$
  select case s when 'BTC' then 'bc1q' when 'ETH' then '0x' when 'SOL' then 'So1' when 'XRP' then 'r' else lower(s) || '1' end || substr(md5(c::text || ':' || s || ':rrva'), 1, 34) $$;
drop function if exists crypto_send(uuid, uuid, text, numeric);
create or replace function crypto_send(c uuid, addr text, s text, amount numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare h crypto_hold; q numeric := round(amount, 8); fee numeric; part numeric; p numeric; to_char uuid; tx text := md5(random()::text || clock_timestamp()::text) || substr(md5(random()::text), 1, 32);
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  perform char_guard(c);
  select id into to_char from characters where status = 'active' and crypto_addr(id, s) = trim(addr) limit 1;
  if to_char is null then raise exception 'Esa dirección de % no existe (revisa que sea de la misma moneda)', s; end if;
  if to_char = c then raise exception 'No puedes enviarte a ti mismo'; end if;
  select * into h from crypto_hold where character_id = c and sym = s for update;
  if q is null or q <= 0 then raise exception 'Cantidad inválida'; end if;
  fee := round(q * 0.001, 8); -- comisión de red (0.1%): se queda en la reserva del mercado
  if coalesce(h.qty, 0) < q + fee then raise exception 'No tienes tanto %: necesitas % + % de comisión de red', s, q, fee; end if;
  part := round(h.cost * (q + fee) / h.qty, 2); p := (select price from crypto_coins where sym = s);
  update crypto_hold set qty = qty - q - fee, cost = cost - part where character_id = c and sym = s;
  insert into crypto_hold values(to_char, s, q, round(part * q / (q + fee), 2)) on conflict (character_id, sym) do update set qty = crypto_hold.qty + q, cost = crypto_hold.cost + excluded.cost;
  update crypto_coins set pool_coin = pool_coin + fee where sym = s;
  insert into crypto_trades(character_id, sym, side, qty, price, usd, txid) values(c, s, 'send', q, p, round(q * p, 2), tx), (to_char, s, 'receive', q, p, round(q * p, 2), tx);
  return jsonb_build_object('qty', q, 'fee', fee, 'usd', round(q * p, 2), 'txid', tx);
end $$;
grant execute on function crypto_send(uuid, text, text, numeric) to authenticated;
