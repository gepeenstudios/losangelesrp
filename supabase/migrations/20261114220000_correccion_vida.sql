-- «Corregir datos de un trámite» también corrige el registro de la vida (nombre, nacimiento, sexo, ciudad, nacionalidad)
create or replace function requests_correccion() returns trigger language plpgsql security definer set search_path=public as $$
declare tgt uuid := nullif(split_part(new.data->>'campo','|',1),'')::uuid; ty text := split_part(new.data->>'campo','|',2); k text := split_part(new.data->>'campo','|',3); v text := new.data->>'nuevo';
begin
  if new.type <> 'correccion' or new.status <> 'approved' or old.status = 'approved' or k = '' then return new; end if;
  perform set_config('app.trusted','on',true); -- las guardas no dejan tocar estos datos desde fuera
  if ty = 'vida' then
    if tgt = new.character_id then
      case k
        when 'first_name' then update characters set first_name = v where id = tgt;
        when 'last_name' then update characters set last_name = v where id = tgt;
        when 'dob' then update characters set dob = v::date where id = tgt;
        when 'sex' then update characters set sex = v where id = tgt;
        when 'city' then update characters set city = v where id = tgt;
        when 'nationality' then update characters set nationality = v, extranjero = (v <> 'Estadounidense') where id = tgt;
        else null;
      end case;
    end if;
  else
    update requests set data = jsonb_set(data, array[k], to_jsonb(v)) where id = tgt and character_id = new.character_id and type <> 'correccion' and data ? k;
  end if;
  perform set_config('app.trusted','off',true);
  return new;
end $$;
