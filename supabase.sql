-- ============================================================
--  CIUDAD RP · Los Ángeles — Base de datos (Supabase)
--  Pega TODO este archivo en Supabase → SQL Editor → Run.
--  El primer usuario que se registre en la web queda como OWNER.
-- ============================================================
create extension if not exists pgcrypto;

-- ---------- Tablas ----------
create table if not exists profiles(
  id uuid primary key references auth.users on delete cascade,
  username text unique not null, roblox text, discord text, avatar_url text, avatar_full text,
  staff_role text check (staff_role in ('helper','mod','admin','coowner','owner')),
  verified bool default false, banned bool default false, wallpaper text,
  created_at timestamptz default now());

create table if not exists characters(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  first_name text not null, last_name text not null, dob date, sex text, city text,
  nationality text, extranjero bool default false, skin_url text,
  roles text[] default '{}', status text default 'pending', bio text,
  created_at timestamptz default now());

create table if not exists accounts(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('personal','business','gov','savings')),
  name text, owners uuid[] default '{}', balance numeric default 0 check (balance >= 0),
  number text unique default lpad(floor(random()*1e10)::bigint::text,10,'0'),
  created_at timestamptz default now());

create table if not exists transactions(
  id uuid primary key default gen_random_uuid(),
  from_acc uuid, to_acc uuid, amount numeric, concept text, created_at timestamptz default now());

create table if not exists tramite_depts(type text primary key, dept text[] not null);

create table if not exists requests(
  id uuid primary key default gen_random_uuid(),
  type text not null, dept text[] default '{}', user_id uuid default auth.uid(),
  character_id uuid references characters on delete cascade,
  data jsonb default '{}', status text default 'pending', reviewer_id uuid, note text,
  reviewed_at timestamptz, created_at timestamptz default now());

create table if not exists records(
  id uuid primary key default gen_random_uuid(),
  character_id uuid references characters on delete cascade, kind text, description text,
  amount numeric, paid bool default false, officer_id uuid, created_at timestamptz default now());

create table if not exists posts(
  id uuid primary key default gen_random_uuid(),
  app text not null, section text, character_id uuid references characters on delete set null,
  anonimo bool default false, title text, body text, media_url text, likes int default 0,
  created_at timestamptz default now());

create table if not exists reviews(
  id uuid primary key default gen_random_uuid(),
  target_kind text, target_id text, user_id uuid default auth.uid(),
  stars int check (stars between 1 and 5), body text, created_at timestamptz default now());

create table if not exists shifts(
  id uuid primary key default gen_random_uuid(), user_id uuid default auth.uid(),
  started_at timestamptz default now(), ended_at timestamptz, created_at timestamptz default now());

create table if not exists bans(
  id uuid primary key default gen_random_uuid(), kind text, username text, roblox text, discord text,
  reason text, by_user uuid default auth.uid(), until date, created_at timestamptz default now());

create table if not exists tickets(
  id uuid primary key default gen_random_uuid(), user_id uuid default auth.uid(),
  subject text, body text, status text default 'abierto', assigned_to uuid,
  replies jsonb default '[]', created_at timestamptz default now());

create table if not exists messages(
  id uuid primary key default gen_random_uuid(), from_char uuid, to_char uuid, body text, via text,
  created_at timestamptz default now());

create table if not exists companies(
  id uuid primary key default gen_random_uuid(), name text, industry text, brand text,
  account_id uuid references accounts, owners uuid[] default '{}', ein text, permits jsonb,
  shares_total int default 1000, description text, logo_url text, created_at timestamptz default now());

create table if not exists holdings(
  id uuid primary key default gen_random_uuid(), character_id uuid, company_id uuid, shares int, cost numeric default 0,
  created_at timestamptz default now(), unique(character_id, company_id));

create table if not exists jobs(
  id uuid primary key default gen_random_uuid(), title text, employer text, company_id uuid,
  posted_by uuid, role_tag text, salary numeric, description text, open bool default true,
  created_at timestamptz default now());

create table if not exists properties(
  id uuid primary key default gen_random_uuid(), name text, zone text, price numeric,
  owner_char uuid, owner_company uuid, for_sale bool default true, sale_price numeric, img text, location text,
  created_at timestamptz default now());

create table if not exists vehicle_models(
  id uuid primary key default gen_random_uuid(), brand text, model text, category text,
  price numeric, img text, custom bool default false, created_at timestamptz default now());

create table if not exists vehicles(
  id uuid primary key default gen_random_uuid(), model_id uuid references vehicle_models,
  owner_char uuid, owner_company uuid, sale_price numeric, plate text, created_at timestamptz default now());

create table if not exists elections(
  id uuid primary key default gen_random_uuid(), title text, office text,
  candidates jsonb default '[]', open bool default true, created_at timestamptz default now());

create table if not exists votes(
  id uuid primary key default gen_random_uuid(), election_id uuid references elections on delete cascade,
  character_id uuid, user_id uuid default auth.uid(), choice text, created_at timestamptz default now(),
  unique(election_id, user_id));

create table if not exists store_apps(
  id uuid primary key default gen_random_uuid(), name text, icon text, html text,
  author_char uuid, approved bool default false, created_at timestamptz default now());

create table if not exists settings(key text primary key, value jsonb);

-- Trabajos: rangos y sueldos por departamento, empleos y turnos
create table if not exists dept_ranks(dept text, rank text, ord int, salary numeric, manage bool default false, primary key(dept, rank));
create table if not exists employments(
  id uuid primary key default gen_random_uuid(), character_id uuid references characters on delete cascade,
  dept text, rank text, status text default 'active', vacation_until date, last_qualified date default current_date,
  hired_at timestamptz default now(), unique(character_id, dept));
create table if not exists work_shifts(
  id uuid primary key default gen_random_uuid(), character_id uuid references characters on delete cascade, dept text,
  started_at timestamptz default now(), ended_at timestamptz, created_at timestamptz default now());
alter table properties add column if not exists kind text default 'casa';

-- Código penal y prisión
create table if not exists penal_code(code text primary key, title text not null, kind text, fine numeric default 0, years numeric default 0, notes text);
create table if not exists inmates(
  id uuid primary key default gen_random_uuid(), character_id uuid references characters on delete cascade, officer_id uuid,
  charges jsonb default '[]', years numeric, minutes numeric, started_at timestamptz default now(), ends_at timestamptz,
  status text default 'en_prision', note text, created_at timestamptz default now());
alter table records add column if not exists charges jsonb default '[]';

-- Bolsa: operaciones e historial de precios
create table if not exists trades(id uuid primary key default gen_random_uuid(), character_id uuid, company_id uuid, side text, qty int, price numeric, total numeric, created_at timestamptz default now());
create table if not exists price_history(id uuid primary key default gen_random_uuid(), company_id uuid, price numeric, created_at timestamptz default now());

-- Cuenta del gobierno (tesorería)
insert into accounts(kind,name,number,balance)
select 'gov','Tesorería de Los Ángeles','0000000001',13950000000 -- presupuesto real de la Ciudad de LA 2025-26
where not exists(select 1 from accounts where kind='gov');

-- ---------- Funciones de permisos ----------
create or replace function lvl(r text) returns int language sql immutable as $$
  select case r when 'helper' then 1 when 'mod' then 2 when 'admin' then 3
                when 'coowner' then 4 when 'owner' then 5 else 0 end $$;

create or replace function staff_level() returns int language sql stable security definer set search_path=public as $$
  select coalesce((select lvl(staff_role) from profiles where id=auth.uid()),0) $$;

create or replace function my_tags() returns text[] language sql stable security definer set search_path=public as $$
  select coalesce(array_agg(distinct t),'{}') from (
    select unnest(roles) t from characters where user_id=auth.uid() and status='active'
    union select 'char:'||id from characters where user_id=auth.uid()
    union select 'staff:'||s from unnest(array['helper','mod','admin','coowner','owner']) with ordinality x(s,n)
          where n <= staff_level()
    union select 'mgr:'||e.dept from employments e join dept_ranks r on r.dept=e.dept and r.rank=e.rank
          join characters c on c.id=e.character_id where c.user_id=auth.uid() and c.status='active' and e.status<>'fired' and r.manage) z $$;

