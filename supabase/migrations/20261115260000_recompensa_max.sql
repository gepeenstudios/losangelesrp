-- Recompensa máxima: $1,000,000,000 (mil millones)
create or replace function bounty(r records) returns numeric language sql stable as $$
  select least(greatest(game_day() - game_day(r.created_at), 0) + coalesce(r.bounty_extra, 0), 1000000000) $$;
create or replace function raise_bounty(rec uuid, amount numeric) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_police() then raise exception 'Solo la policía'; end if;
  if amount is null or amount <= 0 then raise exception 'Monto inválido'; end if;
  update records set bounty_extra = least(coalesce(bounty_extra,0) + raise_bounty.amount, 1000000000) where id = rec and kind = 'orden' and not paid;
  if not found then raise exception 'Esa orden ya no está activa'; end if;
end $$;
