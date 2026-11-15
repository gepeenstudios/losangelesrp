-- Capital inicial de una empresa: al aprobarse, sale de la cuenta personal del dueño y entra a la cuenta de la empresa (una sola vez).
create or replace function fund_company(req uuid, dest uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r requests; cap numeric;
begin
  if staff_level() < 3 then raise exception 'Solo admins'; end if;
  select * into r from requests where id=req and type='empresa';
  if r.id is null then raise exception 'Solicitud no encontrada'; end if;
  if not exists(select 1 from accounts where id=dest and kind='business' and r.character_id=any(owners)) then raise exception 'Cuenta de empresa inválida'; end if;
  if exists(select 1 from transactions where to_acc=dest) then raise exception 'El capital ya se depositó'; end if;
  cap := coalesce(nullif(r.data->>'capital','')::numeric, 0);
  if cap <= 0 then return; end if;
  if coalesce((select balance from accounts where id=personal_acc(r.character_id)),0) < cap then
    raise exception 'El dueño ya no tiene el capital disponible (%)', cap; end if;
  perform move_money(personal_acc(r.character_id), dest, cap, 'Capital inicial · '||coalesce(r.data->>'nombre','empresa'));
end $$;