create or replace function is_police() returns bool language sql stable as $$
  select my_tags() && array['Policía','SWAT','FBI','DEA','CIA','US Seal','US Navy Seal','Servicio Secreto','Seguridad Pública','Custodio','Juez de Distrito','Corte Suprema','Tribunales Inferiores']
         or staff_level() >= 2 $$;

create or replace function owns_char(c uuid) returns bool language sql stable security definer set search_path=public as $$
  select exists(select 1 from characters where id=c and user_id=auth.uid()) $$;

create or replace function owns_acc(a uuid) returns bool language sql stable security definer set search_path=public as $$
  select exists(select 1 from accounts ac join characters ch on ch.id = any(ac.owners)
                where ac.id=a and ch.user_id=auth.uid() and ch.status='active') $$;

create or replace function owns_entity(c uuid, co uuid) returns bool language sql stable security definer set search_path=public as $$
  select owns_char(c) or exists(select 1 from companies x join characters ch on ch.id = any(x.owners)
                                where x.id=co and ch.user_id=auth.uid()) $$;

-- ---------- Triggers de protección ----------
create or replace function profiles_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    if not exists(select 1 from profiles) then new.staff_role:='owner'; new.verified:=true;
    else new.staff_role:=null; new.verified:=false; end if;
    new.banned:=false; return new;
  end if;
  if staff_level() < 3 then
    new.staff_role:=old.staff_role; new.verified:=old.verified; new.banned:=old.banned;
  elsif new.staff_role is distinct from old.staff_role and staff_level() < 5
        and (lvl(new.staff_role) >= staff_level() or lvl(old.staff_role) >= staff_level()) then
    raise exception 'No puedes asignar ese rango';
  end if;
  return new;
end $$;
drop trigger if exists t_profiles on profiles;
create trigger t_profiles before insert or update on profiles for each row execute function profiles_guard();

alter table characters add column if not exists role_expiry jsonb default '{}';
alter table characters add column if not exists ig_verified_until timestamptz;
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
  -- vencimiento: los roles configurados (p. ej. 3 meses) guardan su fecha de fin al darse; los que se quitan pierden la fecha
  declare r text; m numeric; exp jsonb := '{}'; begin
    foreach r in array new.roles loop
      if coalesce(new.role_expiry, '{}') ? r then exp := exp || jsonb_build_object(r, new.role_expiry->r);
      elsif tg_op='INSERT' or not r = any(coalesce(old.roles,'{}')) then
        m := (select (value->>r)::numeric from settings where key='role_expiry_months');
        if m > 0 then exp := exp || jsonb_build_object(r, now() + make_interval(days => (m*30)::int)); end if;
      end if;
    end loop;
    new.role_expiry := exp;
  end;
  return new;
end $$;
drop trigger if exists t_characters on characters;
create trigger t_characters before insert or update on characters for each row execute function characters_guard();
update characters set roles = array_prepend('Ciudadano', roles) where not 'Ciudadano' = any(roles);

create or replace function requests_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if current_setting('app.trusted', true) = 'on' then return new; end if; -- registro hecho por una función del servidor
  if tg_op='INSERT' then
    new.user_id:=auth.uid(); new.status:='pending'; new.reviewer_id:=null; new.note:=null;
    if new.type='job' then
      select array[coalesce('mgr:'||role_tag,'char:'||posted_by),'staff:admin'] into new.dept
      from jobs where id=(new.data->>'job_id')::uuid and open;
    elsif new.type='vacaciones' then
      new.dept := array['mgr:'||(new.data->>'dept'),'staff:admin'];
    else
      select dept into new.dept from tramite_depts where type=new.type;
    end if;
    if new.dept is null then raise exception 'Trámite no válido'; end if;
    return new;
  end if;
  new.type:=old.type; new.dept:=old.dept; new.user_id:=old.user_id;
  new.character_id:=old.character_id; new.data:=old.data;
  new.reviewer_id:=auth.uid(); new.reviewed_at:=now();
  return new;
end $$;
drop trigger if exists t_requests on requests;
create trigger t_requests before insert or update on requests for each row execute function requests_guard();

-- ---------- RLS ----------
do $$ declare t text; begin
  foreach t in array array['profiles','characters','accounts','transactions','tramite_depts','requests','records',
    'posts','reviews','shifts','bans','tickets','messages','companies','holdings','jobs','properties',
    'vehicle_models','vehicles','elections','votes','store_apps','settings'] loop
    execute format('alter table %I enable row level security', t);
  end loop; end $$;

create policy p_sel on profiles for select to authenticated using (true);
create policy p_ins on profiles for insert to authenticated with check (id=auth.uid());
create policy p_upd on profiles for update to authenticated using (id=auth.uid() or staff_level()>=3);

create policy c_sel on characters for select to authenticated using (true);
create policy c_ins on characters for insert to authenticated with check (user_id=auth.uid() or staff_level()>=3);
create policy c_upd on characters for update to authenticated using (user_id=auth.uid() or staff_level()>=2);
create policy c_del on characters for delete to authenticated using (staff_level()>=3);

create policy a_sel on accounts for select to authenticated using (kind<>'personal' or owns_acc(id) or staff_level()>=1);
create policy a_all on accounts for all to authenticated using (staff_level()>=3) with check (staff_level()>=3);

create policy tx_sel on transactions for select to authenticated using (owns_acc(from_acc) or owns_acc(to_acc) or staff_level()>=1);

create policy td_sel on tramite_depts for select to authenticated using (true);
create policy td_all on tramite_depts for all to authenticated using (staff_level()>=5) with check (staff_level()>=5);

create policy r_sel on requests for select to authenticated using (
  user_id=auth.uid() or dept && my_tags() or staff_level()>=1
  or (status='approved' and (type in ('partido','campana','empresa','influencer') or is_police())));
create policy r_ins on requests for insert to authenticated with check (owns_char(character_id));
create policy r_upd on requests for update to authenticated using (
  (dept && my_tags() and user_id<>auth.uid()) or staff_level()>=3);

create policy rec_sel on records for select to authenticated using (owns_char(character_id) or is_police());
create policy rec_all on records for all to authenticated using (is_police()) with check (is_police());

create policy po_sel on posts for select to authenticated using (true);
create policy po_ins on posts for insert to authenticated with check (owns_char(character_id) or staff_level()>=2);
create policy po_del on posts for delete to authenticated using (owns_char(character_id) or staff_level()>=2);

create policy rv_sel on reviews for select to authenticated using (true);
create policy rv_ins on reviews for insert to authenticated with check (user_id=auth.uid());
create policy rv_del on reviews for delete to authenticated using (staff_level()>=2);

create policy sh_sel on shifts for select to authenticated using (staff_level()>=1);
create policy sh_ins on shifts for insert to authenticated with check (user_id=auth.uid() and staff_level()>=1);
create policy sh_upd on shifts for update to authenticated using (user_id=auth.uid() or staff_level()>=3);

create policy b_sel on bans for select to authenticated using (staff_level()>=1);
create policy b_ins on bans for insert to authenticated with check (staff_level()>=2);
create policy b_del on bans for delete to authenticated using (staff_level()>=3);

create policy tk_sel on tickets for select to authenticated using (user_id=auth.uid() or staff_level()>=1);
create policy tk_ins on tickets for insert to authenticated with check (user_id=auth.uid());
create policy tk_upd on tickets for update to authenticated using (user_id=auth.uid() or staff_level()>=1);

create policy m_sel on messages for select to authenticated using (owns_char(from_char) or owns_char(to_char));
create policy m_ins on messages for insert to authenticated with check (owns_char(from_char));

create policy co_sel on companies for select to authenticated using (true);
create policy co_ins on companies for insert to authenticated with check (staff_level()>=3);
create policy co_upd on companies for update to authenticated using (staff_level()>=3 or owns_entity(null,id));

create policy h_sel on holdings for select to authenticated using (true);

create policy j_sel on jobs for select to authenticated using (true);
create policy j_ins on jobs for insert to authenticated with check (owns_char(posted_by) or staff_level()>=3);
create policy j_upd on jobs for update to authenticated using (owns_char(posted_by) or staff_level()>=3);
create policy j_del on jobs for delete to authenticated using (owns_char(posted_by) or staff_level()>=3);

