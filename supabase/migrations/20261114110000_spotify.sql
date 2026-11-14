-- Spotify del rol: canciones que suben los jugadores
create table if not exists songs(
  id uuid primary key default gen_random_uuid(), title text not null, artist text, cover text, url text not null,
  uploader_char uuid references characters on delete set null, created_at timestamptz default now());
alter table songs enable row level security;
drop policy if exists so_sel on songs; create policy so_sel on songs for select to authenticated using (true);
drop policy if exists so_ins on songs; create policy so_ins on songs for insert to authenticated with check (owns_char(uploader_char));
drop policy if exists so_del on songs; create policy so_del on songs for delete to authenticated using (owns_char(uploader_char) or staff_level()>=2);
