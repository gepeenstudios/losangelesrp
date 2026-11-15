-- Bolsa como en la vida real (arregla el fraude de comprar acciones infinitas y meter dinero a la empresa):
-- * El precio = valor en libros ÷ acciones en circulación (las que tienen los jugadores) × prima de mercado.
-- * Al registrar la empresa, el dueño recibe todas sus acciones. Comprar = la empresa emite acciones nuevas (el dinero entra a la empresa);
--   vender = la empresa recompra (paga con SU efectivo; si no tiene, no se puede). El gobierno ya no pone ni recibe nada.
-- * Comprar sube la prima y vender la baja (oferta y demanda); la prima regresa sola a 1 con los días (20% diario).
alter table companies add column if not exists premium numeric not null default 1, add column if not exists premium_at timestamptz not null default now();

create or replace function co_book(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select coalesce((select balance from accounts where id=co.account_id),0)
       + coalesce((select sum(price) from properties where owner_company=co.id),0)
       + coalesce((select sum(m.price) from vehicles v join vehicle_models m on m.id=v.model_id where v.owner_company=co.id),0)
  from companies co where co.id=c $$;
create or replace function co_out(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select coalesce(sum(shares),0) from holdings where company_id=c and shares>0 $$;
create or replace function co_premium(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select 1 + (premium - 1) * power(0.8, extract(epoch from now() - premium_at) / 86400) from companies where id=c $$;

create or replace function share_price(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select case when co.industry='ETF' then coalesce((select round(avg(share_price(x.id))*10,2) from companies x where x.industry<>'ETF'),10)
  else greatest(0.01, round(co_book(co.id) / greatest(case when co_out(co.id) > 0 then co_out(co.id) else co.shares_total end, 1) * co_premium(co.id), 2)) end
  from companies co where co.id=c $$;

-- el dueño recibe todas las acciones al registrar su empresa
create or replace function co_founder_shares() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.industry <> 'ETF' and cardinality(new.owners) > 0 then
    insert into holdings(character_id, company_id, shares, cost) values(new.owners[1], new.id, greatest(new.shares_total, 1), 0) on conflict (character_id, company_id) do nothing;
  end if; return new;
end $$;
drop trigger if exists companies_founder on companies;
create trigger companies_founder after insert on companies for each row execute function co_founder_shares();
-- empresas que ya existían: el dueño recibe las acciones que falten para completar el total
insert into holdings(character_id, company_id, shares, cost)
  select co.owners[1], co.id, co.shares_total - co_out(co.id), 0 from companies co
  where co.industry <> 'ETF' and cardinality(co.owners) > 0 and co_out(co.id) < co.shares_total
  on conflict (character_id, company_id) do update set shares = holdings.shares + excluded.shares;

-- compra de acciones: la empresa emite títulos nuevos
create or replace function buy_shares(company uuid, qty int, acc uuid) returns numeric language plpgsql security definer set search_path=public as $$
declare co companies; buyer uuid; q int := qty; out_ numeric; ps numeric; p0 numeric; p1 numeric; total numeric;
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select owners[1] into buyer from accounts where id=acc and kind='personal';
  if buyer is null then raise exception 'Compra acciones con tu cuenta personal'; end if;
  if q is null or q < 1 then raise exception 'Cantidad inválida'; end if;
  select * into co from companies where id=company for update;
  if co.id is null then raise exception 'Empresa no existe'; end if;
  if co.industry = 'ETF' then raise exception 'El ETF ya no acepta compras nuevas'; end if;
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

-- venta: la empresa recompra con su propio efectivo (el ETF viejo lo sigue pagando la Tesorería, que fue quien recibió ese dinero)
create or replace function sell_shares(company uuid, qty int, acc uuid) returns numeric language plpgsql security definer set search_path=public as $$
declare c uuid; co companies; h holdings; out_ numeric; ps numeric; p0 numeric; p1 numeric; total numeric; cash numeric;
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select owners[1] into c from accounts where id=acc and kind='personal';
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

-- buy('shares') ahora usa buy_shares
create or replace function buy(kind text, item uuid, acc uuid, qty int default 1) returns numeric
language plpgsql security definer set search_path=public as $$
declare a accounts; co companies; buyer uuid; price numeric; seller uuid;
        p properties; m vehicle_models; v vehicles; q int := greatest(coalesce(qty,1),1);
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select * into a from accounts where id=acc;
  if a.kind='business' then select * into co from companies where account_id=acc; else buyer := a.owners[1]; end if;
  if kind='property' then
    select * into p from properties where id=item for update;
    if not found or not p.for_sale then raise exception 'No está en venta'; end if;
    if p.owner_char is null and p.owner_company is null then
      seller := gov_acc(); price := round(p.price * cpi() * case when co.industry='Bienes Raíces' then 0.5 else 1 end, 2);
    else
      price := p.sale_price;
      seller := coalesce(personal_acc(p.owner_char),(select account_id from companies where id=p.owner_company));
    end if;
    update properties set owner_char=buyer, owner_company=co.id, for_sale=false, sale_price=null where id=item;
  elsif kind='model' then
    select * into m from vehicle_models where id=item;
    if not found then raise exception 'Modelo no existe'; end if;
    if co.id is null then q := 1; end if;
    price := m.price * cpi() * q * case when co.industry='Concesionaria' and lower(co.brand)=lower(m.brand) then 0.1
                                when co.industry='Concesionaria' then 0.3 else 1 end;
    seller := gov_acc();
    insert into vehicles(model_id,owner_char,owner_company) select item, buyer, co.id from generate_series(1,q);
  elsif kind='vehicle' then
    select * into v from vehicles where id=item for update;
    if not found or v.sale_price is null then raise exception 'No está en venta'; end if;
    price := v.sale_price;
    seller := coalesce(personal_acc(v.owner_char),(select account_id from companies where id=v.owner_company));
    update vehicles set owner_char=buyer, owner_company=co.id, sale_price=null, plate=null where id=item;
  elsif kind='shares' then
    return buy_shares(item, q, acc);
    price := share_price(item) * q;
    seller := (select case when industry='ETF' then gov_acc() else account_id end from companies where id=item);
    insert into holdings(character_id,company_id,shares,cost) values(buyer,item,q,price)
      on conflict(character_id,company_id) do update set shares=holdings.shares+q, cost=holdings.cost+price;
    insert into trades(character_id,company_id,side,qty,price,total) values(buyer,item,'compra',q,price/q,price);
  else raise exception 'Tipo inválido'; end if;
  if seller = acc then raise exception 'Ya es tuyo'; end if;
  if kind='shares' then perform move_money(acc, seller, price, 'Compra de acciones'); insert into price_history(company_id,price) values(item, share_price(item)); return price; end if;
  perform move_money(acc, seller, price, 'Compra · '||case kind when 'property' then 'casa' when 'model' then 'auto nuevo' when 'vehicle' then 'auto usado' else 'acciones' end);
  -- impuestos que cobra el gobierno sobre la compra (las concesionarias no pagan sales tax al surtir inventario, como en la vida real)
  declare tax numeric := 0; lbl text; begin
    if kind in ('model','vehicle') and coalesce(co.industry,'') <> 'Concesionaria' then
      tax := round(price * tax_cfg('sales', 10.25) / 100, 2); lbl := 'Impuesto sobre ventas (Sales Tax LA)';
    elsif kind = 'property' and seller <> gov_acc() then
      tax := round(price * tax_cfg('transfer', 0.56) / 100, 2); lbl := 'Impuesto de transferencia de inmueble';
    end if;
    if tax > 0 then perform move_money(acc, gov_acc(), tax, lbl); end if;
    return price + tax;
  end;
end $$;