create policy pr_sel on properties for select to authenticated using (true);
create policy pr_all on properties for all to authenticated using (staff_level()>=3) with check (staff_level()>=3);
create policy vm_sel on vehicle_models for select to authenticated using (true);
create policy vm_all on vehicle_models for all to authenticated using (staff_level()>=3) with check (staff_level()>=3);
create policy v_sel on vehicles for select to authenticated using (true);
create policy v_upd on vehicles for update to authenticated using (is_police() or staff_level()>=3);

create policy e_sel on elections for select to authenticated using (true);
create policy e_all on elections for all to authenticated using (staff_level()>=3 or 'FEC' = any(my_tags()))
  with check (staff_level()>=3 or 'FEC' = any(my_tags()));
create policy vo_sel on votes for select to authenticated using (true);
create policy vo_ins on votes for insert to authenticated with check (
  user_id=auth.uid() and owns_char(character_id)
  and exists(select 1 from elections e where e.id=election_id and e.open)
  and exists(select 1 from characters c where c.id=character_id and c.status='active'));

create policy sa_sel on store_apps for select to authenticated using (approved or owns_char(author_char) or staff_level()>=1);
create policy sa_ins on store_apps for insert to authenticated with check (staff_level() >= 5); -- solo el Owner publica
create policy sa_upd on store_apps for update to authenticated using (staff_level()>=2);
create policy sa_del on store_apps for delete to authenticated using (staff_level()>=2 or owns_char(author_char));

create policy s_sel on settings for select to authenticated using (true);
alter table dept_ranks enable row level security; alter table employments enable row level security; alter table work_shifts enable row level security;
create policy dr_sel on dept_ranks for select to authenticated using (true);
create policy dr_all on dept_ranks for all to authenticated using (staff_level()>=3) with check (staff_level()>=3);
create policy em_sel on employments for select to authenticated using (true);
create policy ws_sel on work_shifts for select to authenticated using (true);
alter table penal_code enable row level security; alter table inmates enable row level security;
create policy pc_sel on penal_code for select to authenticated using (true);
create policy pc_all on penal_code for all to authenticated using (staff_level()>=3) with check (staff_level()>=3);
create policy in_sel on inmates for select to authenticated using (true);
alter table trades enable row level security; alter table price_history enable row level security;
create policy tr_sel on trades for select to authenticated using (owns_char(character_id) or staff_level()>=3);
create policy ph_sel on price_history for select to authenticated using (true);  -- lista pública de reclusos, como la real
create policy in_all on inmates for all to authenticated using (is_police()) with check (is_police());
create policy s_all on settings for all to authenticated using (staff_level()>=3) with check (staff_level()>=3);

-- ---------- Dinero (solo por estas funciones) ----------
create or replace function personal_acc(c uuid) returns uuid language sql stable security definer set search_path=public as $$
  select id from accounts where kind='personal' and owners[1]=c limit 1 $$;
create or replace function gov_acc() returns uuid language sql stable security definer set search_path=public as $$
  select id from accounts where kind='gov' limit 1 $$;

