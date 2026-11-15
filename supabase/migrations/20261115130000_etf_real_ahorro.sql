-- 1) Cuenta de ahorro: 15% anual (configurable en settings.savings_rate), pagado por día del juego.
-- 2) ETF LA500 como fondo real: con tu dinero compra acciones de todas las empresas (según su tamaño); al vender, el fondo
--    paga con su efectivo y, si no alcanza, revende parte de sus acciones a las empresas. El gobierno ya no participa.
insert into settings values('savings_rate','15') on conflict(key) do nothing;

create or replace function daily_tick() returns text language plpgsql security definer set search_path=public as $$
declare last date; d date; g uuid := gov_acc(); e record; n int := 0; f int := 0; k int := 0;
        rate numeric := coalesce((select (value#>>'{}')::numeric from settings where key='savings_rate'),15); acc record;
begin
  perform election_tick();
  last := coalesce((select (value#>>'{}')::date from settings where key='last_gday'), game_day() - 1);
  if last >= game_day() - 1 then return 'ya corrió este día del juego'; end if;
  update employments set status='active', vacation_until=null where status='vacation' and vacation_until < current_date;
  perform set_config('app.trusted','on',true);
  update characters c set roles = (select coalesce(array_agg(r),'{}') from unnest(c.roles) r where not (coalesce(c.role_expiry,'{}') ? r and (c.role_expiry->>r)::timestamptz < now()))
   where exists(select 1 from jsonb_each_text(coalesce(c.role_expiry,'{}')) x where x.value::timestamptz < now());
  d := greatest(last, game_day() - 37);   -- si nadie entró en días, se ponen al corriente hasta 36 días del juego (3 días reales)
  while d < game_day() - 1 loop
    d := d + 1; k := k + 1;
    n := n + pay_day(d);   -- lo que no se cobró al momento (pay_now) se paga aquí, una sola vez
    for acc in select id, balance from accounts where kind='savings' and balance > 0 loop
      begin perform move_money(g, acc.id, round(acc.balance*rate/100/365,2), 'Intereses de ahorro'); exception when others then null; end;
    end loop;
    for acc in select co.account_id, co.industry from companies co where co.account_id is not null
               and exists(select 1 from characters ch where ch.id = any(co.owners) and ch.status='active') loop
      begin perform move_money(g, acc.account_id, round(coalesce((select (value->>acc.industry)::numeric from settings where key='biz_income'),400)*cpi()*(1 - tax_cfg('corp', 29.84)/100),2),
        'Ingresos del negocio · '||coalesce(acc.industry,'')||' (neto de impuesto corporativo)'); exception when others then null; end;
    end loop;
    for acc in select pr.price, pr.name, coalesce(personal_acc(pr.owner_char),(select account_id from companies where id=pr.owner_company)) a
               from properties pr where pr.owner_char is not null or pr.owner_company is not null loop
      if acc.a is not null then begin perform move_money(acc.a, g, round(acc.price*cpi()*tax_cfg('property', 1.2)/100/365,2), 'Impuesto predial · '||acc.name); exception when others then null; end; end if;
    end loop;
  end loop;
  -- despido por no trabajar en 84 días del juego (1 semana real)
  for e in select em.* from employments em join characters c on c.id=em.character_id where em.status not in ('fired','vacation') and c.status='active' and em.last_qualified < game_day() - 84 loop
    update employments set status='fired' where id=e.id;
    perform set_config('app.trusted','on',true);
    update characters set roles = array_remove(roles, e.dept) where id=e.character_id; f := f+1;
  end loop;
  insert into price_history(company_id,price) select id, share_price(id) from companies;
  insert into settings values('last_gday', to_jsonb(d::text)) on conflict(key) do update set value=excluded.value;
  return k||' días del juego cerrados · '||n||' pagos · '||f||' despidos';
end $$;

create table if not exists etf_holdings(company_id uuid primary key references companies on delete cascade, shares numeric not null default 0);
alter table etf_holdings enable row level security;
drop policy if exists eh_sel on etf_holdings; create policy eh_sel on etf_holdings for select to authenticated using (true);

-- las acciones que tiene el fondo también están en circulación
create or replace function co_out(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select coalesce((select sum(shares) from holdings where company_id=c and shares>0),0) + coalesce((select shares from etf_holdings where company_id=c),0) $$;

create or replace function etf_id() returns uuid language sql stable security definer set search_path=public as $$
  select id from companies where industry='ETF' order by created_at limit 1 $$;

-- valor por título del ETF = (efectivo del fondo + valor de sus acciones) ÷ títulos del ETF en manos de jugadores
create or replace function etf_nav() returns numeric language sql stable security definer set search_path=public as $$
  select case when coalesce((select sum(shares) from holdings where company_id=etf_id() and shares>0),0) <= 0 then 10 else
    greatest(0.01, round((coalesce((select balance from accounts where id=(select account_id from companies where id=etf_id())),0)
      + coalesce((select sum(e.shares * share_price(e.company_id)) from etf_holdings e where e.shares > 0),0))
      / (select sum(shares) from holdings where company_id=etf_id() and shares>0), 4)) end $$;

create or replace function share_price(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select case when co.industry='ETF' then round(etf_nav(), 2)
  else greatest(0.01, round(co_book(co.id) / greatest(case when co_out(co.id) > 0 then co_out(co.id) else co.shares_total end, 1) * co_premium(co.id), 2)) end
  from companies co where co.id=c $$;

-- el fondo compra acciones nuevas de una empresa con hasta «budget» dólares
create or replace function etf_invest(company uuid, budget numeric) returns numeric language plpgsql security definer set search_path=public as $$
declare co companies; out_ numeric; ps numeric; p0 numeric; q numeric; cost numeric; src uuid := (select account_id from companies where id=etf_id());
begin
  select * into co from companies where id=company for update;
  out_ := greatest(co_out(company), 1); ps := greatest(co_book(company) / out_, 0.01); p0 := co_premium(company);
  q := floor(budget / (ps * p0));
  loop
    exit when q < 1;
    cost := round(ps * (p0 + least(p0 * exp(q / out_), 5)) / 2 * q, 2);
    exit when cost <= budget;
    q := floor(q * 0.9);
  end loop;
  if q < 1 then return 0; end if;
  perform move_money(src, co.account_id, cost, 'ETF LA500 compra acciones · ' || co.name);
  update companies set premium = least(p0 * exp(q / out_), 5), premium_at = now() where id = company;
  insert into etf_holdings values(company, q) on conflict (company_id) do update set shares = etf_holdings.shares + q;
  insert into price_history(company_id, price) values(company, share_price(company));
  return cost;
end $$;

-- el fondo revende a la empresa una fracción de sus acciones (si la empresa tiene efectivo)
create or replace function etf_redeem(company uuid, frac numeric) returns numeric language plpgsql security definer set search_path=public as $$
declare co companies; e etf_holdings; q numeric; out_ numeric; ps numeric; p0 numeric; p1 numeric; total numeric; dst uuid := (select account_id from companies where id=etf_id());
begin
  select * into e from etf_holdings where company_id = company for update;
  q := least(e.shares, ceil(e.shares * frac)); if q is null or q < 1 then return 0; end if;
  select * into co from companies where id=company for update;
  out_ := greatest(co_out(company), 1); ps := greatest(co_book(company) / out_, 0); p0 := co_premium(company); p1 := greatest(p0 * exp(-q / out_), 0.2);
  total := round(ps * (p0 + p1) / 2 * q, 2);
  if total <= 0 or total > coalesce((select balance from accounts where id=co.account_id),0) then return 0; end if;
  perform move_money(co.account_id, dst, total, 'ETF LA500 vende acciones · ' || co.name);
  update companies set premium = p1, premium_at = now() where id = company;
  update etf_holdings set shares = shares - q where company_id = company;
  return total;
end $$;
revoke all on function etf_invest(uuid, numeric) from public, anon, authenticated;
revoke all on function etf_redeem(uuid, numeric) from public, anon, authenticated;

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
    if h.shares is null or h.shares < qty then raise exception 'No tienes tantos títulos del ETF'; end if;
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
grant execute on function etf_trade(text, int, uuid) to authenticated;

-- compra/venta de ETF desde las funciones de siempre
create or replace function buy_shares(company uuid, qty int, acc uuid) returns numeric language plpgsql security definer set search_path=public as $$
declare co companies; buyer uuid; q int := qty; out_ numeric; ps numeric; p0 numeric; p1 numeric; total numeric;
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select owners[1] into buyer from accounts where id=acc and kind='personal';
  if buyer is null then raise exception 'Compra acciones con tu cuenta personal'; end if;
  if q is null or q < 1 then raise exception 'Cantidad inválida'; end if;
  select * into co from companies where id=company for update;
  if co.id is null then raise exception 'Empresa no existe'; end if;
  if co.industry = 'ETF' then return etf_trade('buy', q, acc); end if;
  if co.account_id = acc then raise exception 'Ya es tuyo'; end if;
  out_ := greatest(co_out(company), 1); ps := co_book(company) / out_;
  p0 := co_premium(company); p1 := least(p0 * exp(q / out_), 5);
  total := round(greatest(ps, 0.01) * (p0 + p1) / 2 * q, 2);
  perform move_money(acc, co.account_id, total, 'Compra de acciones · ' || co.name);
  update companies set premium = p1, premium_at = now() where id = company;
  insert into holdings(character_id,company_id,shares,cost) values(buyer,company,q,total)
    on conflict(character_id,company_id) do update set shares=holdings.shares+q, cost=holdings.cost+total;
  insert into trades(character_id,company_id,side,qty,price,total) values(buyer,company,'compra',q,total/q,total);
  insert into price_history(company_id,price) values(company, share_price(company));
  return total;
end $$;

create or replace function sell_shares(company uuid, qty int, acc uuid) returns numeric language plpgsql security definer set search_path=public as $$
declare c uuid; co companies; h holdings; out_ numeric; ps numeric; p0 numeric; p1 numeric; total numeric; cash numeric;
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select owners[1] into c from accounts where id=acc and kind='personal';
  if (select industry from companies where id=company) = 'ETF' then return etf_trade('sell', qty, acc); end if;
  select * into h from holdings where character_id=c and company_id=company for update;
  if h.shares is null or h.shares < qty or qty < 1 then raise exception 'No tienes tantas acciones'; end if;
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

-- el ETF necesita su propia cuenta; lo que la Tesorería cobró por ETF pasa al fondo para respaldar a quien ya tenía títulos
do $$ declare e companies; a uuid; net numeric;
begin
  select * into e from companies where industry='ETF' order by created_at limit 1;
  if e.id is null then return; end if;
  if e.account_id is null then
    insert into accounts(kind,name,owners) values('business','LA500 ETF · fondo','{}') returning id into a;
    update companies set account_id = a where id = e.id;
  else a := e.account_id; end if;
  net := greatest(coalesce((select sum(case when side='compra' then total else -total end) from trades where company_id=e.id),0), 0);
  net := least(net, coalesce((select balance from accounts where id=gov_acc()),0));
  if net > 0 then perform move_money(gov_acc(), a, net, 'Traspaso de reservas al ETF LA500'); end if;
end $$;
