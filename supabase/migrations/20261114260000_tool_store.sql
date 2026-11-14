-- Tool Store: catálogo, inventario de cada vida, compras y decomisos de la policía. El celular básico viene incluido y no se puede quitar.
create table if not exists shop_items(id text primary key, name text not null, store text not null, price numeric not null check (price >= 0),
  gun_class text, confiscable boolean not null default false, description text, active boolean not null default true);
alter table shop_items enable row level security;
drop policy if exists si_sel on shop_items; create policy si_sel on shop_items for select to authenticated using (true);
drop policy if exists si_all on shop_items; create policy si_all on shop_items for all to authenticated using (staff_level()>=3) with check (staff_level()>=3);
insert into shop_items(id, name, store, price, gun_class, confiscable, description) values
  ('martillo', 'Martillo', 'herramientas', 25, null, false, 'Martillo de carpintero con mango de fibra de vidrio.'),
  ('cuchillo', 'Cuchillo', 'herramientas', 45, null, true, 'Cuchillo táctico de hoja fija.'),
  ('disruptor_rfid', 'Disruptor RFID', 'herramientas', 450, null, true, 'Interfiere cerraduras y tarjetas RFID. Su uso para delinquir es ilegal.'),
  ('ganzua', 'Ganzúa (lockpick)', 'herramientas', 35, null, true, 'Juego de ganzúas para abrir cerraduras.'),
  ('palanca', 'Palanca', 'herramientas', 30, null, true, 'Barra de acero de 60 cm.'),
  ('cortador_cristal', 'Cortador de cristal', 'herramientas', 20, null, true, 'Corta vidrio con punta de carburo.'),
  ('linterna', 'Linterna', 'herramientas', 15, null, false, 'Linterna LED resistente al agua.'),
  ('escaner', 'Escáner de radio', 'herramientas', 150, null, true, 'Escucha frecuencias de radio abiertas.'),
  ('aerosol', 'Pintura en aerosol', 'herramientas', 8, null, false, 'Lata de pintura en spray.'),
  ('bate', 'Bate de béisbol', 'herramientas', 60, null, true, 'Bate de madera profesional.'),
  ('pearphone_retro', 'Pearphone Retro', 'gadgets', 299, null, false, 'El celular de siempre. Toda vida lo trae incluido.'),
  ('pearphone_x', 'Pearphone X', 'gadgets', 999, null, false, 'Pantalla OLED de 6.1", triple cámara.'),
  ('nebula_g7', 'Nebula G7', 'gadgets', 499, null, false, 'Gama media con gran batería.'),
  ('nebula_g20', 'Nebula G20', 'gadgets', 899, null, false, 'Gama alta con cámara de 108 MP.'),
  ('plusultra', 'PlusUltra', 'gadgets', 1199, null, false, 'El más potente del mercado.'),
  ('dron', 'Dron', 'gadgets', 1299, null, false, 'Dron plegable con cámara 4K y 30 min de vuelo.'),
  ('beretta_m9', 'Beretta M9', 'armeria', 650, 'Armas Cortas', true, 'Pistola 9 mm, cargador de 15.'),
  ('colt_m1911', 'Colt M1911', 'armeria', 900, 'Armas Cortas', true, 'Pistola .45 ACP clásica.'),
  ('desert_eagle', 'Desert Eagle', 'armeria', 1900, 'Armas Cortas', true, 'Pistola .50 AE de alto calibre.'),
  ('colt_python', 'Colt Python', 'armeria', 1600, 'Armas Cortas', true, 'Revólver .357 Magnum.'),
  ('tec9', 'TEC-9', 'armeria', 650, 'Armas Cortas', true, 'Pistola semiautomática 9 mm.'),
  ('skorpion', 'Skorpion', 'armeria', 1500, 'Armas Cortas', true, 'Subfusil compacto .32 ACP.'),
  ('remington_870', 'Remington 870', 'armeria', 500, 'Armas Largas', true, 'Escopeta de bombeo calibre 12.'),
  ('remington_700', 'Remington 700', 'armeria', 1100, 'Armas Largas', true, 'Rifle de cerrojo para caza.'),
  ('m14', 'M14', 'armeria', 2200, 'Armas Largas', true, 'Rifle semiautomático 7.62 mm.'),
  ('ak47', 'AK47', 'armeria', 1300, 'Armas Largas', true, 'Rifle 7.62×39 mm.'),
  ('kriss_vector', 'Kriss Vector', 'armeria', 2400, 'Armas Largas', true, 'Subfusil .45 ACP.'),
  ('ppsh41', 'PPSh-41', 'armeria', 2800, 'Armas Largas', true, 'Subfusil de colección con tambor.'),
  ('lmt_l129a1', 'LMT L129A1', 'armeria', 4200, 'Armas Largas', true, 'Rifle de tirador designado 7.62 mm.'),
  ('remington_msr', 'Remington MSR', 'armeria', 6800, 'Armas Largas', true, 'Rifle de francotirador modular.'),
  ('m249', 'M249', 'armeria', 9500, 'Armas Pesadas', true, 'Ametralladora ligera 5.56 mm.'),
  ('municion', 'Caja de munición', 'armeria', 60, 'any', true, 'Caja de munición para cualquier arma registrada.'),
  ('tienda_basica', 'Tienda de campaña básica', 'camping', 80, null, false, 'Para 2 personas.'),
  ('tienda_avanzada', 'Tienda de campaña avanzada', 'camping', 350, null, false, 'Para 6 personas, con dos cuartos.'),
  ('silla_camping', 'Silla de camping', 'camping', 35, null, false, 'Plegable, con portavasos.'),
  ('silla_plastico', 'Silla de plástico', 'camping', 15, null, false, 'Apilable.'),
  ('asiento_tronco', 'Asiento de tronco', 'camping', 25, null, false, 'Tronco de madera natural.'),
  ('fogata', 'Fogata portátil', 'camping', 60, null, false, 'Kit de fogata con piedras.'),
  ('parrilla', 'Parrilla de carbón', 'camping', 120, null, false, 'Asador de carbón con ruedas.')
