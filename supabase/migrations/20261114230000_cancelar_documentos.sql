-- La policía puede cancelar una licencia o documento aprobado (al arrestar, por ejemplo). Queda en antecedentes.
create or replace function revoke_doc(r uuid, motivo text, officer uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare q requests;
begin
  if not is_police() then raise exception 'Solo la policía puede cancelar documentos'; end if;
  if coalesce(trim(motivo),'') = '' then raise exception 'Escribe el motivo de la cancelación'; end if;
  select * into q from requests where id = r and status = 'approved'
    and type in ('dni','licencia_conducir','licencia_armas','registro_arma','visa','pasaporte','placa');
  if q.id is null then raise exception 'Ese documento no existe o ya no está vigente'; end if;
  perform set_config('app.trusted','on',true);
  update requests set status = 'revoked', note = 'Cancelado por la policía: ' || motivo, reviewer_id = auth.uid(), reviewed_at = now() where id = r;
  perform set_config('app.trusted','off',true);
  insert into records(kind, character_id, officer_id, description)
    values('cancelacion', q.character_id, case when owns_char(officer) then officer end, (case q.type when 'dni' then 'Identificación' when 'licencia_conducir' then 'Licencia de conducir' when 'licencia_armas' then 'Licencia de armas'
      when 'registro_arma' then 'Registro de arma' when 'visa' then 'Visa' when 'pasaporte' then 'Pasaporte' when 'placa' then 'Placas' else q.type end) || ' cancelada: ' || motivo);
end $$;
grant execute on function revoke_doc(uuid, text, uuid) to authenticated;
