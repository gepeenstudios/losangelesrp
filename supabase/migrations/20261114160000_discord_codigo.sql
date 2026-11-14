-- Verificación de Discord al registrarse: el bot manda un código de 6 dígitos por DM, dura 5 minutos.
create or replace function dnorm(t text) returns text language sql immutable as $$ select lower(trim(leading '@' from trim(coalesce(t,'')))) $$;
create table if not exists discord_codes(discord text primary key, code_hash text not null, expires_at timestamptz not null,
  attempts int not null default 0, verified_at timestamptz, created_at timestamptz not null default now());
alter table discord_codes enable row level security; -- sin políticas: solo las funciones de abajo la tocan

-- la llama la función de Netlify (con la llave del bot) justo antes de mandar el DM
create or replace function discord_code_issue(bot_key text, d text, code text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from bot_keys where key_hash = encode(sha256(convert_to(coalesce(bot_key,''),'UTF8')),'hex')) then raise exception 'Llave del bot inválida'; end if;
  if exists(select 1 from profiles where dnorm(discord) = dnorm(d)) then raise exception 'Ese Discord ya tiene una cuenta. Solo se permite una cuenta por Discord.'; end if;
  if exists(select 1 from discord_codes where discord = dnorm(d) and created_at > now() - interval '60 seconds') then raise exception 'Espera un minuto antes de pedir otro código.'; end if;
  insert into discord_codes(discord, code_hash, expires_at) values(dnorm(d), encode(sha256(convert_to(code,'UTF8')),'hex'), now() + interval '5 minutes')
  on conflict(discord) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, verified_at = null, created_at = now();
end $$;
revoke execute on function discord_code_issue(text,text,text) from public; grant execute on function discord_code_issue(text,text,text) to anon;

-- la llama la web al registrarse; 5 intentos máximo por código
create or replace function discord_code_verify(d text, code text) returns boolean language plpgsql security definer set search_path=public as $$
declare r discord_codes;
begin
  select * into r from discord_codes where discord = dnorm(d);
  if r is null then raise exception 'Primero pide tu código con «Enviarme código por Discord».'; end if;
  if r.expires_at < now() then raise exception 'Tu código expiró (dura 5 minutos). Pide uno nuevo.'; end if;
  if r.attempts >= 5 then raise exception 'Demasiados intentos. Pide un código nuevo.'; end if;
  if r.code_hash = encode(sha256(convert_to(trim(code),'UTF8')),'hex') then update discord_codes set verified_at = now() where discord = r.discord; return true; end if;
  update discord_codes set attempts = attempts + 1 where discord = r.discord; return false;
end $$;
grant execute on function discord_code_verify(text,text) to anon, authenticated;

-- nadie crea cuenta sin Discord verificado (salvo que el bot aún no esté configurado)
create or replace function profiles_discord_verificado() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from bot_keys) and not exists(select 1 from discord_codes where discord = dnorm(new.discord) and verified_at > now() - interval '30 minutes')
    then raise exception 'Verifica tu Discord con el código que te manda el bot.'; end if;
  return new;
end $$;
drop trigger if exists t_profiles_discord on profiles;
create trigger t_profiles_discord before insert on profiles for each row execute function profiles_discord_verificado();
