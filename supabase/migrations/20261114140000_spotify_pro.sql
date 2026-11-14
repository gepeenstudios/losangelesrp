-- Spotify: cuentas, géneros, me gusta, playlists y Jams (escuchar juntos)
alter table songs add column if not exists genre text;
create table if not exists sp_profiles(character_id uuid primary key references characters on delete cascade, name text not null, avatar text, bio text, color text default '#1db954', created_at timestamptz default now());
create table if not exists song_likes(song_id uuid references songs on delete cascade, character_id uuid references characters on delete cascade, primary key(song_id, character_id));
create table if not exists playlists(id uuid primary key default gen_random_uuid(), owner_char uuid references characters on delete cascade, name text not null, cover text, songs uuid[] default '{}', created_at timestamptz default now());
create table if not exists jams(id uuid primary key default gen_random_uuid(), code text unique not null, host_char uuid references characters on delete cascade, members uuid[] default '{}',
  song_id uuid, playing bool default false, position numeric default 0, updated_at timestamptz default now(), created_at timestamptz default now());
alter table sp_profiles enable row level security; alter table song_likes enable row level security; alter table playlists enable row level security; alter table jams enable row level security;
drop policy if exists spp_sel on sp_profiles; create policy spp_sel on sp_profiles for select to authenticated using (true);
drop policy if exists spp_all on sp_profiles; create policy spp_all on sp_profiles for all to authenticated using (owns_char(character_id)) with check (owns_char(character_id));
drop policy if exists sl_sel on song_likes; create policy sl_sel on song_likes for select to authenticated using (true);
drop policy if exists sl_all on song_likes; create policy sl_all on song_likes for all to authenticated using (owns_char(character_id)) with check (owns_char(character_id));
drop policy if exists pl_sel2 on playlists; create policy pl_sel2 on playlists for select to authenticated using (true);
drop policy if exists pl_all2 on playlists; create policy pl_all2 on playlists for all to authenticated using (owns_char(owner_char)) with check (owns_char(owner_char));
drop policy if exists jm_sel on jams; create policy jm_sel on jams for select to authenticated using (exists(select 1 from unnest(members) m where owns_char(m)));
drop policy if exists jm_ins on jams; create policy jm_ins on jams for insert to authenticated with check (owns_char(host_char));
drop policy if exists jm_upd on jams; create policy jm_upd on jams for update to authenticated using (exists(select 1 from unnest(members) m where owns_char(m)));
drop policy if exists jm_del on jams; create policy jm_del on jams for delete to authenticated using (owns_char(host_char));
-- solo cambia la hora cuando cambia lo que suena; unirse no debe mover el segundo de la Jam
create or replace function jams_touch() returns trigger language plpgsql as $$ begin
  new.updated_at := case when (new.song_id, new.playing, new.position) is distinct from (old.song_id, old.playing, old.position) then now() else old.updated_at end;
  return new; end $$;
drop trigger if exists t_jams on jams; create trigger t_jams before update on jams for each row execute function jams_touch();
-- unirse con el código que te pasan
create or replace function join_jam(jam_code text, c uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare j uuid;
begin
  if not owns_char(c) then raise exception 'No es tu vida'; end if;
  update jams set members = array_append(array_remove(members, c), c) where code = upper(trim(jam_code)) returning id into j;
  if j is null then raise exception 'No existe una Jam con ese código'; end if;
  return j;
end $$;
-- hora del servidor (para que todos vayan al mismo segundo)
create or replace function server_now() returns timestamptz language sql stable as $$ select now() $$;
do $$ begin execute 'alter publication supabase_realtime add table jams'; exception when others then null; end $$;
