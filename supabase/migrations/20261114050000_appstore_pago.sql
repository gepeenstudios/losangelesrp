-- Pagar al gobierno desde la cuenta personal de una vida (permisos con costo, p. ej. publicar una app)
create or replace function pay_gov(c uuid, amount numeric, concept text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not owns_char(c) then raise exception 'No es tu vida'; end if;
  if amount <= 0 then raise exception 'Monto inválido'; end if;
  perform move_money(personal_acc(c), gov_acc(), amount, concept);
end $$;
-- Solo el Owner publica apps (los jugadores la piden pagando el permiso y el Owner la sube)
drop policy if exists sa_ins on store_apps;
create policy sa_ins on store_apps for insert to authenticated with check (staff_level() >= 5);
