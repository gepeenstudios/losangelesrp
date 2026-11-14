-- Una sola cuenta por usuario de Discord (sin importar @, espacios ni mayúsculas)
create unique index if not exists profiles_discord_unico on profiles (lower(trim(leading '@' from trim(discord)))) where coalesce(trim(discord),'') <> '';
-- revisión antes de crear la cuenta (se llama sin sesión)
create or replace function signup_check(u text, d text) returns text language sql stable security definer set search_path=public as $$
  select case
    when exists(select 1 from profiles where username = lower(u)) then 'Ese usuario de la web ya existe'
    when exists(select 1 from profiles where lower(trim(leading '@' from trim(discord))) = lower(trim(leading '@' from trim(d)))) then 'Ese Discord ya tiene una cuenta. Solo se permite una cuenta por Discord.'
  end $$;
grant execute on function signup_check(text, text) to anon, authenticated;
