-- Cripto como en la vida real: oferta fija y precio por oferta y demanda entre jugadores (pool de liquidez x·y=k, como un exchange descentralizado).
-- El gobierno ya no es la contraparte: los dólares de los compradores quedan en la reserva del exchange y de ahí se les paga a los que venden.
-- La curva garantiza que la reserva siempre alcanza para recomprar todas las monedas en manos de jugadores.
alter table crypto_coins add column if not exists supply numeric, add column if not exists pool_coin numeric,
  add column if not exists pool_usd numeric not null default 0, add column if not exists virt_usd numeric;
insert into accounts(kind,name,owners) select 'business','Bitso · reserva de liquidez','{}' where not exists(select 1 from accounts where name='Bitso · reserva de liquidez' and kind='business');
create or replace function crypto_acc() returns uuid language sql stable security definer set search_path=public as $$
  select id from accounts where name='Bitso · reserva de liquidez' and kind='business' order by created_at limit 1 $$;

-- arranque: cada moneda conserva su precio; lo que la Tesorería cobró por cripto pasa a la reserva para respaldar a quien ya tiene monedas
do $$ declare c record; h numeric; net numeric; y numeric; v numeric; dep numeric;
begin
  for c in select * from crypto_coins where pool_coin is null loop
    h := coalesce((select sum(qty) from crypto_hold where sym=c.sym), 0);
    net := greatest(coalesce((select sum(case when side='buy' then usd else -usd end) from crypto_trades where sym=c.sym), 0), 0);
    net := least(net, coalesce((select balance from accounts where id=gov_acc()), 0));
    dep := case when c.sym='LARP' then 2000000 else 20000000 end;  -- profundidad: cuánto dinero mueve el precio
    y := dep / c.price; v := c.price * y - net;
    if h > 0 and v * h > net * y then v := net * y / h; end if;   -- que la reserva alcance para recomprar todo lo que ya tienen
    v := greatest(v, 0.01);
    update crypto_coins set supply = y + h, pool_coin = y, pool_usd = net, virt_usd = v, price = round((v + net) / y, 8) where sym = c.sym;
    if net > 0 then perform move_money(gov_acc(), crypto_acc(), net, 'Bitso · traspaso de reservas ' || c.sym); end if;
  end loop;
end $$;

-- ya no hay caminata aleatoria: solo rellena la gráfica con el último precio para que el tiempo avance
create or replace function crypto_tick() returns void language plpgsql security definer set search_path=public as $$
declare last timestamptz; steps int;
begin
  select (value#>>'{}')::timestamptz into last from settings where key='crypto_last' for update;
  steps := least(floor(extract(epoch from now() - last) / 60)::int, 1440);
  if steps < 1 then return; end if;
  if extract(epoch from now() - last) > 86400 then last := date_trunc('minute', now()) - interval '1 day'; end if;
  insert into crypto_hist select sym, last + g * interval '1 minute', price from crypto_coins, generate_series(1, steps) g on conflict do nothing;
  update settings set value = to_jsonb(last + steps * interval '1 minute') where key='crypto_last';
  delete from crypto_hist where t < now() - interval '7 days';
end $$;

create or replace function crypto_trade(c uuid, s text, side text, amount numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare k crypto_coins; x numeric; q numeric; usd numeric; h crypto_hold; fee numeric := 0.005; np numeric;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
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
