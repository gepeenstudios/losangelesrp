-- 911: los ciudadanos llaman a Policía, Ambulancia o Bomberos; a los que están en ese servicio les llega la alerta y la atienden.
create table if not exists calls911(id uuid primary key default gen_random_uuid(), caller_char uuid references characters on delete set null,
  service text not null check (service in ('policia','ems','bomberos')), location text not null check (length(location) between 2 and 120),
  description text not null check (length(description) between 3 and 500), anonymous boolean not null default false,
  status text not null default 'abierta' check (status in ('abierta','en_camino','cerrada','cancelada')), responders uuid[] not null default '{}',
  note text, created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists calls911_open on calls911(status, created_at desc);
alter table calls911 enable row level security;
create or replace function can_respond(service text) returns boolean language sql stable security definer set search_path=public as $$
  select staff_level() >= 2 or case service
    when 'policia' then my_tags() && array['Policía','SWAT','FBI','DEA','CIA','US Seal','US Navy Seal','Servicio Secreto','Seguridad Pública']
    when 'ems' then my_tags() && array['Servicios Médicos']
    when 'bomberos' then my_tags() && array['Bomberos'] else false end $$;
drop policy if exists c9_sel on calls911; create policy c9_sel on calls911 for select to authenticated using (owns_char(caller_char) or can_respond(service));
drop policy if exists c9_ins on calls911; create policy c9_ins on calls911 for insert to authenticated with check (owns_char(caller_char));
-- al llamar: siempre entra abierta y sin respondientes; máximo 3 llamadas cada 10 minutos por vida (anti-spam)
create or replace function calls911_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.status := 'abierta'; new.responders := '{}'; new.note := null; new.created_at := now(); new.updated_at := now();
  if (select count(*) from calls911 where caller_char = new.caller_char and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Ya hiciste 3 llamadas en 10 minutos. Espera un poco: las llamadas falsas son delito (Art. 63).'; end if;
  return new;
end $$;
drop trigger if exists t_calls911 on calls911; create trigger t_calls911 before insert on calls911 for each row execute function calls911_guard();
-- atender: 'go' = voy en camino, 'close' = cerrar con nota, 'cancel' = quien llamó la cancela
create or replace function respond_call(cid uuid, act text, c uuid default null, note text default null) returns void language plpgsql security definer set search_path=public as $$
declare k calls911;
begin
  select * into k from calls911 where id = cid for update; if k.id is null then raise exception 'La llamada no existe'; end if;
  if act = 'cancel' then
    if not owns_char(k.caller_char) then raise exception 'Solo quien llamó puede cancelarla'; end if;
    if k.status in ('cerrada','cancelada') then return; end if;
    update calls911 set status = 'cancelada', updated_at = now() where id = cid; return;
  end if;
  if not can_respond(k.service) then raise exception 'No estás en ese servicio de emergencia'; end if;
  if k.status in ('cerrada','cancelada') then raise exception 'Esa llamada ya terminó'; end if;
  if act = 'go' then
    if not owns_char(c) then raise exception 'No es tu vida'; end if;
    update calls911 set status = 'en_camino', responders = array(select distinct unnest(responders || c)), updated_at = now() where id = cid;
  elsif act = 'close' then
    update calls911 set status = 'cerrada', note = nullif(trim(coalesce(respond_call.note, '')), ''), updated_at = now() where id = cid;
  else raise exception 'Acción inválida'; end if;
end $$;
grant execute on function respond_call(uuid, text, uuid, text) to authenticated;
do $$ begin execute 'alter publication supabase_realtime add table calls911'; exception when others then null; end $$;
