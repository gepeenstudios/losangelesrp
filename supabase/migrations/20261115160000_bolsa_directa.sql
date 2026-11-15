-- Bolsa directa (sin libro de órdenes): compras y vendes al momento con la empresa (o el ETF), al precio justo.
-- El precio que ves es el que pagas. Se cancelan las órdenes que estaban esperando y se regresa todo.
do $$ declare o record;
begin
  for o in select * from orders where status = 'open' loop
    if o.side = 'buy' and o.escrow_left > 0 then perform move_money(gbm_escrow(), personal_acc(o.character_id), o.escrow_left, 'Orden cancelada: te regresamos tu dinero'); end if;
    if o.side = 'sell' then update holdings set locked = greatest(locked - (o.qty - o.filled), 0) where character_id = o.character_id and company_id = o.company_id; end if;
    update orders set status = 'cancelled', escrow_left = 0 where id = o.id;
  end loop;
end $$;
update holdings set locked = 0 where locked <> 0;
drop function if exists place_order(uuid, uuid, text, int, numeric);
drop trigger if exists trades_last on trades;
update companies set last_price = null;

create or replace function share_price(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select case when co.industry='ETF' then round(etf_nav(), 2) else co_fair(co.id) end from companies co where co.id=c $$;
