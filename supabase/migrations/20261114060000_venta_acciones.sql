-- Vender acciones aunque la empresa tenga su dinero en autos o casas (la Tesorería compra)
create or replace function sell_shares(company uuid, qty int, acc uuid) returns numeric
language plpgsql security definer set search_path=public as $$
declare c uuid; price numeric; h holdings;
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select owners[1] into c from accounts where id=acc and kind='personal';
  select * into h from holdings where character_id=c and company_id=company for update;
  if h.shares is null or h.shares < qty or qty < 1 then raise exception 'No tienes tantas acciones'; end if;
  price := share_price(company) * qty;
  -- paga la empresa; si es el ETF o la empresa no tiene efectivo (lo tiene en autos/casas), la Tesorería actúa como formador de mercado
  perform move_money((select case when co.industry='ETF' or co.account_id is null or coalesce((select balance from accounts where id=co.account_id),0) < price
                                  then gov_acc() else co.account_id end from companies co where co.id=company), acc, price, 'Venta de acciones');
  update holdings set cost = round(cost * (shares-qty) / shares, 2), shares=shares-qty where id=h.id;
  insert into trades(character_id,company_id,side,qty,price,total) values(c,company,'venta',qty,price/qty,price);
  insert into price_history(company_id,price) values(company, share_price(company));
  return price;
end $$;
