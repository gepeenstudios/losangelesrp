-- Trámite «Corregir datos de un trámite»: al aprobarse, cambia ese dato en la solicitud original (solo de la misma vida)
insert into tramite_depts(type, dept) values('correccion', array['staff:mod']) on conflict(type) do update set dept = excluded.dept;
create or replace function requests_correccion() returns trigger language plpgsql security definer set search_path=public as $$
declare tgt uuid := nullif(split_part(new.data->>'campo','|',1),'')::uuid; k text := split_part(new.data->>'campo','|',3);
begin
  if new.type <> 'correccion' or new.status <> 'approved' or old.status = 'approved' or k = '' then return new; end if;
  perform set_config('app.trusted','on',true); -- la guarda de requests no deja tocar data desde fuera
  update requests set data = jsonb_set(data, array[k], to_jsonb(new.data->>'nuevo'))
    where id = tgt and character_id = new.character_id and type <> 'correccion' and data ? k;
  perform set_config('app.trusted','off',true);
  return new;
end $$;
drop trigger if exists t_requests_correccion on requests;
create trigger t_requests_correccion after update on requests for each row execute function requests_correccion();
