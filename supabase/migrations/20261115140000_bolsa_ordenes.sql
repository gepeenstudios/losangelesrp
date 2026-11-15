-- Bolsa como en la vida real:
-- * Libro de órdenes: compras y ventas a mercado o con precio límite. Primero se cruzan con órdenes de otros jugadores (precio-tiempo);
--   lo que falta en una orden a mercado lo cubre la empresa (emisión/recompra) o el ETF (creación/redención), como un formador de mercado.
-- * El precio de una acción es el del último trato. El valor en libros (fair) se sigue mostrando aparte.
-- * Bandas de volatilidad: una orden a mercado no se cruza a más de 50% arriba/abajo del valor justo.
-- * Dividendos: los dueños pueden repartir dinero de la empresa a todos los accionistas (incluido el ETF).
alter table holdings add column if not exists locked int not null default 0;
alter table companies add column if not exists last_price numeric, add column if not exists last_trade_at timestamptz;
create table if not exists orders(id uuid primary key default gen_random_uuid(), character_id uuid references characters on delete cascade,
  company_id uuid references companies on delete cascade, side text not null check (side in ('buy','sell')), qty int not null check (qty > 0),
  filled int not null default 0, limit_price numeric not null check (limit_price > 0), escrow_left numeric not null default 0,
  status text not null default 'open' check (status in ('open','filled','cancelled')), created_at timestamptz default now());
create index if not exists orders_book on orders(company_id, side, status, limit_price);
create table if not exists dividends(id uuid primary key default gen_random_uuid(), company_id uuid references companies on delete cascade,
  total numeric not null, per_share numeric not null, created_at timestamptz default now());
alter table orders enable row level security; alter table dividends enable row level security;
drop policy if exists ord_sel on orders; create policy ord_sel on orders for select to authenticated using (true);
drop policy if exists div_sel on dividends; create policy div_sel on dividends for select to authenticated using (true);
insert into accounts(kind,name,owners) select 'business','GBM · custodia de órdenes','{}' where not exists(select 1 from accounts where name='GBM · custodia de órdenes' and kind='business');
create or replace function gbm_escrow() returns uuid language sql stable security definer set search_path=public as $$
  select id from accounts where name='GBM · custodia de órdenes' and kind='business' order by created_at limit 1 $$;