create or replace function move_money(f uuid, t uuid, amt numeric, concept text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if amt is null or amt <= 0 then raise exception 'Monto inválido'; end if;
  if f is not null then
    update accounts set balance=balance-amt where id=f and balance>=amt;
    if not found then raise exception 'Fondos insuficientes'; end if;
  end if;
  if t is not null then update accounts set balance=balance+amt where id=t; end if;
  insert into transactions(from_acc,to_acc,amount,concept) values(f,t,amt,concept);
end $$;
revoke all on function move_money(uuid,uuid,numeric,text) from public, anon, authenticated;

create or replace function transfer(from_acc uuid, dest text, amount numeric, concept text default 'Transferencia')
returns void language plpgsql security definer set search_path=public as $$
declare t uuid;
begin
  if not owns_acc(from_acc) then raise exception 'No es tu cuenta'; end if;
  select id into t from accounts where number=dest;
  if t is null and dest ~ '^[0-9a-f-]{36}$' then t := personal_acc(dest::uuid); end if;
  if t is null then raise exception 'Cuenta destino no encontrada'; end if;
  if t = from_acc then raise exception 'Es la misma cuenta'; end if;
  perform move_money(from_acc, t, amount, coalesce(nullif(concept,''),'Transferencia'));
end $$;

-- Pagos del staff: salen de la Tesorería (y lo que se quita regresa a ella). Solo el dinero inicial de una vida nueva se crea (mint).
create or replace function staff_pay(acc uuid, amount numeric, concept text, mint bool default false) returns void
language plpgsql security definer set search_path=public as $$
begin
  if staff_level() < 3 then raise exception 'Solo admins'; end if;
  if mint and amount > 0 then perform move_money(null, acc, amount, concept);
  elsif amount >= 0 then perform move_money(gov_acc(), acc, amount, concept);
  else perform move_money(acc, gov_acc(), -amount, concept); end if;
end $$;


create or replace function cpi() returns numeric language sql stable security definer set search_path=public as $$
  select coalesce((select (value#>>'{}')::numeric from settings where key='cpi'),1) $$;

create or replace function share_price(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select case when co.industry='ETF' then -- el ETF sigue el promedio del mercado
    coalesce((select round(avg(share_price(x.id))*10,2) from companies x where x.industry<>'ETF'),10)
  else greatest(1, round((
      coalesce((select balance from accounts where id=co.account_id),0)
    + coalesce((select sum(price) from properties where owner_company=co.id),0)
    + coalesce((select sum(m.price) from vehicles v join vehicle_models m on m.id=v.model_id where v.owner_company=co.id),0)
  ) / greatest(co.shares_total,1), 2)) end from companies co where co.id=c $$;


-- ---------- Impuestos (IRS federal + California FTB + FICA, sales tax de LA) ----------
create or replace function tax_cfg(k text, d numeric) returns numeric language sql stable as $$
  select coalesce((select (value->>k)::numeric from settings where key='impuestos'), d) $$;
-- impuesto anual sobre un sueldo: federal 2026 + California 2025 (soltero, deducción estándar) + FICA 7.65%
create or replace function income_tax(annual numeric) returns numeric language plpgsql immutable as $$
declare fed numeric := 0; ca numeric := 0; t numeric; lo numeric; r record;
begin
  t := greatest(annual - 16100, 0); lo := 0;
  for r in select * from (values (12400,10),(50400,12),(105700,22),(201775,24),(256225,32),(640600,35),(1e15,37)) b(hi,rate) loop
    fed := fed + greatest(least(t, r.hi) - lo, 0) * r.rate / 100; lo := r.hi; end loop;
  t := greatest(annual - 5706, 0); lo := 0;
  for r in select * from (values (11079,1),(26264,2),(41452,4),(57542,6),(72724,8),(371479,9.3),(445771,10.3),(742953,11.3),(1e15,12.3)) b(hi,rate) loop
    ca := ca + greatest(least(t, r.hi) - lo, 0) * r.rate / 100; lo := r.hi; end loop;
  if annual > 1000000 then ca := ca + (annual - 1000000) * 0.01; end if; -- Mental Health Services Tax
  return round(fed + ca + annual * 0.0765, 2);
end $$;

create or replace function buy(kind text, item uuid, acc uuid, qty int default 1) returns numeric
language plpgsql security definer set search_path=public as $$
declare a accounts; co companies; buyer uuid; price numeric; seller uuid;
        p properties; m vehicle_models; v vehicles; q int := greatest(coalesce(qty,1),1);
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select * into a from accounts where id=acc;
  if a.kind='business' then select * into co from companies where account_id=acc; else buyer := a.owners[1]; end if;
  if kind='property' then
    select * into p from properties where id=item for update;
    if not found or not p.for_sale then raise exception 'No está en venta'; end if;
    if p.owner_char is null and p.owner_company is null then
      seller := gov_acc(); price := round(p.price * cpi() * case when co.industry='Bienes Raíces' then 0.5 else 1 end, 2);
    else
      price := p.sale_price;
      seller := coalesce(personal_acc(p.owner_char),(select account_id from companies where id=p.owner_company));
    end if;
    update properties set owner_char=buyer, owner_company=co.id, for_sale=false, sale_price=null where id=item;
  elsif kind='model' then
    select * into m from vehicle_models where id=item;
    if not found then raise exception 'Modelo no existe'; end if;
    if co.id is null then q := 1; end if;
    price := m.price * cpi() * q * case when co.industry='Concesionaria' and lower(co.brand)=lower(m.brand) then 0.1
                                when co.industry='Concesionaria' then 0.3 else 1 end;
    seller := gov_acc();
    insert into vehicles(model_id,owner_char,owner_company) select item, buyer, co.id from generate_series(1,q);
  elsif kind='vehicle' then
    select * into v from vehicles where id=item for update;
    if not found or v.sale_price is null then raise exception 'No está en venta'; end if;
    price := v.sale_price;
    seller := coalesce(personal_acc(v.owner_char),(select account_id from companies where id=v.owner_company));
    update vehicles set owner_char=buyer, owner_company=co.id, sale_price=null, plate=null where id=item;
  elsif kind='shares' then
    if buyer is null then raise exception 'Compra acciones con tu cuenta personal'; end if;
    price := share_price(item) * q;
    seller := (select case when industry='ETF' then gov_acc() else account_id end from companies where id=item);
    insert into holdings(character_id,company_id,shares,cost) values(buyer,item,q,price)
      on conflict(character_id,company_id) do update set shares=holdings.shares+q, cost=holdings.cost+price;
    insert into trades(character_id,company_id,side,qty,price,total) values(buyer,item,'compra',q,price/q,price);
  else raise exception 'Tipo inválido'; end if;
  if seller = acc then raise exception 'Ya es tuyo'; end if;
  if kind='shares' then perform move_money(acc, seller, price, 'Compra de acciones'); insert into price_history(company_id,price) values(item, share_price(item)); return price; end if;
  perform move_money(acc, seller, price, 'Compra · '||case kind when 'property' then 'casa' when 'model' then 'auto nuevo' when 'vehicle' then 'auto usado' else 'acciones' end);
  -- impuestos que cobra el gobierno sobre la compra (las concesionarias no pagan sales tax al surtir inventario, como en la vida real)
  declare tax numeric := 0; lbl text; begin
    if kind in ('model','vehicle') and coalesce(co.industry,'') <> 'Concesionaria' then
      tax := round(price * tax_cfg('sales', 10.25) / 100, 2); lbl := 'Impuesto sobre ventas (Sales Tax LA)';
    elsif kind = 'property' and seller <> gov_acc() then
      tax := round(price * tax_cfg('transfer', 0.56) / 100, 2); lbl := 'Impuesto de transferencia de inmueble';
    end if;
    if tax > 0 then perform move_money(acc, gov_acc(), tax, lbl); end if;
    return price + tax;
  end;
end $$;

create or replace function sell_shares(company uuid, qty int, acc uuid) returns numeric
language plpgsql security definer set search_path=public as $$
declare c uuid; price numeric; h holdings;
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select owners[1] into c from accounts where id=acc and kind='personal';
  select * into h from holdings where character_id=c and company_id=company for update;
  if h.shares is null or h.shares < qty or qty < 1 then raise exception 'No tienes tantas acciones'; end if;
  price := share_price(company) * qty;
  -- paga la empresa; si es el ETF o la empresa no tiene efectivo (lo tiene en autos/casas), la Tesorería actúa como formador de mercado
  perform move_money((select case when co.industry='ETF' or co.account_id is null or coalesce((select balance from accounts where id=co.account_id),0) < price
                                  then gov_acc() else co.account_id end from companies co where co.id=company), acc, price, 'Venta de acciones');
  update holdings set cost = round(cost * (shares-qty) / shares, 2), shares=shares-qty where id=h.id;
  insert into trades(character_id,company_id,side,qty,price,total) values(c,company,'venta',qty,price/qty,price);
  insert into price_history(company_id,price) values(company, share_price(company));
  return price;
end $$;

create or replace function list_item(kind text, item uuid, price numeric) returns void
language plpgsql security definer set search_path=public as $$
begin
  if kind='property' then
    if not exists(select 1 from properties where id=item and owns_entity(owner_char,owner_company)) then raise exception 'No es tuya'; end if;
    update properties set for_sale = list_item.price is not null, sale_price = list_item.price where id=item;
  else
    if not exists(select 1 from vehicles where id=item and owns_entity(owner_char,owner_company)) then raise exception 'No es tuyo'; end if;
    update vehicles set sale_price = list_item.price where id=item;
  end if;
end $$;

create or replace function pay_fine(record uuid, acc uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r records;
begin
  select * into r from records where id=record and kind='multa' and not paid for update;
  if not found or not owns_char(r.character_id) then raise exception 'Multa no válida'; end if;
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  perform move_money(acc, gov_acc(), r.amount, 'Multa');
  update records set paid=true where id=record;
end $$;



-- titular de una cuenta (para confirmar transferencias sin ver saldos)
-- nombre del titular para confirmar una transferencia (personas: nombre + inicial del apellido)
create or replace function account_holder(num text) returns text
language sql stable security definer set search_path=public as $$
  select case when a.kind='personal' then c.first_name||' '||left(c.last_name,1)||'.' else a.name end
  from accounts a left join characters c on c.id = a.owners[1] where a.number = num $$;


-- ---------- Trabajos: contratar, ascender, despedir, vacaciones, turnos ----------
create or replace function is_mgr(d text) returns bool language sql stable as $$ select ('mgr:'||d) = any(my_tags()) or staff_level()>=3 $$;

create or replace function hire(c uuid, d text) returns void language plpgsql security definer set search_path=public as $$
declare r text;
begin
  if not is_mgr(d) then raise exception 'Solo los mandos de % pueden contratar', d; end if;
  select rank into r from dept_ranks where dept=d order by ord limit 1;
  if r is null then raise exception 'Departamento sin rangos'; end if;
  insert into employments(character_id,dept,rank) values(c,d,r)
    on conflict(character_id,dept) do update set rank=r, status='active', hired_at=now(), last_qualified=current_date, vacation_until=null;
  perform set_config('app.trusted','on',true);
  update characters set roles = array_append(array_remove(roles,d),d) where id=c;
end $$;

create or replace function set_rank(emp uuid, r text) returns void language plpgsql security definer set search_path=public as $$
declare e employments;
begin
  select * into e from employments where id=emp;
  if not is_mgr(e.dept) then raise exception 'Sin permiso'; end if;
  if not exists(select 1 from dept_ranks where dept=e.dept and rank=r) then raise exception 'Rango no válido'; end if;
  update employments set rank=r where id=emp;
end $$;

create or replace function fire_emp(emp uuid) returns void language plpgsql security definer set search_path=public as $$
declare e employments;
begin
  select * into e from employments where id=emp;
  if not is_mgr(e.dept) then raise exception 'Sin permiso'; end if;
  update employments set status='fired' where id=emp;
  perform set_config('app.trusted','on',true);
  update characters set roles = array_remove(roles, e.dept) where id=e.character_id;
end $$;

create or replace function set_vacation(c uuid, d text, until date) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_mgr(d) then raise exception 'Sin permiso'; end if;
  update employments set status='vacation', vacation_until=until where character_id=c and dept=d and status<>'fired';
end $$;

-- entrar / salir de turno (devuelve 'in' o 'out')
create or replace function clock(c uuid, d text) returns text language plpgsql security definer set search_path=public as $$
declare s uuid;
begin
  if not owns_char(c) then raise exception 'No es tu vida'; end if;
  if not exists(select 1 from employments where character_id=c and dept=d and status='active') then raise exception 'No trabajas activo en %', d; end if;
  select id into s from work_shifts where character_id=c and ended_at is null limit 1;
  if s is not null then update work_shifts set ended_at=now() where id=s; return 'out'; end if;
  insert into work_shifts(character_id,dept) values(c,d); return 'in';
end $$;

-- Cierre del día: paga sueldos de ayer (si cumplieron el mínimo o están de vacaciones), despide a quien faltó 7 días
-- y paga intereses de ahorro. Se puede llamar las veces que sea: solo corre una vez por día.
create or replace function daily_tick() returns text language plpgsql security definer set search_path=public as $$
declare d date := current_date - 1; g uuid := gov_acc(); e record; mins numeric; a uuid; n int := 0; f int := 0;
        minm numeric := coalesce((select (value#>>'{}')::numeric from settings where key='job_min_minutes'),60);
        rate numeric := coalesce((select (value#>>'{}')::numeric from settings where key='fed_rate'),4.5); acc record;
begin
  perform election_tick();
  if coalesce((select (value#>>'{}')::date from settings where key='last_tick'),'1970-01-01') >= current_date then return 'ya corrió hoy'; end if;
  insert into settings values('last_tick', to_jsonb(current_date::text)) on conflict(key) do update set value=excluded.value;
  update employments set status='active', vacation_until=null where status='vacation' and vacation_until < d;
  -- roles vencidos (los quita también de Discord en la siguiente sincronización)
  perform set_config('app.trusted','on',true);
  update characters c set roles = (select coalesce(array_agg(r),'{}') from unnest(c.roles) r where not (coalesce(c.role_expiry,'{}') ? r and (c.role_expiry->>r)::timestamptz < now()))
   where exists(select 1 from jsonb_each_text(coalesce(c.role_expiry,'{}')) x where x.value::timestamptz < now());
  for e in select em.*, r.salary from employments em join dept_ranks r on r.dept=em.dept and r.rank=em.rank
           join characters c on c.id=em.character_id where em.status<>'fired' and c.status='active' loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),(d+1)::timestamptz) - greatest(started_at,d::timestamptz))/60),0)
      into mins from work_shifts where character_id=e.character_id and dept=e.dept and started_at < (d+1)::timestamptz and coalesce(ended_at,now()) > d::timestamptz;
    if e.status='vacation' or mins >= minm then
      update employments set last_qualified=d where id=e.id;
      a := personal_acc(e.character_id);
      if a is not null then
        begin perform move_money(g, a, round((e.salary*cpi() - income_tax(e.salary*cpi()))/365,2), 'Nómina neta · '||e.dept||' · '||e.rank||' (ya con retención de impuestos)'); n := n+1;
        exception when others then null; end;
      end if;
    elsif e.last_qualified < d - 6 then
      update employments set status='fired' where id=e.id;
  perform set_config('app.trusted','on',true);
      update characters set roles = array_remove(roles, e.dept) where id=e.character_id; f := f+1;
    end if;
  end loop;
  insert into price_history(company_id,price) select id, share_price(id) from companies;
  for acc in select id, balance from accounts where kind='savings' and balance > 0 loop
    begin perform move_money(g, acc.id, round(acc.balance*rate/100/365,2), 'Intereses de ahorro'); exception when others then null; end;
  end loop;
  -- los negocios del rol no venden de verdad: el gobierno les paga según su giro (dueño con vida activa)
  for acc in select co.account_id, co.industry from companies co where co.account_id is not null
             and exists(select 1 from characters ch where ch.id = any(co.owners) and ch.status='active') loop
    begin perform move_money(g, acc.account_id, round(coalesce((select (value->>acc.industry)::numeric from settings where key='biz_income'),400)*cpi()*(1 - tax_cfg('corp', 29.84)/100),2),
      'Ingresos del negocio · '||coalesce(acc.industry,'')||' (neto de impuesto corporativo)'); exception when others then null; end;
  end loop;
  -- impuesto predial (property tax de LA): % anual del valor, cobrado por día a cada dueño
  for acc in select pr.price, pr.name, coalesce(personal_acc(pr.owner_char),(select account_id from companies where id=pr.owner_company)) a
             from properties pr where pr.owner_char is not null or pr.owner_company is not null loop
    if acc.a is not null then begin perform move_money(acc.a, g, round(acc.price*cpi()*tax_cfg('property', 1.2)/100/365,2), 'Impuesto predial · '||acc.name); exception when others then null; end; end if;
  end loop;
  -- el staff también cobra por moderar: sueldo anual ÷ 365 si estuvo en servicio el mínimo del día (a su primera vida activa)
  for acc in select p.id, p.staff_role from profiles p where p.staff_role is not null loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),(d+1)::timestamptz) - greatest(started_at,d::timestamptz))/60),0)
      into mins from shifts where user_id=acc.id and started_at < (d+1)::timestamptz and coalesce(ended_at,now()) > d::timestamptz;
    a := (select personal_acc(c.id) from characters c where c.user_id=acc.id and c.status='active' order by c.created_at limit 1);
    if mins >= coalesce((select (value#>>'{}')::numeric from settings where key='staff_min_minutes'),30) and a is not null then
      declare y numeric := coalesce((select (value->>acc.staff_role)::numeric from settings where key='staff_salary'),40000)*cpi(); begin
        perform move_money(g, a, round((y - income_tax(y))/365,2), 'Nómina neta · Staff · '||acc.staff_role||' (ya con retención de impuestos)'); n := n+1; exception when others then null; end;
    end if;
  end loop;
  return n||' pagos, '||f||' despidos';
end $$;

-- ---------- Ahorro, Reserva Federal e inflación ----------
create or replace function open_savings(c uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare id uuid;
begin
  if not owns_char(c) then raise exception 'No es tu vida'; end if;
  select a.id into id from accounts a where kind='savings' and owners[1]=c;
  if id is null then insert into accounts(kind,name,owners) values('savings','Ahorro', array[c]) returning accounts.id into id; end if;
  return id;
end $$;

create or replace function is_president() returns bool language sql stable as $$ select 'Presidente' = any(my_tags()) or staff_level()>=4 $$;

create or replace function print_money(amount numeric) returns numeric language plpgsql security definer set search_path=public as $$
declare supply numeric; c numeric;
begin
  if not is_president() then raise exception 'Solo el Presidente puede emitir dinero'; end if;
  select sum(balance) into supply from accounts;
  perform move_money(null, gov_acc(), amount, 'Emisión de dinero · Reserva Federal');
  c := round(cpi() * (1 + amount / greatest(supply,1) * 0.5), 4); -- la mitad del aumento de dinero se vuelve inflación
  insert into settings values('cpi', to_jsonb(c)) on conflict(key) do update set value=excluded.value;
  insert into settings values('cpi_history', jsonb_build_array(jsonb_build_object('t',now(),'cpi',c,'printed',amount)))
    on conflict(key) do update set value = settings.value || excluded.value;
  return c;
end $$;

create or replace function set_fed_rate(rate numeric) returns void language plpgsql security definer set search_path=public as $$
begin
  if not (is_president() or staff_level()>=3) then raise exception 'Sin permiso'; end if;
  if rate < 0 or rate > 25 then raise exception 'Tasa fuera de rango'; end if;
  insert into settings values('fed_rate', to_jsonb(rate)) on conflict(key) do update set value=excluded.value;
end $$;

-- Para que la nómina corra sola cada día (Supabase: Database → Extensions → activa pg_cron). Si no está, la web la corre al abrirse.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('nomina-diaria', '5 7 * * *', 'select public.daily_tick()');
exception when others then raise notice 'pg_cron no disponible: la nómina se correrá al abrir la web'; end $$;



-- ---------- Auto-CK: el jugador mata a su propia vida (sin pruebas ni aprobación) ----------
create or replace function auto_ck(c uuid, motivo text, lugar text, foto text, publicar bool) returns void
language plpgsql security definer set search_path=public as $$
declare ch characters;
begin
  if not owns_char(c) then raise exception 'No es tu vida'; end if;
  select * into ch from characters where id=c and status='active';
  if not found then raise exception 'Esa vida no está activa'; end if;
  perform set_config('app.trusted','on',true);
  update characters set status='dead' where id=c;
  insert into requests(type,dept,user_id,character_id,data,status,reviewed_at)
    values('autock','{staff:mod}',auth.uid(),c,jsonb_build_object('victima',c,'motivo',motivo,'lugar',lugar,'foto_cuerpo',foto,'publicado',publicar),'approved',now());
  if publicar then
    insert into posts(app,section,character_id,anonimo,title,body,media_url) values('news','Obituarios',null,true,
      'Fallece '||ch.first_name||' '||ch.last_name,
      'Las autoridades de Los Ángeles confirmaron el fallecimiento de '||ch.first_name||' '||ch.last_name||coalesce(' en '||nullif(lugar,''),'')||'. Descanse en paz.', nullif(foto,''));
  end if;
end $$;


-- ---------- Borrado definitivo (Owner/Admin) ----------
create or replace function delete_char(c uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if staff_level() < 3 then raise exception 'Solo admins'; end if;
  update properties set owner_char=null, for_sale=true, sale_price=null where owner_char=c;   -- vuelve a venta del gobierno
  delete from vehicles where owner_char=c;
  delete from holdings where character_id=c;
  delete from transactions where from_acc in (select id from accounts where owners[1]=c and kind in ('personal','savings'))
                              or to_acc in (select id from accounts where owners[1]=c and kind in ('personal','savings'));
  delete from accounts where owners[1]=c and kind in ('personal','savings');
  delete from characters where id=c; -- trámites, empleos, antecedentes y prisión se borran en cascada
end $$;

create or replace function delete_user(u uuid) returns void language plpgsql security definer set search_path=public as $$
declare c uuid;
begin
  if staff_level() < 5 then raise exception 'Solo el Owner'; end if;
  if u = auth.uid() then raise exception 'No puedes borrarte a ti mismo'; end if;
  for c in select id from characters where user_id=u loop perform delete_char(c); end loop;
  delete from tickets where user_id=u; delete from reviews where user_id=u; delete from shifts where user_id=u;
  delete from auth.users where id=u; -- borra el inicio de sesión y el perfil (en cascada)
end $$;


-- ---------- Elecciones automáticas, partidos con contraseña, negocios e influencers ----------
alter table elections add column if not exists period text unique, add column if not exists auto bool default false,
  add column if not exists winner text, add column if not exists installed bool default false;
create table if not exists parties(
  id uuid primary key default gen_random_uuid(), name text not null, siglas text, ideologia text, logo text,
  owner_char uuid references characters on delete set null, created_at timestamptz default now());
create table if not exists party_secrets(party_id uuid primary key references parties on delete cascade, pass_hash text not null);
create table if not exists candidacies(
  id uuid primary key default gen_random_uuid(), period text not null, office text default 'Presidente',
  character_id uuid references characters on delete cascade, party_id uuid references parties on delete set null,
  slogan text, propuestas text, foto text, created_at timestamptz default now(), unique(period, character_id));
create table if not exists post_likes(post_id uuid references posts on delete cascade, user_id uuid default auth.uid(), primary key(post_id, user_id));
alter table parties enable row level security; alter table party_secrets enable row level security; -- sin políticas: nadie lee las contraseñas
alter table candidacies enable row level security; alter table post_likes enable row level security;
drop policy if exists pa_sel on parties; create policy pa_sel on parties for select to authenticated using (true);
drop policy if exists pa_all on parties; create policy pa_all on parties for all to authenticated using (staff_level()>=3 or 'FEC' = any(my_tags())) with check (staff_level()>=3 or 'FEC' = any(my_tags()));
drop policy if exists ca_sel on candidacies; create policy ca_sel on candidacies for select to authenticated using (true);
drop policy if exists ca_del on candidacies; create policy ca_del on candidacies for delete to authenticated using (staff_level()>=3 or 'FEC' = any(my_tags()) or owns_char(character_id));
drop policy if exists pl_sel on post_likes; create policy pl_sel on post_likes for select to authenticated using (true);
-- partidos ya aprobados antes de este cambio
insert into parties(name, siglas, ideologia, logo, owner_char)
  select r.data->>'nombre', r.data->>'siglas', r.data->>'ideologia', r.data->>'logo', r.character_id from requests r
  where r.type='partido' and r.status='approved' and not exists(select 1 from parties p where p.name = r.data->>'nombre');

create or replace function elec_cfg(k text) returns int language sql stable as $$
  select coalesce((select (value->>k)::int from settings where key='elecciones'), case k when 'registro_hasta' then 20 when 'votacion_desde' then 21 else 27 end) $$;
create or replace function pass_hash(p uuid, pass text) returns text language sql immutable as $$ select encode(sha256(convert_to(p::text||':'||pass,'UTF8')),'hex') $$;

create or replace function set_party_pass(p uuid, pass text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from parties where id=p and (owns_char(owner_char) or staff_level()>=3)) then raise exception 'Solo el dueño del partido'; end if;
  if length(coalesce(pass,'')) < 4 then raise exception 'La contraseña debe tener al menos 4 caracteres'; end if;
  insert into party_secrets values(p, pass_hash(p, pass)) on conflict(party_id) do update set pass_hash=excluded.pass_hash;
end $$;

create or replace function run_for_office(c uuid, party uuid, pass text, slogan text, propuestas text, foto text) returns void
language plpgsql security definer set search_path=public as $$
declare per text := to_char(current_date,'YYYY-MM');
begin
  if not owns_char(c) then raise exception 'No es tu vida'; end if;
  if not exists(select 1 from characters where id=c and status='active') then raise exception 'Tu vida debe estar activa'; end if;
  if extract(day from current_date) > elec_cfg('registro_hasta') then raise exception 'El registro de candidatos cerró el día %. Vuelve el próximo mes.', elec_cfg('registro_hasta'); end if;
  if party is not null and not exists(select 1 from party_secrets where party_id=party and pass_hash=pass_hash(party, coalesce(pass,''))) then
    raise exception 'Contraseña del partido incorrecta'; end if;
  insert into candidacies(period, character_id, party_id, slogan, propuestas, foto) values(per, c, party, slogan, propuestas, foto)
    on conflict(period, character_id) do update set party_id=excluded.party_id, slogan=excluded.slogan, propuestas=excluded.propuestas, foto=excluded.foto;
end $$;

-- Abre, cierra y da posesión a las elecciones presidenciales sin que nadie haga nada
create or replace function election_tick() returns void language plpgsql security definer set search_path=public as $$
declare per text := to_char(current_date,'YYYY-MM'); dy int := extract(day from current_date); e record; w text; c uuid;
begin
  for e in select * from elections where auto and open and (period < per or (period = per and dy > elec_cfg('votacion_hasta'))) loop
    select v.choice into w from votes v where v.election_id=e.id group by v.choice order by count(*) desc, min(v.created_at) limit 1;
    update elections set open=false, winner=w where id=e.id;
  end loop;
  select * into e from elections where auto and not open and not installed and period < per order by period desc limit 1;
  if found then
    perform set_config('app.trusted','on',true);
    update characters set roles = array_remove(roles,'Presidente') where 'Presidente' = any(roles);
    update employments set status='fired' where dept='Presidente' and status<>'fired';
    update elections set installed=true where auto and period <= e.period;
    c := nullif(e.winner,'')::uuid;
    if c is not null and exists(select 1 from characters where id=c and status='active') then
      update characters set roles = array_append(array_remove(roles,'Presidente'),'Presidente') where id=c;
      insert into employments(character_id, dept, rank, status, last_qualified)
        select c, 'Presidente', (select rank from dept_ranks where dept='Presidente' order by ord limit 1), 'active', current_date
        where exists(select 1 from dept_ranks where dept='Presidente')
        on conflict (character_id, dept) do update set status='active', rank=excluded.rank, last_qualified=current_date;
    end if;
  end if;
  if dy between elec_cfg('votacion_desde') and elec_cfg('votacion_hasta') and not exists(select 1 from elections where period=per)
     and exists(select 1 from candidacies where period=per) then
    insert into elections(title, office, candidates, open, period, auto) values(
      'Elección presidencial · '||per, 'Presidente', (select jsonb_agg(character_id::text order by created_at) from candidacies where period=per), true, per, true);
  end if;
end $$;

create or replace function like_post(id uuid) returns void language plpgsql security definer set search_path=public as $$
declare p posts; a uuid; pay numeric;
begin
  insert into post_likes(post_id, user_id) values(like_post.id, auth.uid()) on conflict do nothing;
  if not found then return; end if;   -- un like por cuenta
  update posts set likes=likes+1 where posts.id=like_post.id returning * into p;
  if p.character_id is null or exists(select 1 from characters ch where ch.id=p.character_id and user_id=auth.uid()) then return; end if;
  if exists(select 1 from characters ch where ch.id=p.character_id and status='active' and 'Influencer' = any(roles)) then
    pay := coalesce((select (value#>>'{}')::numeric from settings where key='influencer_like_pay'),15) * cpi();
    a := personal_acc(p.character_id);
    if a is not null then begin perform move_money(gov_acc(), a, round(pay,2), 'Influencer · pago por like'); exception when others then null; end; end if;
  end if;
end $$;

create or replace function pay_gov(c uuid, amount numeric, concept text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not owns_char(c) then raise exception 'No es tu vida'; end if;
  if amount <= 0 then raise exception 'Monto inválido'; end if;
  perform move_money(personal_acc(c), gov_acc(), amount, concept);
end $$;

alter table characters add column if not exists ig_verified_until timestamptz;

-- Sitios web que crean los jugadores (Google Sites del rol)
create table if not exists sites(
  id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null, tagline text, body text,
  color text default '#1a73e8', img text, owner_char uuid references characters on delete cascade, created_at timestamptz default now());
alter table sites enable row level security;
drop policy if exists si_sel on sites; create policy si_sel on sites for select to authenticated using (true);
drop policy if exists si_ins on sites; create policy si_ins on sites for insert to authenticated with check (owns_char(owner_char) and slug ~ '^[a-z0-9-]{3,40}$');
drop policy if exists si_upd on sites; create policy si_upd on sites for update to authenticated using (owns_char(owner_char) or staff_level()>=3);
drop policy if exists si_del on sites; create policy si_del on sites for delete to authenticated using (owns_char(owner_char) or staff_level()>=3);

-- Spotify del rol: canciones que suben los jugadores
create table if not exists songs(
  id uuid primary key default gen_random_uuid(), title text not null, artist text, cover text, url text not null,
  uploader_char uuid references characters on delete set null, created_at timestamptz default now());
alter table songs enable row level security;
drop policy if exists so_sel on songs; create policy so_sel on songs for select to authenticated using (true);
drop policy if exists so_ins on songs; create policy so_ins on songs for insert to authenticated with check (owns_char(uploader_char));
drop policy if exists so_del on songs; create policy so_del on songs for delete to authenticated using (owns_char(uploader_char) or staff_level()>=2);


-- ---------- Bot de Discord: la web manda, el bot pone y quita roles ----------
alter table characters add column if not exists role_expiry jsonb default '{}';
create table if not exists bot_keys(id int primary key default 1, key_hash text not null, created_at timestamptz default now());
alter table bot_keys enable row level security; -- sin políticas: nadie la lee desde la web
create or replace function new_bot_key() returns text language plpgsql security definer set search_path=public as $$
declare k text := replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
begin
  if staff_level() < 5 then raise exception 'Solo el Owner'; end if;
  insert into bot_keys(id,key_hash) values(1, encode(sha256(convert_to(k,'UTF8')),'hex')) on conflict(id) do update set key_hash=excluded.key_hash, created_at=now();
  return k;  -- se muestra una sola vez
end $$;
create or replace function discord_sync(bot_key text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from bot_keys where key_hash = encode(sha256(convert_to(coalesce(bot_key,''),'UTF8')),'hex')) then raise exception 'Llave del bot inválida'; end if;
  insert into settings values('discord_last_sync', to_jsonb(now()::text)) on conflict(key) do update set value=excluded.value;
  return jsonb_build_object('users', coalesce((select jsonb_agg(jsonb_build_object('discord', lower(trim(leading '@' from p.discord)), 'username', p.username, 'banned', coalesce(p.banned,false),
      'staff', p.staff_role, 'verified', coalesce(p.verified,false),
      'roles', coalesce((select jsonb_agg(distinct r) from characters c, unnest(c.roles) r where c.user_id=p.id and c.status='active'), '[]')))
    from profiles p where coalesce(p.discord,'') <> ''), '[]'));
end $$;
grant execute on function discord_sync(text) to anon;

-- Spotify: cuentas, géneros, me gusta, playlists y Jams (escuchar juntos)
alter table songs add column if not exists genre text;
create table if not exists sp_profiles(character_id uuid primary key references characters on delete cascade, name text not null, avatar text, bio text, color text default '#1db954', created_at timestamptz default now());
create table if not exists song_likes(song_id uuid references songs on delete cascade, character_id uuid references characters on delete cascade, primary key(song_id, character_id));
create table if not exists playlists(id uuid primary key default gen_random_uuid(), owner_char uuid references characters on delete cascade, name text not null, cover text, songs uuid[] default '{}', created_at timestamptz default now());
create table if not exists jams(id uuid primary key default gen_random_uuid(), code text unique not null, host_char uuid references characters on delete cascade, members uuid[] default '{}',
  song_id uuid, playing bool default false, position numeric default 0, updated_at timestamptz default now(), created_at timestamptz default now());
alter table sp_profiles enable row level security; alter table song_likes enable row level security; alter table playlists enable row level security; alter table jams enable row level security;
drop policy if exists spp_sel on sp_profiles; create policy spp_sel on sp_profiles for select to authenticated using (true);
drop policy if exists spp_all on sp_profiles; create policy spp_all on sp_profiles for all to authenticated using (owns_char(character_id)) with check (owns_char(character_id));
drop policy if exists sl_sel on song_likes; create policy sl_sel on song_likes for select to authenticated using (true);
drop policy if exists sl_all on song_likes; create policy sl_all on song_likes for all to authenticated using (owns_char(character_id)) with check (owns_char(character_id));
drop policy if exists pl_sel2 on playlists; create policy pl_sel2 on playlists for select to authenticated using (true);
drop policy if exists pl_all2 on playlists; create policy pl_all2 on playlists for all to authenticated using (owns_char(owner_char)) with check (owns_char(owner_char));
drop policy if exists jm_sel on jams; create policy jm_sel on jams for select to authenticated using (exists(select 1 from unnest(members) m where owns_char(m)));
drop policy if exists jm_ins on jams; create policy jm_ins on jams for insert to authenticated with check (owns_char(host_char));
drop policy if exists jm_upd on jams; create policy jm_upd on jams for update to authenticated using (exists(select 1 from unnest(members) m where owns_char(m)));
drop policy if exists jm_del on jams; create policy jm_del on jams for delete to authenticated using (owns_char(host_char));
-- solo cambia la hora cuando cambia lo que suena; unirse no debe mover el segundo de la Jam
create or replace function jams_touch() returns trigger language plpgsql as $$ begin
  new.updated_at := case when (new.song_id, new.playing, new.position) is distinct from (old.song_id, old.playing, old.position) then now() else old.updated_at end;
  return new; end $$;
drop trigger if exists t_jams on jams; create trigger t_jams before update on jams for each row execute function jams_touch();
-- unirse con el código que te pasan
create or replace function join_jam(jam_code text, c uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare j uuid;
begin
  if not owns_char(c) then raise exception 'No es tu vida'; end if;
  update jams set members = array_append(array_remove(members, c), c) where code = upper(trim(jam_code)) returning id into j;
  if j is null then raise exception 'No existe una Jam con ese código'; end if;
  return j;
end $$;
-- hora del servidor (para que todos vayan al mismo segundo)
create or replace function server_now() returns timestamptz language sql stable as $$ select now() $$;
do $$ begin execute 'alter publication supabase_realtime add table jams'; exception when others then null; end $$;

-- ---------- Tiempo real: la web se actualiza sola ----------
do $$ declare t text; begin
  foreach t in array array['profiles','characters','accounts','transactions','requests','records','posts','reviews','shifts','bans','tickets',
    'messages','companies','holdings','jobs','properties','vehicle_models','vehicles','elections','votes','store_apps','settings',
    'dept_ranks','employments','work_shifts','penal_code','inmates','trades','price_history','parties','candidacies'] loop
    begin execute format('alter publication supabase_realtime add table %I', t); exception when others then null; end;
  end loop;
end $$;

-- ---------- Archivos (fotos) ----------
insert into storage.buckets(id,name,public) values('uploads','uploads',true) on conflict do nothing;
create policy up_ins on storage.objects for insert to authenticated with check (bucket_id='uploads');
create policy up_sel on storage.objects for select using (bucket_id='uploads');
-- Una sola cuenta por usuario de Discord (sin importar @, espacios ni mayúsculas)
create unique index if not exists profiles_discord_unico on profiles (lower(trim(leading '@' from trim(discord)))) where coalesce(trim(discord),'') <> '';
-- revisión antes de crear la cuenta (se llama sin sesión)
create or replace function signup_check(u text, d text) returns text language sql stable security definer set search_path=public as $$
  select case
    when exists(select 1 from profiles where username = lower(u)) then 'Ese usuario de la web ya existe'
    when exists(select 1 from profiles where lower(trim(leading '@' from trim(discord))) = lower(trim(leading '@' from trim(d)))) then 'Ese Discord ya tiene una cuenta. Solo se permite una cuenta por Discord.'
  end $$;
grant execute on function signup_check(text, text) to anon, authenticated;
-- Verificación de Discord al registrarse: el bot manda un código de 6 dígitos por DM, dura 5 minutos.
create or replace function dnorm(t text) returns text language sql immutable as $$ select lower(trim(leading '@' from trim(coalesce(t,'')))) $$;
create table if not exists discord_codes(discord text primary key, code_hash text not null, expires_at timestamptz not null,
  attempts int not null default 0, verified_at timestamptz, created_at timestamptz not null default now());
alter table discord_codes enable row level security; -- sin políticas: solo las funciones de abajo la tocan

-- la llama la función de Netlify (con la llave del bot) justo antes de mandar el DM
create or replace function discord_code_issue(bot_key text, d text, code text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from bot_keys where key_hash = encode(sha256(convert_to(coalesce(bot_key,''),'UTF8')),'hex')) then raise exception 'Llave del bot inválida'; end if;
  if exists(select 1 from profiles where dnorm(discord) = dnorm(d)) then raise exception 'Ese Discord ya tiene una cuenta. Solo se permite una cuenta por Discord.'; end if;
  if exists(select 1 from discord_codes where discord = dnorm(d) and created_at > now() - interval '60 seconds') then raise exception 'Espera un minuto antes de pedir otro código.'; end if;
  insert into discord_codes(discord, code_hash, expires_at) values(dnorm(d), encode(sha256(convert_to(code,'UTF8')),'hex'), now() + interval '5 minutes')
  on conflict(discord) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, verified_at = null, created_at = now();
end $$;
revoke execute on function discord_code_issue(text,text,text) from public; grant execute on function discord_code_issue(text,text,text) to anon;

-- la llama la web al registrarse; 5 intentos máximo por código
create or replace function discord_code_verify(d text, code text) returns boolean language plpgsql security definer set search_path=public as $$
declare r discord_codes;
begin
  select * into r from discord_codes where discord = dnorm(d);
  if r is null then raise exception 'Primero pide tu código con «Enviarme código por Discord».'; end if;
  if r.expires_at < now() then raise exception 'Tu código expiró (dura 5 minutos). Pide uno nuevo.'; end if;
  if r.attempts >= 5 then raise exception 'Demasiados intentos. Pide un código nuevo.'; end if;
  if r.code_hash = encode(sha256(convert_to(trim(code),'UTF8')),'hex') then update discord_codes set verified_at = now() where discord = r.discord; return true; end if;
  update discord_codes set attempts = attempts + 1 where discord = r.discord; return false;
end $$;
grant execute on function discord_code_verify(text,text) to anon, authenticated;

-- nadie crea cuenta sin Discord verificado (salvo que el bot aún no esté configurado)
create or replace function profiles_discord_verificado() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from bot_keys) and not exists(select 1 from discord_codes where discord = dnorm(new.discord) and verified_at > now() - interval '30 minutes')
    then raise exception 'Verifica tu Discord con el código que te manda el bot.'; end if;
  return new;
end $$;
drop trigger if exists t_profiles_discord on profiles;
create trigger t_profiles_discord before insert on profiles for each row execute function profiles_discord_verificado();
-- Archivos del escritorio: carpetas, documentos, presentaciones y hojas de cálculo (privados de cada cuenta)
create table if not exists files(id uuid primary key default gen_random_uuid(), owner uuid not null default auth.uid() references profiles on delete cascade,
  parent uuid references files on delete cascade, name text not null check (length(name) between 1 and 80),
  kind text not null check (kind in ('folder','doc','slides','sheet')), content jsonb not null default '{}' check (pg_column_size(content) < 2000000),
  updated_at timestamptz default now(), created_at timestamptz default now());
create index if not exists files_owner on files(owner);
alter table files enable row level security;
drop policy if exists f_all on files;
create policy f_all on files for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
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
-- Spotify: el gobierno paga regalías por reproducción. Instagram: seguidores, comentarios y reposts; más seguidores = más pago por like.
alter table songs add column if not exists plays int not null default 0;
create table if not exists song_plays(song_id uuid references songs on delete cascade, character_id uuid references characters on delete cascade, day date not null default current_date, primary key(song_id, character_id, day));
alter table song_plays enable row level security; -- solo la función de abajo escribe
create or replace function song_play(s uuid, c uuid) returns void language plpgsql security definer set search_path=public as $$
declare sg songs; a uuid;
begin
  if not owns_char(c) then raise exception 'No es tu vida'; end if;
  insert into song_plays(song_id, character_id) values(s, c) on conflict do nothing;
  if not found then return; end if; -- cuenta 1 vez por persona al día
  update songs set plays = plays + 1 where id = s returning * into sg;
  if sg.id is null or not sg.approved or sg.uploader_char is null or owns_char(sg.uploader_char) then return; end if; -- escucharte a ti mismo no paga
  a := personal_acc(sg.uploader_char);
  if a is not null then begin perform move_money(gov_acc(), a, round(coalesce((select (value#>>'{}')::numeric from settings where key='spotify_play_pay'),2) * cpi(), 2), 'Spotify · regalías por reproducción'); exception when others then null; end; end if;
end $$;
grant execute on function song_play(uuid, uuid) to authenticated;

create table if not exists follows(follower uuid references characters on delete cascade, followed uuid references characters on delete cascade, created_at timestamptz default now(), primary key(follower, followed), check (follower <> followed));
alter table follows enable row level security;
drop policy if exists fo_sel on follows; create policy fo_sel on follows for select to authenticated using (true);
drop policy if exists fo_ins on follows; create policy fo_ins on follows for insert to authenticated with check (owns_char(follower));
drop policy if exists fo_del on follows; create policy fo_del on follows for delete to authenticated using (owns_char(follower));
create table if not exists post_comments(id uuid primary key default gen_random_uuid(), post_id uuid not null references posts on delete cascade, character_id uuid references characters on delete cascade,
  body text not null check (length(body) between 1 and 300), created_at timestamptz default now());
alter table post_comments enable row level security;
drop policy if exists pc_sel on post_comments; create policy pc_sel on post_comments for select to authenticated using (true);
drop policy if exists pc_ins on post_comments; create policy pc_ins on post_comments for insert to authenticated with check (owns_char(character_id));
drop policy if exists pc_del on post_comments; create policy pc_del on post_comments for delete to authenticated using (owns_char(character_id) or staff_level()>=2);
alter table posts add column if not exists repost_of uuid references posts on delete cascade;
create unique index if not exists posts_un_repost on posts(character_id, repost_of) where repost_of is not null;

create or replace function like_post(id uuid) returns void language plpgsql security definer set search_path=public as $$
declare p posts; a uuid; pay numeric;
begin
  insert into post_likes(post_id, user_id) values(like_post.id, auth.uid()) on conflict do nothing;
  if not found then return; end if;   -- un like por cuenta
  update posts set likes=likes+1 where posts.id=like_post.id returning * into p;
  if p.character_id is null or exists(select 1 from characters ch where ch.id=p.character_id and user_id=auth.uid()) then return; end if;
  if exists(select 1 from characters ch where ch.id=p.character_id and status='active' and 'Influencer' = any(roles)) then
    -- cada 20 seguidores suben el pago un 100 %, hasta ×5
    pay := coalesce((select (value#>>'{}')::numeric from settings where key='influencer_like_pay'),15) * cpi() * least(5, 1 + (select count(*) from follows f where f.followed = p.character_id) / 20.0);
    a := personal_acc(p.character_id);
    if a is not null then begin perform move_money(gov_acc(), a, round(pay,2), 'Influencer · pago por like'); exception when others then null; end; end if;
  end if;
end $$;
