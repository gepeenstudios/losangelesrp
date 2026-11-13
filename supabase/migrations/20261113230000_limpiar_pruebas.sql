-- Borra las cuentas de prueba de la verificación y deja la ciudad lista para el primer registro real.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('truncate table public.%I restart identity cascade', t);
  end loop;
end $$;
delete from auth.users;
-- La Tesorería siempre debe existir (el reinicio anterior la había borrado)
insert into accounts(kind,name,number,balance)
select 'gov','Tesorería de Los Ángeles','0000000001',13950000000 -- presupuesto real de la Ciudad de LA 2025-26
where not exists(select 1 from accounts where kind='gov');