-- valor justo (en libros × prima): lo que usa la empresa al emitir/recomprar y el ETF para valuarse
create or replace function co_fair(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select greatest(0.01, round(co_book(co.id) / greatest(case when co_out(co.id) > 0 then co_out(co.id) else co.shares_total end, 1) * co_premium(co.id), 2))
  from companies co where co.id=c $$;

create or replace function etf_nav() returns numeric language sql stable security definer set search_path=public as $$
  select case when coalesce((select sum(shares) from holdings where company_id=etf_id() and shares>0),0) <= 0 then 10 else
    greatest(0.01, round((coalesce((select balance from accounts where id=(select account_id from companies where id=etf_id())),0)
      + coalesce((select sum(e.shares * co_fair(e.company_id)) from etf_holdings e where e.shares > 0),0))
      / (select sum(shares) from holdings where company_id=etf_id() and shares>0), 4)) end $$;

-- precio = último trato (como en la bolsa real); si aún no hay tratos, el valor justo
create or replace function share_price(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select case when co.industry='ETF' then round(coalesce(co.last_price, etf_nav()), 2) else coalesce(co.last_price, co_fair(co.id)) end
  from companies co where co.id=c $$;

create or replace function sell_shares(company uuid, qty int, acc uuid) returns numeric language plpgsql security definer set search_path=public as $$
declare c uuid; co companies; h holdings; out_ numeric; ps numeric; p0 numeric; p1 numeric; total numeric; cash numeric;
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select owners[1] into c from accounts where id=acc and kind='personal';
  if (select industry from companies where id=company) = 'ETF' then return etf_trade('sell', qty, acc); end if;
  select * into h from holdings where character_id=c and company_id=company for update;
  if h.shares is null or h.shares - coalesce(h.locked,0) < qty or qty < 1 then raise exception 'No tienes tantas acciones disponibles (las que están en órdenes de venta no cuentan)'; end if;
  select * into co from companies where id=company for update;
  if co.industry = 'ETF' then
    total := share_price(company) * qty; perform move_money(gov_acc(), acc, total, 'Venta de acciones · ETF');
  else
    out_ := greatest(co_out(company), 1); ps := co_book(company) / out_;
    p0 := co_premium(company); p1 := greatest(p0 * exp(-qty / out_), 0.2);
    total := round(greatest(ps, 0) * (p0 + p1) / 2 * qty, 2);
    cash := coalesce((select balance from accounts where id=co.account_id), 0);
    if total > cash then raise exception 'La empresa solo tiene % en efectivo para recomprar acciones (tus % títulos valen %)', round(cash,2), qty, total; end if;
    if total > 0 then perform move_money(co.account_id, acc, total, 'Venta de acciones · ' || co.name); end if;
    update companies set premium = p1, premium_at = now() where id = company;
  end if;
  update holdings set cost = round(cost * (shares-qty) / shares, 2), shares=shares-qty where id=h.id;
  insert into trades(character_id,company_id,side,qty,price,total) values(c,company,'venta',qty,total/qty,total);
  insert into price_history(company_id,price) values(company, share_price(company));
  return total;
end $$;

create or replace function etf_trade(side text, qty int, acc uuid) returns numeric language plpgsql security definer set search_path=public as $$
declare c uuid; etf companies; nav numeric; total numeric; cap numeric; r record; fa uuid; cash numeric; outq numeric; h holdings;
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select owners[1] into c from accounts where id=acc and kind='personal';
  if c is null then raise exception 'Usa tu cuenta personal'; end if;
  if qty is null or qty < 1 then raise exception 'Cantidad inválida'; end if;
  select * into etf from companies where id=etf_id() for update; fa := etf.account_id;
  if etf.id is null then raise exception 'No hay ETF'; end if;
  if fa is null then insert into accounts(kind,name,owners) values('business','LA500 ETF · fondo','{}') returning id into fa; update companies set account_id = fa where id = etf.id; end if;
  nav := etf_nav();
  if side = 'buy' then
    total := round(nav * qty, 2);
    perform move_money(acc, fa, total, 'Compra de ETF LA500');
    insert into holdings(character_id,company_id,shares,cost) values(c,etf.id,qty,total)
      on conflict(character_id,company_id) do update set shares=holdings.shares+qty, cost=holdings.cost+total;
    -- invierte 95% en todas las empresas según su valor de mercado
    cap := (select sum(share_price(x.id) * greatest(co_out(x.id),1)) from companies x where x.industry<>'ETF' and x.account_id is not null);
    if cap > 0 then
      for r in select x.id, share_price(x.id) * greatest(co_out(x.id),1) w from companies x where x.industry<>'ETF' and x.account_id is not null loop
        if total * 0.95 * r.w / cap >= 1 then perform etf_invest(r.id, round(total * 0.95 * r.w / cap, 2)); end if;
      end loop;
    end if;
    insert into trades(character_id,company_id,side,qty,price,total) values(c,etf.id,'compra',qty,total/qty,total);
  elsif side = 'sell' then
    select * into h from holdings where character_id=c and company_id=etf.id for update;
    if h.shares is null or h.shares - coalesce(h.locked,0) < qty then raise exception 'No tienes tantos títulos del ETF disponibles'; end if;
    total := round(nav * qty * 0.995, 2);
    outq := (select sum(shares) from holdings where company_id=etf.id and shares>0);
    cash := coalesce((select balance from accounts where id=fa),0);
    if cash < total then
      for r in select company_id from etf_holdings where shares > 0 loop perform etf_redeem(r.company_id, qty / outq); end loop;
      cash := coalesce((select balance from accounts where id=fa),0);
    end if;
    if cash < total then raise exception 'El ETF no consigue liquidez ahora (tiene %, necesita %). Intenta con menos títulos.', round(cash,2), total; end if;
    perform move_money(fa, acc, total, 'Venta de ETF LA500');
    update holdings set cost = round(cost * (shares-qty) / shares, 2), shares = shares - qty where id = h.id;
    insert into trades(character_id,company_id,side,qty,price,total) values(c,etf.id,'venta',qty,total/qty,total);
  else raise exception 'Operación inválida'; end if;
  insert into price_history(company_id, price) values(etf.id, share_price(etf.id));
  return total;
end $$;

-- registra el último precio cada vez que se compra/vende con la empresa o el ETF
create or replace function trades_last_price() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.qty > 0 and new.price > 0 then update companies set last_price = round(new.price, 4), last_trade_at = now() where id = new.company_id; end if;
  return new;
end $$;
drop trigger if exists trades_last on trades;
create trigger trades_last after insert on trades for each row execute function trades_last_price();

-- un trato entre dos jugadores
create or replace function mkt_fill(buyer uuid, seller uuid, company uuid, n int, px numeric, pay numeric, from_escrow bool, seller_locked bool) returns void
language plpgsql security definer set search_path=public as $$
declare nm text := (select name from companies where id=company);
begin
  perform move_money(case when from_escrow then gbm_escrow() else personal_acc(buyer) end, personal_acc(seller), pay, 'Venta de acciones · ' || nm || ' (en bolsa)');
  update holdings set cost = round(cost * (shares - n) / shares, 2), shares = shares - n, locked = case when seller_locked then locked - n else locked end
    where character_id = seller and company_id = company;
  insert into holdings(character_id, company_id, shares, cost) values(buyer, company, n, pay)
    on conflict (character_id, company_id) do update set shares = holdings.shares + n, cost = holdings.cost + pay;
  insert into trades(character_id, company_id, side, qty, price, total) values(buyer, company, 'compra', n, px, pay), (seller, company, 'venta', n, px, pay);
  insert into price_history(company_id, price) values(company, px);
end $$;
revoke all on function mkt_fill(uuid,uuid,uuid,int,numeric,numeric,bool,bool) from public, anon, authenticated;

create or replace function place_order(c uuid, company uuid, side text, qty int, lim numeric default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare co companies; rem int := qty; o orders; n int; fair numeric; pay numeric; spent numeric := 0; acc uuid := personal_acc(c); h holdings; fb numeric := 0;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  if not exists(select 1 from characters where id=c and status='active') then raise exception 'Tu vida debe estar activa'; end if;
  if acc is null then raise exception 'Necesitas tu cuenta personal'; end if;
  if qty is null or qty < 1 then raise exception 'Cantidad inválida'; end if;
  if lim is not null and lim <= 0 then raise exception 'Precio límite inválido'; end if;
  select * into co from companies where id = company for update;
  if co.id is null then raise exception 'Emisora no existe'; end if;
  fair := case when co.industry = 'ETF' then etf_nav() else co_fair(company) end;
  if side = 'buy' then
    for o in select * from orders where company_id = company and orders.side = 'sell' and status = 'open' and character_id <> c
             and limit_price <= coalesce(lim, fair * 1.5) order by limit_price, created_at for update loop
      exit when rem = 0;
      n := least(rem, o.qty - o.filled); pay := round(n * o.limit_price, 2);
      perform mkt_fill(c, o.character_id, company, n, o.limit_price, pay, false, true);
      update orders set filled = filled + n, status = case when o.filled + n >= o.qty then 'filled' else 'open' end where id = o.id;
      rem := rem - n; spent := spent + pay;
    end loop;
    if rem > 0 and lim is null then fb := buy_shares(company, rem, acc); spent := spent + fb; rem := 0;   -- lo que falta lo emite la empresa / crea el ETF
    elsif rem > 0 then
      pay := round(rem * lim, 2);
      perform move_money(acc, gbm_escrow(), pay, 'Orden de compra en espera · ' || co.name);
      insert into orders(character_id, company_id, side, qty, limit_price, escrow_left) values(c, company, 'buy', rem, lim, pay);
    end if;
  elsif side = 'sell' then
    select * into h from holdings where character_id = c and company_id = company for update;
    if coalesce(h.shares, 0) - coalesce(h.locked, 0) < qty then raise exception 'No tienes tantos títulos disponibles'; end if;
    for o in select * from orders where company_id = company and orders.side = 'buy' and status = 'open' and character_id <> c
             and limit_price >= coalesce(lim, fair * 0.5) order by limit_price desc, created_at for update loop
      exit when rem = 0;
      n := least(rem, o.qty - o.filled);
      pay := case when o.filled + n >= o.qty then o.escrow_left else round(n * o.limit_price, 2) end;
      perform mkt_fill(o.character_id, c, company, n, o.limit_price, pay, true, false);
      update orders set filled = filled + n, escrow_left = escrow_left - pay, status = case when o.filled + n >= o.qty then 'filled' else 'open' end where id = o.id;
      rem := rem - n; spent := spent + pay;
    end loop;
    if rem > 0 and lim is null then fb := sell_shares(company, rem, acc); spent := spent + fb; rem := 0;  -- lo que falta lo recompra la empresa / redime el ETF
    elsif rem > 0 then
      update holdings set locked = locked + rem where id = h.id;
      insert into orders(character_id, company_id, side, qty, limit_price) values(c, company, 'sell', rem, lim);
    end if;
  else raise exception 'Operación inválida'; end if;
  return jsonb_build_object('done', qty - rem, 'total', spent, 'waiting', rem, 'from_issuer', fb);
end $$;
grant execute on function place_order(uuid, uuid, text, int, numeric) to authenticated;

create or replace function cancel_order(id uuid) returns void language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  select * into o from orders where orders.id = cancel_order.id for update;
  if o.id is null or o.status <> 'open' then raise exception 'Esa orden ya no está abierta'; end if;
  if not owns_char(o.character_id) then raise exception 'No es tu orden'; end if;
  if o.side = 'buy' and o.escrow_left > 0 then perform move_money(gbm_escrow(), personal_acc(o.character_id), o.escrow_left, 'Orden cancelada: te regresamos tu dinero'); end if;
  if o.side = 'sell' then update holdings set locked = greatest(locked - (o.qty - o.filled), 0) where character_id = o.character_id and company_id = o.company_id; end if;
  update orders set status = 'cancelled', escrow_left = 0 where orders.id = o.id;
end $$;
grant execute on function cancel_order(uuid) to authenticated;

-- dividendos: un dueño reparte dinero de la empresa entre todas las acciones en circulación
create or replace function pay_dividend(company uuid, amount numeric) returns numeric language plpgsql security definer set search_path=public as $$
declare co companies; outq numeric; per numeric; h record; paid numeric := 0; p numeric;
begin
  select * into co from companies where id = company for update;
  if co.id is null or co.industry = 'ETF' then raise exception 'Emisora inválida'; end if;
  if not exists(select 1 from unnest(co.owners) o where owns_char(o)) then raise exception 'Solo un dueño de la empresa reparte dividendos'; end if;
  amount := round(amount, 2); outq := co_out(company);
  if amount is null or amount < 1 or outq <= 0 then raise exception 'Monto inválido'; end if;
  if amount > coalesce((select balance from accounts where id = co.account_id), 0) then raise exception 'La empresa no tiene ese efectivo'; end if;
  per := amount / outq;
  for h in select character_id, shares from holdings where company_id = company and shares > 0 loop
    p := trunc(h.shares * per, 2);
    if p >= 0.01 and personal_acc(h.character_id) is not null then perform move_money(co.account_id, personal_acc(h.character_id), p, 'Dividendo · ' || co.name); paid := paid + p; end if;
  end loop;
  p := trunc(coalesce((select shares from etf_holdings where company_id = company), 0) * per, 2);
  if p >= 0.01 then perform move_money(co.account_id, (select account_id from companies where id = etf_id()), p, 'Dividendo para el ETF · ' || co.name); paid := paid + p; end if;
  insert into dividends(company_id, total, per_share) values(company, paid, round(per, 4));
  return paid;
end $$;
grant execute on function pay_dividend(uuid, numeric) to authenticated;
