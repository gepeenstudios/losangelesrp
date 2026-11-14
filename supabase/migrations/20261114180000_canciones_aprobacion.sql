-- Spotify: las canciones nuevas pasan por aprobación de Admin+; Admin+ puede borrar cualquiera
alter table songs add column if not exists approved boolean not null default false;
update songs set approved = true; -- las que ya estaban se quedan publicadas
create or replace function songs_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op = 'INSERT' then new.approved := staff_level() >= 3; -- lo que sube un admin sale directo
  elsif new.approved is distinct from old.approved and staff_level() < 3 then raise exception 'Solo Admin o superior aprueba canciones'; end if;
  return new;
end $$;
drop trigger if exists t_songs_guard on songs; create trigger t_songs_guard before insert or update on songs for each row execute function songs_guard();
drop policy if exists so_sel on songs; create policy so_sel on songs for select to authenticated using (approved or owns_char(uploader_char) or staff_level()>=3);
drop policy if exists so_upd on songs; create policy so_upd on songs for update to authenticated using (staff_level()>=3) with check (staff_level()>=3);
drop policy if exists so_del on songs; create policy so_del on songs for delete to authenticated using (owns_char(uploader_char) or staff_level()>=3);
