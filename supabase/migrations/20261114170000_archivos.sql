-- Archivos del escritorio: carpetas, documentos, presentaciones y hojas de cálculo (privados de cada cuenta)
create table if not exists files(id uuid primary key default gen_random_uuid(), owner uuid not null default auth.uid() references profiles on delete cascade,
  parent uuid references files on delete cascade, name text not null check (length(name) between 1 and 80),
  kind text not null check (kind in ('folder','doc','slides','sheet')), content jsonb not null default '{}' check (pg_column_size(content) < 2000000),
  updated_at timestamptz default now(), created_at timestamptz default now());
create index if not exists files_owner on files(owner);
alter table files enable row level security;
drop policy if exists f_all on files;
create policy f_all on files for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
