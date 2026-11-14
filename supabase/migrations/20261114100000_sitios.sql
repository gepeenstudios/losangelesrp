-- Sitios web que crean los jugadores (Google Sites del rol)
create table if not exists sites(
  id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null, tagline text, body text,
  color text default '#1a73e8', img text, owner_char uuid references characters on delete cascade, created_at timestamptz default now());
alter table sites enable row level security;
drop policy if exists si_sel on sites; create policy si_sel on sites for select to authenticated using (true);
drop policy if exists si_ins on sites; create policy si_ins on sites for insert to authenticated with check (owns_char(owner_char) and slug ~ '^[a-z0-9-]{3,40}$');
drop policy if exists si_upd on sites; create policy si_upd on sites for update to authenticated using (owns_char(owner_char) or staff_level()>=3);
drop policy if exists si_del on sites; create policy si_del on sites for delete to authenticated using (owns_char(owner_char) or staff_level()>=3);
