-- 1) «Fondos insuficientes» ahora dice cuánto se necesita y cuánto hay.
create or replace function move_money(f uuid, t uuid, amt numeric, concept text) returns void
language plpgsql security definer set search_path=public as $$
declare have numeric;
begin
  if amt is null or amt <= 0 then raise exception 'Monto inválido'; end if;
  perform set_config('app.money', 'on', true);
  if f is not null then
    update accounts set balance=balance-amt where id=f and balance>=amt;
    if not found then
      select balance into have from accounts where id=f;
      raise exception 'Fondos insuficientes: se necesitan $% y la cuenta % tiene $%', to_char(amt,'FM999,999,999,990.00'),
        coalesce((select case when kind='gov' then 'de la Tesorería' when kind='personal' then 'personal' else '«'||name||'»' end from accounts where id=f),''), to_char(coalesce(have,0),'FM999,999,999,990.00');
    end if;
  end if;
  if t is not null then update accounts set balance=balance+amt where id=t; end if;
  insert into transactions(from_acc,to_acc,amount,concept) values(f,t,amt,concept);
  perform set_config('app.money', 'off', true);
end $$;
revoke all on function move_money(uuid,uuid,numeric,text) from public, anon, authenticated;

-- 2) Servicio militar obligatorio para ciertos empleos (configurable en settings.military_required)
insert into settings values('military_required', '["Policía","SWAT","FBI"]') on conflict(key) do nothing;
create or replace function employments_military() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status <> 'fired' and coalesce((select value from settings where key='military_required'), '[]'::jsonb) ? new.dept
     and staff_level() < 3
     and not exists(select 1 from requests where character_id = new.character_id and type = 'servicio_militar' and status = 'approved') then
    raise exception 'Para trabajar en % se necesita el Servicio militar aprobado (trámite en Gobierno)', new.dept;
  end if;
  return new;
end $$;
drop trigger if exists employments_military on employments;
create trigger employments_military before insert or update of dept, status on employments for each row execute function employments_military();

-- 3) Rechazos: la vida o el trámite rechazado se borra y solo queda en el historial del usuario
create table if not exists user_history(id uuid primary key default gen_random_uuid(), user_id uuid not null, kind text not null, title text not null,
  note text, by_user uuid default auth.uid(), created_at timestamptz default now());
alter table user_history enable row level security;
drop policy if exists uh_sel on user_history; create policy uh_sel on user_history for select to authenticated using (user_id = auth.uid() or staff_level() >= 1);

create or replace function reject_request(id uuid, note text default null) returns void language plpgsql security definer set search_path=public as $$
declare r requests;
begin
  select * into r from requests where requests.id = reject_request.id;
  if r.id is null then raise exception 'La solicitud ya no existe'; end if;
  if not ((r.dept && my_tags() and r.user_id <> auth.uid()) or staff_level() >= 3) then raise exception 'No puedes revisar esta solicitud'; end if;
  insert into user_history(user_id, kind, title, note) values(r.user_id, 'tramite',
    coalesce(nullif(r.data->>'job_title',''), r.type) || coalesce(' · ' || (select first_name || ' ' || last_name from characters where characters.id = r.character_id), ''), nullif(trim(note), ''));
  delete from requests where requests.id = r.id;
end $$;
grant execute on function reject_request(uuid, text) to authenticated;

create or replace function reject_character(c uuid, note text default null) returns void language plpgsql security definer set search_path=public as $$
declare ch characters;
begin
  if staff_level() < 2 then raise exception 'Solo staff'; end if;
  select * into ch from characters where id = c;
  if ch.id is null then raise exception 'Esa vida ya no existe'; end if;
  if ch.status = 'active' then raise exception 'Esa vida ya está aprobada'; end if;
  insert into user_history(user_id, kind, title, note) values(ch.user_id, 'vida', ch.first_name || ' ' || ch.last_name, nullif(trim(note), ''));
  delete from characters where id = c;
end $$;
grant execute on function reject_character(uuid, text) to authenticated;

-- lo que ya estaba rechazado pasa al historial y se borra
insert into user_history(user_id, kind, title, note, by_user, created_at)
  select r.user_id, 'tramite', coalesce(nullif(r.data->>'job_title',''), r.type), r.note, r.reviewer_id, coalesce(r.reviewed_at, r.created_at) from requests r where r.status = 'rejected' and r.user_id is not null;
delete from requests where status = 'rejected';
insert into user_history(user_id, kind, title, created_at) select user_id, 'vida', first_name || ' ' || last_name, created_at from characters where status = 'rejected';
delete from characters where status = 'rejected';