on conflict(id) do update set name = excluded.name, store = excluded.store, price = excluded.price, gun_class = excluded.gun_class, confiscable = excluded.confiscable, description = excluded.description;

create table if not exists items(id uuid primary key default gen_random_uuid(), owner_char uuid not null references characters on delete cascade,
  item text not null references shop_items, serial text unique, price numeric, created_at timestamptz default now());
create index if not exists items_owner on items(owner_char);
alter table items enable row level security; -- solo se escribe con las funciones de abajo
drop policy if exists it_sel on items; create policy it_sel on items for select to authenticated using (owns_char(owner_char) or is_police());

create or replace function gun_rank(t text) returns int language sql immutable as $$
  select case t when 'Armas Cortas' then 1 when 'Armas Largas' then 2 when 'Armas SWAT' then 3 when 'Armas Pesadas' then 4 else 0 end $$;

create or replace function buy_item(c uuid, it text, q int default 1) returns void language plpgsql security definer set search_path=public as $$
declare s shop_items; total numeric; lic int;
begin
  if not owns_char(c) or not exists(select 1 from characters where id = c and status = 'active') then raise exception 'Necesitas una vida activa'; end if;
  select * into s from shop_items where id = it and active; if s.id is null then raise exception 'Ese producto no existe'; end if;
  if q < 1 or q > 20 or (s.gun_class is not null and s.gun_class <> 'any' and q > 1) then raise exception 'Cantidad inválida (armas: una por compra)'; end if;
  if s.gun_class is not null then
    select max(gun_rank(data->>'tipo')) into lic from requests where character_id = c and type = 'licencia_armas' and status = 'approved';
    if coalesce(lic, 0) = 0 then raise exception 'Necesitas una licencia de armas vigente. Tramítala en la comisaría.'; end if;
    if s.gun_class <> 'any' and lic < gun_rank(s.gun_class) then raise exception 'Tu licencia no cubre %. Necesitas licencia de % o superior.', s.name, s.gun_class; end if;
  end if;
  total := round(s.price * cpi() * q, 2);
  perform move_money(personal_acc(c), gov_acc(), total, 'Tool Store · ' || s.name || case when q > 1 then ' ×' || q else '' end);
  insert into items(owner_char, item, serial, price)
    select c, it, case when s.gun_class is not null and s.gun_class <> 'any' then upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)) end, total / q from generate_series(1, q);
end $$;
grant execute on function buy_item(uuid, text, int) to authenticated;

-- la policía decomisa un objeto (al arrestar, en un cateo…); queda en antecedentes
create or replace function confiscate_item(i uuid, motivo text, officer uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare x items; s shop_items;
begin
  if not is_police() then raise exception 'Solo la policía puede decomisar'; end if;
  if coalesce(trim(motivo),'') = '' then raise exception 'Escribe el motivo del decomiso'; end if;
  select * into x from items where id = i; if x.id is null then raise exception 'Ese objeto ya no existe'; end if;
  select * into s from shop_items where id = x.item;
  if not s.confiscable then raise exception '% no se puede decomisar', s.name; end if;
  delete from items where id = i;
  insert into records(kind, character_id, officer_id, description)
    values('decomiso', x.owner_char, case when owns_char(officer) then officer end, 'Decomiso: ' || s.name || coalesce(' (serie ' || x.serial || ')', '') || ' — ' || motivo);
end $$;
grant execute on function confiscate_item(uuid, text, uuid) to authenticated;
