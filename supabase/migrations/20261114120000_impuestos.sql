-- Impuestos realistas de Los Ángeles: retención de nómina, sales tax, transferencia, corporativo y predial
-- ---------- Impuestos (IRS federal + California FTB + FICA, sales tax de LA) ----------
create or replace function tax_cfg(k text, d numeric) returns numeric language sql stable as $$
  select coalesce((select (value->>k)::numeric from settings where key='impuestos'), d) $$;
-- impuesto anual sobre un sueldo: federal 2026 + California 2025 (soltero, deducción estándar) + FICA 7.65%
create or replace function income_tax(annual numeric) returns numeric language plpgsql immutable as $$
declare fed numeric := 0; ca numeric := 0; t numeric; lo numeric; r record;
begin
  t := greatest(annual - 16100, 0); lo := 0;
  for r in select * from (values (12400,10),(50400,12),(105700,22),(201775,24),(256225,32),(640600,35),(1e15,37)) b(hi,rate) loop
    fed := fed + greatest(least(t, r.hi) - lo, 0) * r.rate / 100; lo := r.hi; end loop;
  t := greatest(annual - 5706, 0); lo := 0;
  for r in select * from (values (11079,1),(26264,2),(41452,4),(57542,6),(72724,8),(371479,9.3),(445771,10.3),(742953,11.3),(1e15,12.3)) b(hi,rate) loop
    ca := ca + greatest(least(t, r.hi) - lo, 0) * r.rate / 100; lo := r.hi; end loop;
  if annual > 1000000 then ca := ca + (annual - 1000000) * 0.01; end if; -- Mental Health Services Tax
  return round(fed + ca + annual * 0.0765, 2);
end $$;

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
    if buyer is null then raise exception 'Compra acciones con tu cuenta personal'; end if;
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


create or replace function daily_tick() returns text language plpgsql security definer set search_path=public as $$
declare d date := current_date - 1; g uuid := gov_acc(); e record; mins numeric; a uuid; n int := 0; f int := 0;
        minm numeric := coalesce((select (value#>>'{}')::numeric from settings where key='job_min_minutes'),60);
        rate numeric := coalesce((select (value#>>'{}')::numeric from settings where key='fed_rate'),4.5); acc record;
begin
  perform election_tick();
  if coalesce((select (value#>>'{}')::date from settings where key='last_tick'),'1970-01-01') >= current_date then return 'ya corrió hoy'; end if;
  insert into settings values('last_tick', to_jsonb(current_date::text)) on conflict(key) do update set value=excluded.value;
  update employments set status='active', vacation_until=null where status='vacation' and vacation_until < d;
  for e in select em.*, r.salary from employments em join dept_ranks r on r.dept=em.dept and r.rank=em.rank
           join characters c on c.id=em.character_id where em.status<>'fired' and c.status='active' loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),(d+1)::timestamptz) - greatest(started_at,d::timestamptz))/60),0)
      into mins from work_shifts where character_id=e.character_id and dept=e.dept and started_at < (d+1)::timestamptz and coalesce(ended_at,now()) > d::timestamptz;
    if e.status='vacation' or mins >= minm then
      update employments set last_qualified=d where id=e.id;
      a := personal_acc(e.character_id);
      if a is not null then
        begin perform move_money(g, a, round((e.salary*cpi() - income_tax(e.salary*cpi()))/365,2), 'Nómina neta · '||e.dept||' · '||e.rank||' (ya con retención de impuestos)'); n := n+1;
        exception when others then null; end;
      end if;
    elsif e.last_qualified < d - 6 then
      update employments set status='fired' where id=e.id;
  perform set_config('app.trusted','on',true);
      update characters set roles = array_remove(roles, e.dept) where id=e.character_id; f := f+1;
    end if;
  end loop;
  insert into price_history(company_id,price) select id, share_price(id) from companies;
  for acc in select id, balance from accounts where kind='savings' and balance > 0 loop
    begin perform move_money(g, acc.id, round(acc.balance*rate/100/365,2), 'Intereses de ahorro'); exception when others then null; end;
  end loop;
  -- los negocios del rol no venden de verdad: el gobierno les paga según su giro (dueño con vida activa)
  for acc in select co.account_id, co.industry from companies co where co.account_id is not null
             and exists(select 1 from characters ch where ch.id = any(co.owners) and ch.status='active') loop
    begin perform move_money(g, acc.account_id, round(coalesce((select (value->>acc.industry)::numeric from settings where key='biz_income'),400)*cpi()*(1 - tax_cfg('corp', 29.84)/100),2),
      'Ingresos del negocio · '||coalesce(acc.industry,'')||' (neto de impuesto corporativo)'); exception when others then null; end;
  end loop;
  -- impuesto predial (property tax de LA): % anual del valor, cobrado por día a cada dueño
  for acc in select pr.price, pr.name, coalesce(personal_acc(pr.owner_char),(select account_id from companies where id=pr.owner_company)) a
             from properties pr where pr.owner_char is not null or pr.owner_company is not null loop
    if acc.a is not null then begin perform move_money(acc.a, g, round(acc.price*cpi()*tax_cfg('property', 1.2)/100/365,2), 'Impuesto predial · '||acc.name); exception when others then null; end; end if;
  end loop;
  -- el staff también cobra por moderar: sueldo anual ÷ 365 si estuvo en servicio el mínimo del día (a su primera vida activa)
  for acc in select p.id, p.staff_role from profiles p where p.staff_role is not null loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),(d+1)::timestamptz) - greatest(started_at,d::timestamptz))/60),0)
      into mins from shifts where user_id=acc.id and started_at < (d+1)::timestamptz and coalesce(ended_at,now()) > d::timestamptz;
    a := (select personal_acc(c.id) from characters c where c.user_id=acc.id and c.status='active' order by c.created_at limit 1);
    if mins >= coalesce((select (value#>>'{}')::numeric from settings where key='staff_min_minutes'),30) and a is not null then
      declare y numeric := coalesce((select (value->>acc.staff_role)::numeric from settings where key='staff_salary'),40000)*cpi(); begin
        perform move_money(g, a, round((y - income_tax(y))/365,2), 'Nómina neta · Staff · '||acc.staff_role||' (ya con retención de impuestos)'); n := n+1; exception when others then null; end;
    end if;
  end loop;
  return n||' pagos, '||f||' despidos';
end $$;
