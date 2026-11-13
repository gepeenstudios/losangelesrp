-- Empezar de cero (pedido del dueño): borra TODAS las cuentas, vidas y datos de la ciudad.
-- Los datos base (autos, casas, trabajos, código penal) se vuelven a cargar solos cuando el Owner inicia sesión por primera vez.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('truncate table public.%I restart identity cascade', t);
  end loop;
end $$;
delete from auth.users;
