-- Registro vehicular: cada auto tiene un VIN único y una fecha de registro que se renueva cuando cambia de dueño
alter table vehicles add column if not exists vin text, add column if not exists registered_at timestamptz default now();
create or replace function new_vin() returns text language sql volatile as $$
  select string_agg(substr('0123456789ABCDEFGHJKLMNPRSTUVWXYZ', 1 + floor(random() * 33)::int, 1), '') from generate_series(1, 17) $$;
create or replace function vehicles_reg() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.vin := coalesce(new.vin, new_vin()); new.registered_at := now();
  else
    new.vin := coalesce(old.vin, new.vin, new_vin()); -- el VIN no se cambia nunca
    if (new.owner_char, new.owner_company) is distinct from (old.owner_char, old.owner_company) then new.registered_at := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists t_vehicles_reg on vehicles;
create trigger t_vehicles_reg before insert or update on vehicles for each row execute function vehicles_reg();
update vehicles set vin = new_vin() where vin is null;
create unique index if not exists vehicles_vin on vehicles(vin);
