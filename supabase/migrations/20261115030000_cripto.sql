-- Criptomonedas (simuladas). Los precios se mueven solos: cada minuto un paso aleatorio, calculado al momento en que alguien consulta.
-- El exchange es el gobierno: lo que compras se paga a la Tesorería y lo que vendes lo paga la Tesorería (comisión 0.5%).
create table if not exists crypto_coins(sym text primary key, name text not null, price numeric not null, base numeric not null, vol numeric not null, color text, ord int);
create table if not exists crypto_hist(sym text references crypto_coins on delete cascade, t timestamptz not null, price numeric not null, primary key(sym, t));
create table if not exists crypto_hold(character_id uuid references characters on delete cascade, sym text references crypto_coins, qty numeric not null default 0, cost numeric not null default 0, primary key(character_id, sym));
create table if not exists crypto_trades(id uuid primary key default gen_random_uuid(), character_id uuid references characters on delete cascade, sym text, side text, qty numeric, price numeric, usd numeric, created_at timestamptz default now());
alter table crypto_coins enable row level security; alter table crypto_hist enable row level security; alter table crypto_hold enable row level security; alter table crypto_trades enable row level security;
drop policy if exists cc_sel on crypto_coins; create policy cc_sel on crypto_coins for select to authenticated using (true);
drop policy if exists ch_sel on crypto_hist; create policy ch_sel on crypto_hist for select to authenticated using (true);
drop policy if exists cw_sel on crypto_hold; create policy cw_sel on crypto_hold for select to authenticated using (owns_char(character_id) or staff_level()>=2);
drop policy if exists ct_sel on crypto_trades; create policy ct_sel on crypto_trades for select to authenticated using (owns_char(character_id) or staff_level()>=2);
insert into crypto_coins(sym,name,price,base,vol,color,ord) values
 ('BTC','Bitcoin',95000,95000,0.0015,'#f7931a',1),('ETH','Ethereum',3500,3500,0.002,'#8c8cff',2),('SOL','Solana',180,180,0.003,'#14f195',3),
 ('XRP','XRP',2.3,2.3,0.003,'#c9d1d9',4),('DOGE','Dogecoin',0.35,0.35,0.004,'#c2a633',5),('ADA','Cardano',0.9,0.9,0.003,'#3a7bff',6),
 ('LARP','LA Coin',1,1,0.006,'#ff4d6d',7) on conflict do nothing;
insert into settings(key,value) values('crypto_last', to_jsonb(date_trunc('minute', now()))) on conflict do nothing;

create or replace function crypto_tick() returns void language plpgsql security definer set search_path=public as $$
declare last timestamptz; steps int; k int; c crypto_coins; p numeric; g float8;
begin
  select (value#>>'{}')::timestamptz into last from settings where key='crypto_last' for update;
  steps := least(floor(extract(epoch from now() - last) / 60)::int, 1440);
  if steps < 1 then return; end if;
  if extract(epoch from now() - last) > 86400 then last := date_trunc('minute', now()) - interval '1 day'; end if;
  for c in select * from crypto_coins loop
    p := c.price;
    for k in 1..steps loop
      g := sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random()); -- normal(0,1)
      p := greatest(p * exp(0.0005 * ln(c.base / p) + c.vol * g), c.base * 0.01);  -- caminata aleatoria que regresa poco a poco a su precio base
      insert into crypto_hist values(c.sym, last + k * interval '1 minute', round(p, 8)) on conflict do nothing;
    end loop;
    update crypto_coins set price = round(p, 8) where sym = c.sym;
  end loop;
  update settings set value = to_jsonb(last + steps * interval '1 minute') where key='crypto_last';
  delete from crypto_hist where t < now() - interval '7 days';
end $$;

-- historial resumido para la gráfica (máx. ~120 puntos)
create or replace function crypto_chart(s text, minutes int) returns table(t timestamptz, price numeric) language sql stable security definer set search_path=public as $$
  select t, price from (select t, price, row_number() over (order by t desc) - 1 rn from crypto_hist where sym = s and t > now() - make_interval(mins => minutes)) q
  where rn % greatest(1, minutes / 120) = 0 order by t $$;

create or replace function crypto_trade(c uuid, s text, side text, amount numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare p numeric; q numeric; usd numeric; h crypto_hold; fee numeric := 0.005;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  if not exists(select 1 from characters where id=c and status='active') then raise exception 'Tu vida debe estar activa'; end if;
  perform crypto_tick();
  select price into p from crypto_coins where sym = s; if p is null then raise exception 'Moneda desconocida'; end if;
  if side = 'buy' then -- amount = dólares a gastar
    usd := round(amount, 2); if usd is null or usd < 1 then raise exception 'Mínimo $1'; end if;
    q := round(usd * (1 - fee) / p, 8);
    perform move_money(personal_acc(c), gov_acc(), usd, 'Bitso · compra ' || s);
    insert into crypto_hold values(c, s, q, usd) on conflict (character_id, sym) do update set qty = crypto_hold.qty + q, cost = crypto_hold.cost + usd;
  elsif side = 'sell' then -- amount = cantidad de la moneda
    q := round(amount, 8); select * into h from crypto_hold where character_id = c and sym = s for update;
    if q is null or q <= 0 then raise exception 'Cantidad inválida'; end if;
    if coalesce(h.qty, 0) < q then raise exception 'No tienes tanto %', s; end if;
    usd := round(q * p * (1 - fee), 2); if usd < 0.01 then raise exception 'Muy poco para vender'; end if;
    update crypto_hold set qty = qty - q, cost = case when qty - q <= 0 then 0 else cost * (qty - q) / qty end where character_id = c and sym = s;
    perform move_money(gov_acc(), personal_acc(c), usd, 'Bitso · venta ' || s);
  else raise exception 'Operación inválida'; end if;
  insert into crypto_trades(character_id, sym, side, qty, price, usd) values(c, s, side, q, p, usd);
  return jsonb_build_object('qty', q, 'usd', usd, 'price', p);
end $$;
