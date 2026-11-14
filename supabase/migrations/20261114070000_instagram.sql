-- Mensajes directos de Instagram, verificación mensual de cuentas
alter table messages add column if not exists via text;
alter table characters add column if not exists ig_verified_until timestamptz;

-- nadie se verifica solo
create or replace function characters_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    if staff_level() < 3 then new.status:='pending'; new.roles:='{}'; new.user_id:=auth.uid(); new.ig_verified_until:=null; end if;
  else
    new.user_id:=old.user_id;
    if coalesce(current_setting('app.trusted', true), '') <> 'on' then -- 'on' = cambio de una función del servidor (contratar, despedir…)
      if staff_level() < 2 then new.status:=old.status; new.roles:=old.roles;
      elsif staff_level() < 3 then new.roles:=old.roles; end if;
      if staff_level() < 3 then new.ig_verified_until:=old.ig_verified_until; end if; -- la palomita solo la da un admin
    end if;
  end if;
  if not 'Ciudadano' = any(coalesce(new.roles, '{}')) then new.roles := array_prepend('Ciudadano', coalesce(new.roles, '{}')); end if; -- rol base de toda vida
  return new;
end $$;
