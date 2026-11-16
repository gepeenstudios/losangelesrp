-- Mercado negro: cualquiera entra, vende lo que es suyo (armas y objetos, autos, casas) y cualquiera compra. Sin impuestos ni registro.
-- Se paga desde la cuenta encriptada si la tienes (si no, la personal) y el vendedor cobra igual.
create table if not exists bm_listings(id uuid primary key default gen_random_uuid(), seller uuid not null references characters on delete cascade,
  kind text not null check (kind in ('item','vehicle','property')), ref uuid not null, price numeric not null check (price >= 1), note text,
  status text not null default 'open', buyer uuid, created_at timestamptz default now(), sold_at timestamptz);
alter table bm_listings add column if not exists title text, add column if not exists img text, add column if not exists cat text;
create unique index if not exists bm_open_ref on bm_listings(kind, ref) where status = 'open';
alter table bm_listings enable row level security;
drop policy if exists bm_sel on bm_listings; create policy bm_sel on bm_listings for select to authenticated using (true);

create or replace function bm_acc(c uuid) returns uuid language sql stable security definer set search_path=public as $$
  select coalesce((select id from accounts where kind='encrypted' and owners=array[c] limit 1), personal_acc(c)) $$;
create or replace function bm_owner(kind text, ref uuid) returns uuid language sql stable security definer set search_path=public as $$
  select case kind when 'item' then (select owner_char from items where id=ref) when 'vehicle' then (select owner_char from vehicles where id=ref)
    when 'property' then (select owner_char from properties where id=ref) end $$;

create or replace function bm_list(c uuid, kind text, ref uuid, price numeric, note text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare id uuid;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  perform char_guard(c);
  if bm_owner(bm_list.kind, bm_list.ref) is distinct from c then raise exception 'Eso no es tuyo'; end if;
  -- la foto y el nombre salen solos del producto
  insert into bm_listings(seller, kind, ref, price, note, title, img, cat)
  select c, bm_list.kind, bm_list.ref, round(bm_list.price, 2), nullif(trim(bm_list.note), ''), t.title, t.img, t.cat from (
    select si.name title, 'img/tienda/' || si.id || '.jpg' img, case when si.gun_class is not null then 'Armas' else 'Objetos' end cat from items i join shop_items si on si.id = i.item where bm_list.kind = 'item' and i.id = bm_list.ref
    union all select m.brand || ' ' || m.model, m.img, 'Vehículos' from vehicles v join vehicle_models m on m.id = v.model_id where bm_list.kind = 'vehicle' and v.id = bm_list.ref
    union all select p.name, p.img, 'Casas y locales' from properties p where bm_list.kind = 'property' and p.id = bm_list.ref) t
  returning bm_listings.id into id;
  return id;
exception when unique_violation then raise exception 'Eso ya está a la venta';
end $$;

create or replace function bm_cancel(l uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  update bm_listings set status = 'cancelled' where id = l and status = 'open' and owns_char(seller);
  if not found then raise exception 'No puedes quitar esa publicación'; end if;
end $$;

create or replace function bm_buy(l uuid, c uuid) returns void language plpgsql security definer set search_path=public as $$
declare x bm_listings;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  perform char_guard(c);
  select * into x from bm_listings where id = l for update;
  if x.id is null or x.status <> 'open' then raise exception 'Ya no está a la venta'; end if;
  if x.seller = c then raise exception 'Es tuyo'; end if;
  if bm_owner(x.kind, x.ref) is distinct from x.seller then update bm_listings set status = 'cancelled' where id = l; raise exception 'El vendedor ya no lo tiene'; end if;
  perform move_money(bm_acc(c), bm_acc(x.seller), x.price, 'Mercado negro');
  perform set_config('app.trusted', 'on', true);
  if x.kind = 'item' then update items set owner_char = c where id = x.ref;
  elsif x.kind = 'vehicle' then update vehicles set owner_char = c, owner_company = null, sale_price = null where id = x.ref;
  else update properties set owner_char = c, owner_company = null, for_sale = false, sale_price = null where id = x.ref; end if;
  perform set_config('app.trusted', 'off', true);
  update bm_listings set status = 'sold', buyer = c, sold_at = now() where id = l;
end $$;
grant execute on function bm_list(uuid,text,uuid,numeric,text), bm_cancel(uuid), bm_buy(uuid,uuid) to authenticated;
