-- Leyes: el Presidente y el Gobernador pueden promulgar y derogar leyes. Una ley puede (opcional) cambiar reglas del juego:
-- impuestos, tasa de ahorro, dinero inicial, servicio militar obligatorio, apuesta máxima del casino, días de visa o agregar un delito al código penal.
-- Se publica sola en LA Times. Al derogarla se regresa el valor anterior (o se quita el delito).
create table if not exists laws(id uuid primary key default gen_random_uuid(), number int generated always as identity, title text not null, body text not null,
  effect text not null default 'ninguno', params jsonb not null default '{}', prev jsonb, author uuid references characters on delete set null, author_office text,
  status text not null default 'vigente' check (status in ('vigente','derogada')), repealed_by uuid, repealed_at timestamptz, created_at timestamptz default now());
alter table laws enable row level security;
drop policy if exists laws_sel on laws; create policy laws_sel on laws for select to authenticated using (true);

create or replace function lawmaker(c uuid) returns text language sql stable security definer set search_path=public as $$
  select case when staff_level() >= 4 then 'Staff' when not owns_char(c) then null
    when exists(select 1 from characters where id = c and status = 'active' and 'Presidente' = any(roles)) then 'Presidente'
    when exists(select 1 from characters where id = c and status = 'active' and 'Gobernador' = any(roles)) then 'Gobernador' end $$;

create or replace function enact_law(c uuid, title text, body text, effect text default 'ninguno', params jsonb default '{}') returns int
language plpgsql security definer set search_path=public as $$
declare office text := lawmaker(c); prev jsonb; v numeric; k text; n int; nm text := (select first_name || ' ' || last_name from characters where id = c);
begin
  if office is null then raise exception 'Solo el Presidente o el Gobernador pueden promulgar leyes'; end if;
  if coalesce(trim(title), '') = '' or coalesce(trim(body), '') = '' then raise exception 'La ley necesita título y texto'; end if;
  if effect = 'impuesto' then
    k := params->>'tipo'; v := (params->>'valor')::numeric;
    if k not in ('sales','property','corp','transfer') or v is null or v < 0 or v > 50 then raise exception 'Impuesto inválido (0 a 50%%)'; end if;
    prev := jsonb_build_object('tipo', k, 'valor', tax_cfg(k, null));
    insert into settings values('impuestos', jsonb_build_object(k, v)) on conflict(key) do update set value = settings.value || jsonb_build_object(k, v);
  elsif effect in ('ahorro','dinero_inicial','casino_max','visa_dias') then
    k := case effect when 'ahorro' then 'savings_rate' when 'dinero_inicial' then 'start_money' when 'casino_max' then 'casino_max_bet' else 'visa_days' end;
    v := (params->>'valor')::numeric;
    if v is null or v < 0 or (effect = 'ahorro' and v > 30) or (effect = 'dinero_inicial' and v > 100000) or (effect = 'casino_max' and (v < 100 or v > 1000000)) or (effect = 'visa_dias' and (v < 1 or v > 365)) then
      raise exception 'Valor fuera de rango'; end if;
    prev := jsonb_build_object('key', k, 'value', (select value from settings where key = k));
    insert into settings values(k, to_jsonb(v)) on conflict(key) do update set value = excluded.value;
  elsif effect = 'servicio_militar' then
    if jsonb_typeof(params->'depts') <> 'array' then raise exception 'Elige los empleos'; end if;
    prev := jsonb_build_object('key', 'military_required', 'value', (select value from settings where key = 'military_required'));
    insert into settings values('military_required', params->'depts') on conflict(key) do update set value = excluded.value;
  elsif effect = 'delito' then
    if coalesce(params->>'code','') = '' or coalesce(params->>'title','') = '' then raise exception 'El delito necesita artículo y nombre'; end if;
    if exists(select 1 from penal_code where code = params->>'code') then raise exception 'Ya existe el artículo %', params->>'code'; end if;
    if coalesce((params->>'fine')::numeric, 0) not between 0 and 1000000 or coalesce((params->>'months')::numeric, 0) not between 0 and 480 then raise exception 'Multa o pena fuera de rango'; end if;
    insert into penal_code(code, title, kind, fine, years, notes) values(params->>'code', params->>'title', coalesce(nullif(params->>'kind',''), 'delito'),
      coalesce((params->>'fine')::numeric, 0), coalesce((params->>'months')::numeric, 0) / 12, 'Ley ' || title);
  elsif effect <> 'ninguno' then raise exception 'Efecto desconocido'; end if;
  insert into laws(title, body, effect, params, prev, author, author_office) values(trim(title), trim(body), effect, params, prev, c, office) returning number into n;
  insert into posts(app, section, character_id, anonimo, title, body) values('news', 'Gobierno', null, true,
    'Entra en vigor la Ley ' || n || ': ' || trim(title), 'El ' || lower(office) || ' ' || coalesce(nm, '') || ' promulgó la Ley ' || n || '. ' || trim(body));
  return n;
end $$;
grant execute on function enact_law(uuid, text, text, text, jsonb) to authenticated;

create or replace function repeal_law(c uuid, law uuid) returns void language plpgsql security definer set search_path=public as $$
declare l laws; office text := lawmaker(c);
begin
  if office is null then raise exception 'Solo el Presidente o el Gobernador pueden derogar leyes'; end if;
  select * into l from laws where id = law for update;
  if l.id is null or l.status <> 'vigente' then raise exception 'Esa ley no está vigente'; end if;
  if l.effect = 'impuesto' then
    if l.prev->'valor' is null or l.prev->'valor' = 'null' then update settings set value = value - (l.prev->>'tipo') where key = 'impuestos';
    else update settings set value = value || jsonb_build_object(l.prev->>'tipo', l.prev->'valor') where key = 'impuestos'; end if;
  elsif l.prev ? 'key' then
    if l.prev->'value' is null or l.prev->'value' = 'null' then delete from settings where key = l.prev->>'key';
    else insert into settings values(l.prev->>'key', l.prev->'value') on conflict(key) do update set value = excluded.value; end if;
  elsif l.effect = 'delito' then delete from penal_code where code = l.params->>'code';
  end if;
  update laws set status = 'derogada', repealed_by = c, repealed_at = now() where id = law;
  insert into posts(app, section, character_id, anonimo, title, body) values('news', 'Gobierno', null, true, 'Se deroga la Ley ' || l.number || ': ' || l.title,
    'El ' || lower(office) || ' derogó la Ley ' || l.number || '. Deja de tener efecto a partir de hoy.');
end $$;
grant execute on function repeal_law(uuid, uuid) to authenticated;
