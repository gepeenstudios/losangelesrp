-- Fotos de ficha (frente, perfiles y espalda) obligatorias al encarcelar.
alter table inmates add column if not exists mugshots jsonb;
