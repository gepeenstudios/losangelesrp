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
-- Instagram: visualizaciones (1 por cuenta por publicación)
alter table posts add column if not exists views int not null default 0;
create table if not exists post_views(post_id uuid references posts on delete cascade, user_id uuid default auth.uid(), primary key(post_id, user_id));
alter table post_views enable row level security; -- solo la función de abajo escribe
create or replace function view_posts(ids uuid[]) returns void language sql security definer set search_path=public as $$
  with nuevo as (insert into post_views(post_id, user_id) select p.id, auth.uid() from posts p where p.id = any(ids) and auth.uid() is not null on conflict do nothing returning post_id)
  update posts set views = views + 1 where id in (select post_id from nuevo) $$;
grant execute on function view_posts(uuid[]) to authenticated;
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
-- Registro vehicular: cada auto tiene un VIN único y una fecha de registro que se renueva cuando cambia de dueño
alter table vehicles add column if not exists vin text, add column if not exists registered_at timestamptz default now();
create or replace function new_vin() returns text language sql volatile as $$
  select string_agg(substr('0123456789ABCDEFGHJKLMNPRSTUVWXYZ', 1 + floor(random() * 33)::int, 1), '') from generate_series(1, 17) $$;
create or replace function vehicles_reg() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.vin := coalesce(new.vin, new_vin()); new.registered_at := now();
  else
    new.vin := coalesce(old.vin, new.vin, new_vin()); -- el VIN no se cambia nunca
    if (new.owner_char, new.owner_company) is distinct from (old.owner_char, old.owner_company) then new.registered_at := now(); end if;
  end if;
  return new;
end $$;
drop trigger if exists t_vehicles_reg on vehicles;
create trigger t_vehicles_reg before insert or update on vehicles for each row execute function vehicles_reg();
update vehicles set vin = new_vin() where vin is null;
create unique index if not exists vehicles_vin on vehicles(vin);
-- Código Penal real de Los Ángeles RP: reemplaza el provisional. 1 mes de prisión = 5 min (1 año = 60 min); más de 10 años = juicio.
alter table penal_code add column if not exists lic boolean not null default false;
delete from penal_code;
insert into penal_code(code, title, kind, fine, years, lic, notes) values
  ('Art. 4', 'Conducción temeraria', 'infraccion', 1000, 0.0, true, null),
  ('Art. 5', 'Daño a propiedad con un vehículo', 'infraccion', 5500, 0.0, false, 'Más la reparación total de los daños'),
  ('Art. 6', 'Ignorar un semáforo (por cada uno)', 'infraccion', 5000, 0.0, false, null),
  ('Art. 7', 'Conducir en sentido contrario', 'infraccion', 5000, 0.0, true, null),
  ('Art. 8', 'Conducir bajo efectos de alcohol o drogas', 'infraccion', 12500, 0.0, true, null),
  ('Art. 9', 'Arma no autorizada dentro del vehículo', 'infraccion', 13000, 0.0, false, 'Incautación temporal del vehículo (solo un juez la devuelve)'),
  ('Art. 10', 'Exceso de velocidad', 'infraccion', 3200, 0.0, true, null),
  ('Art. 11', 'Conducir sin licencia', 'infraccion', 14000, 0.0, false, 'Prisión temporal hasta ponerlo ante la justicia'),
  ('Art. 12', 'Carreras ilegales', 'menor', 16500, 1.0, true, null),
  ('Art. 13', 'Estacionarse en lugar prohibido', 'infraccion', 2500, 0.0, false, 'Si no está el conductor, al depósito'),
  ('Art. 13.1', 'Traslado al depósito (mal estacionado)', 'infraccion', 7500, 0.0, false, null),
  ('Art. 14', 'Estacionarse obstruyendo la circulación', 'infraccion', 5000, 0.0, false, 'Si no está el conductor, al depósito'),
  ('Art. 14.1', 'Traslado al depósito (obstrucción)', 'infraccion', 10500, 0.0, false, null),
  ('Art. 15', 'No ceder el paso a emergencias', 'infraccion', 30000, 0.0, true, null),
  ('Art. 16', 'Circular sin luces de noche', 'infraccion', 2000, 0.0, true, null),
  ('Art. 17', 'Vehículo con fallas técnicas o mecánicas', 'infraccion', 8000, 0.0, true, null),
  ('Art. 18', 'Arrojar objetos a la vía', 'infraccion', 6000, 0.0, false, null),
  ('Art. 19', 'Incumplir las normas de tráfico', 'infraccion', 5000, 0.0, true, null),
  ('Art. 20', 'Adelantamiento indebido', 'infraccion', 6000, 0.0, true, null),
  ('Art. 21', 'Ignorar a un agente o evadir un control', 'infraccion', 10000, 0.0, true, null),
  ('Art. 22', 'Usar el celular al conducir', 'infraccion', 3000, 0.0, true, null),
  ('Art. 23', 'Circular fuera de la calzada', 'infraccion', 8000, 0.0, true, null),
  ('Art. 24', 'Uso indebido del claxon', 'infraccion', 3000, 0.0, false, null),
  ('Art. 25', 'Huir de un accidente sin socorrer', 'infraccion', 20000, 0.0, false, 'Prisión provisional'),
  ('Art. 26', 'Causar un accidente mayor', 'infraccion', 70500, 0.0, true, null),
  ('Art. 27', 'Circular sin placa', 'infraccion', 30500, 0.0, false, 'Vehículo al depósito (+$7,500)'),
  ('Art. 28', 'Cruzar la calle indebidamente (peatón)', 'infraccion', 3000, 0.0, false, null),
  ('Art. 29', 'Riña con agresión o daños materiales', 'infraccion', 20200, 0.0, false, 'Prisión temporal'),
  ('Art. 30', 'Agresión física o verbal', 'grave', 30000, 2.0, false, 'Indemnizar a la víctima con $40,000–$80,000'),
  ('Art. 31', 'Funcionario que no lee los derechos al detenido', 'infraccion', 50000, 0.0, false, 'Suspensión de 2 años'),
  ('Art. 31.1', 'Funcionario que incumple el habeas corpus', 'infraccion', 100000, 0.0, false, 'Hasta $150,000'),
  ('Art. 32', 'Alteración del orden público', 'menor', 0, 0.083333, false, null),
  ('Art. 33', 'Comercio de productos no autorizados', 'infraccion', 10000, 0.0, false, 'Incautación de la mercancía'),
  ('Art. 34', 'Inducción a la alteración pública', 'menor', 50000, 0.5, false, null),
  ('Art. 35', 'Inducir a otro a cometer delitos', 'grave', 0, 2.0, false, null),
  ('Art. 36', 'Pertenecer a un grupo criminal', 'grave', 0, 2.0, false, null),
  ('Art. 36.1', 'Trabajar para un grupo criminal', 'menor', 0, 1.0, false, null),
  ('Art. 36.2', 'Jefe de grupo criminal (se suma)', 'infraccion', 200000, 0.0, false, null),
  ('Art. 36.3', 'Subjefe de grupo criminal (se suma)', 'infraccion', 100000, 0.0, false, null),
  ('Art. 36.4', 'Autoridad que encubre a un grupo criminal', 'menor', 50000, 1.0, false, null),
  ('Art. 37', 'Agresión por discriminación', 'infraccion', 10000, 0.0, false, null),
  ('Art. 38', 'Suplantar la identidad de otra persona', 'menor', 10000, 0.5, false, '+50 % si suplanta a una autoridad'),
  ('Art. 39', 'Acoso reiterado', 'menor', 10000, 1.0, false, 'Requiere informe médico'),
  ('Art. 40', 'Violencia doméstica', 'grave', 50000, 2.0, false, null),
  ('Art. 41', 'Allanamiento de morada', 'infraccion', 50000, 0.0, false, 'Prisión temporal'),
  ('Art. 42', 'Usurpación', 'grave', 60000, 2.0, false, null),
  ('Art. 43', 'Hurto', 'infraccion', 10000, 0.0, false, 'Prisión temporal'),
  ('Art. 44', 'Asalto con arma blanca', 'grave', 40000, 2.0, false, null),
  ('Art. 45', 'Asalto con arma de fuego', 'grave', 60000, 2.0, false, null),
  ('Art. 46', 'Robo con violencia o intimidación', 'grave', 60000, 2.0, false, null),
  ('Art. 47', 'Daño a propiedad del Estado', 'infraccion', 30000, 0.0, false, 'Más la indemnización de los daños'),
  ('Art. 48', 'Poseer armas sin licencia', 'menor', 20500, 1.0, false, null),
  ('Art. 49', 'Usar armas sin licencia', 'menor', 20500, 1.0, false, 'Excepto defensa propia probada'),
  ('Art. 50', 'Comercio ilegal de armas', 'grave', 120000, 2.0, false, null),
  ('Art. 51', 'Intento de homicidio', 'grave', 0, 2.0, false, null),
  ('Art. 52', 'Intento de homicidio a mano armada', 'grave', 0, 3.0, false, null),
  ('Art. 53', 'Homicidio', 'grave', 0, 4.0, false, null),
  ('Art. 54', 'Homicidio con arma', 'grave', 0, 4.0, false, null),
  ('Art. 55', 'Homicidio múltiple', 'grave', 0, 6.0, false, '+3 años por cada víctima después de la segunda. Juicio especial'),
  ('Art. 56', 'Secuestro', 'grave', 0, 3.0, false, null),
  ('Art. 57', 'Extorsión', 'grave', 50000, 2.0, false, null),
  ('Art. 58', 'Amenazas', 'menor', 60000, 1.0, false, null),
  ('Art. 58.2', 'Ayudar a ejecutar amenazas', 'menor', 30000, 1.0, false, null),
  ('Art. 59', 'Falsificación de documentos', 'grave', 100000, 2.0, false, 'Multa de $100,000 a $1,000,000'),
  ('Art. 60', 'Indebida documentación', 'infraccion', 5000, 0.0, false, 'Traslado a comisaría para identificarlo'),
  ('Art. 61', 'Estafa', 'infraccion', 50000, 0.0, false, 'Más la indemnización de las pérdidas'),
  ('Art. 62', 'Desobediencia a la autoridad', 'infraccion', 20000, 0.0, false, null),
  ('Art. 62.1', 'Incumplir un veredicto judicial', 'menor', 30000, 0.5, false, null),
  ('Art. 63', 'Falso reporte a emergencias', 'infraccion', 10000, 0.0, false, 'Prisión temporal'),
  ('Art. 64', 'Invadir una instalación restringida', 'infraccion', 40000, 0.0, false, 'Expulsión inmediata'),
  ('Art. 65', 'Robo de objeto del Estado', 'grave', 80000, 2.0, false, null),
  ('Art. 66', 'Suplantación de identidad para beneficio', 'grave', 150000, 2.0, false, null),
  ('Art. 67', 'Resistencia a la autoridad', 'infraccion', 10000, 0.0, false, null),
  ('Art. 68', 'Evasión a la autoridad', 'menor', 70500, 0.083333, false, null),
  ('Art. 69', 'Soborno', 'grave', 50000, 3.0, false, null),
  ('Art. 70', 'Terrorismo', 'grave', 5000000, 99.0, false, 'Prisión perpetua. Juicio en la Suprema Corte'),
  ('Art. 71', 'Atentar contra un funcionario público', 'grave', 0, 2.0, false, null),
  ('Art. 72', 'Resolución arbitraria de un funcionario', 'infraccion', 0, 0.0, false, 'Inhabilitación del cargo'),
  ('Art. 73', 'Nombramiento ilegal de un cargo público', 'infraccion', 1000000, 0.0, false, 'Inhabilitación del cargo'),
  ('Art. 74', 'Funcionario que ignora un delito', 'infraccion', 0, 0.0, false, 'Inhabilitación del cargo'),
  ('Art. 75', 'Funcionario que no persigue delitos', 'infraccion', 0, 0.0, false, 'Inhabilitación del cargo'),
  ('Art. 76', 'Funcionario que calumnia a una institución', 'infraccion', 250000, 0.0, false, null),
  ('Art. 77', 'Funcionario que desobedece resoluciones', 'infraccion', 500000, 0.0, false, 'Inhabilitación del cargo'),
  ('Art. 78', 'Funcionario que niega auxilio a la justicia', 'infraccion', 250000, 0.0, false, 'Inhabilitación del cargo'),
  ('Art. 79', 'Destruir u ocultar documentos oficiales', 'infraccion', 100000, 0.0, false, 'Inhabilitación del cargo'),
  ('Art. 80', 'Contaminar la cadena de evidencia', 'infraccion', 200000, 0.0, false, 'Inhabilitación del cargo'),
  ('Art. 81', 'Revelación de secretos', 'infraccion', 500000, 0.0, false, 'Inhabilitación del cargo'),
  ('Art. 81.1', 'Aprovechar información privilegiada', 'menor', 250000, 1.0, false, null),
  ('Art. 82', 'Cohecho (acto contrario a su deber)', 'grave', 1000000, 3.0, false, 'Inhabilitación del cargo'),
  ('Art. 83', 'Cohecho (acto propio del cargo)', 'menor', 500000, 1.0, false, 'Inhabilitación del cargo'),
  ('Art. 84', 'Aceptar regalos por el cargo', 'infraccion', 750000, 0.0, false, null),
  ('Art. 86', 'Tráfico de influencias', 'menor', 500000, 1.0, false, 'Inhabilitación del cargo (no aplica a civiles)'),
  ('Art. 87', 'Malversación', 'grave', 1000000, 6.0, false, null),
  ('Art. 88', 'Fraude en contratación pública', 'infraccion', 500000, 0.0, false, 'Inhabilitación del cargo');
insert into settings(key, value) values('prison_min_per_year', '60') on conflict(key) do update set value = excluded.value;
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
-- 911: los ciudadanos llaman a Policía, Ambulancia o Bomberos; a los que están en ese servicio les llega la alerta y la atienden.
create table if not exists calls911(id uuid primary key default gen_random_uuid(), caller_char uuid references characters on delete set null,
  service text not null check (service in ('policia','ems','bomberos')), location text not null check (length(location) between 2 and 120),
  description text not null check (length(description) between 3 and 500), anonymous boolean not null default false,
  status text not null default 'abierta' check (status in ('abierta','en_camino','cerrada','cancelada')), responders uuid[] not null default '{}',
  note text, created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists calls911_open on calls911(status, created_at desc);
alter table calls911 enable row level security;
create or replace function can_respond(service text) returns boolean language sql stable security definer set search_path=public as $$
  select staff_level() >= 2 or case service
    when 'policia' then my_tags() && array['Policía','SWAT','FBI','DEA','CIA','US Seal','US Navy Seal','Servicio Secreto','Seguridad Pública']
    when 'ems' then my_tags() && array['Servicios Médicos']
    when 'bomberos' then my_tags() && array['Bomberos'] else false end $$;
drop policy if exists c9_sel on calls911; create policy c9_sel on calls911 for select to authenticated using (owns_char(caller_char) or can_respond(service));
drop policy if exists c9_ins on calls911; create policy c9_ins on calls911 for insert to authenticated with check (owns_char(caller_char));
-- al llamar: siempre entra abierta y sin respondientes; máximo 3 llamadas cada 10 minutos por vida (anti-spam)
create or replace function calls911_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.status := 'abierta'; new.responders := '{}'; new.note := null; new.created_at := now(); new.updated_at := now();
  if (select count(*) from calls911 where caller_char = new.caller_char and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Ya hiciste 3 llamadas en 10 minutos. Espera un poco: las llamadas falsas son delito (Art. 63).'; end if;
  return new;
end $$;
drop trigger if exists t_calls911 on calls911; create trigger t_calls911 before insert on calls911 for each row execute function calls911_guard();
-- atender: 'go' = voy en camino, 'close' = cerrar con nota, 'cancel' = quien llamó la cancela
create or replace function respond_call(cid uuid, act text, c uuid default null, note text default null) returns void language plpgsql security definer set search_path=public as $$
declare k calls911;
begin
  select * into k from calls911 where id = cid for update; if k.id is null then raise exception 'La llamada no existe'; end if;
  if act = 'cancel' then
    if not owns_char(k.caller_char) then raise exception 'Solo quien llamó puede cancelarla'; end if;
    if k.status in ('cerrada','cancelada') then return; end if;
    update calls911 set status = 'cancelada', updated_at = now() where id = cid; return;
  end if;
  if not can_respond(k.service) then raise exception 'No estás en ese servicio de emergencia'; end if;
  if k.status in ('cerrada','cancelada') then raise exception 'Esa llamada ya terminó'; end if;
  if act = 'go' then
    if not owns_char(c) then raise exception 'No es tu vida'; end if;
    update calls911 set status = 'en_camino', responders = array(select distinct unnest(responders || c)), updated_at = now() where id = cid;
  elsif act = 'close' then
    update calls911 set status = 'cerrada', note = nullif(trim(coalesce(respond_call.note, '')), ''), updated_at = now() where id = cid;
  else raise exception 'Acción inválida'; end if;
end $$;
grant execute on function respond_call(uuid, text, uuid, text) to authenticated;
do $$ begin execute 'alter publication supabase_realtime add table calls911'; exception when others then null; end $$;
-- Nómina al momento: en cuanto cumples tus minutos del día (empleo o servicio de staff) cobras ese día; sin pagos dobles.
-- También: renunciar a un empleo.
create table if not exists pay_log(kind text not null, ref uuid not null, day date not null, paid_at timestamptz default now(), primary key(kind, ref, day));
alter table pay_log enable row level security; -- solo lo tocan las funciones

-- paga el día «day» a quien ya cumplió (uid = solo esa cuenta; null = todos). Devuelve cuántos pagos hizo.
create or replace function pay_day(day date, uid uuid default null) returns int language plpgsql security definer set search_path=public as $$
declare g uuid := gov_acc(); e record; acc record; mins numeric; a uuid; n int := 0;
        minm numeric := coalesce((select (value#>>'{}')::numeric from settings where key='job_min_minutes'),60);
        smin numeric := coalesce((select (value#>>'{}')::numeric from settings where key='staff_min_minutes'),30);
begin
  for e in select em.*, r.salary from employments em join dept_ranks r on r.dept=em.dept and r.rank=em.rank
           join characters c on c.id=em.character_id where em.status<>'fired' and c.status='active' and (uid is null or c.user_id = uid) loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),(day+1)::timestamptz) - greatest(started_at,day::timestamptz))/60),0)
      into mins from work_shifts where character_id=e.character_id and dept=e.dept and started_at < (day+1)::timestamptz and coalesce(ended_at,now()) > day::timestamptz;
    if e.status='vacation' or mins >= minm then
      update employments set last_qualified=greatest(last_qualified, day) where id=e.id;
      a := personal_acc(e.character_id);
      if a is not null then
        insert into pay_log(kind, ref, day) values('job', e.id, day) on conflict do nothing;
        if found then
          begin perform move_money(g, a, round((e.salary*cpi() - income_tax(e.salary*cpi()))/365,2), 'Nómina neta · '||e.dept||' · '||e.rank||' (ya con retención de impuestos)'); n := n+1;
          exception when others then delete from pay_log where kind='job' and ref=e.id and pay_log.day=pay_day.day; end;
        end if;
      end if;
    end if;
  end loop;
  -- staff: sueldo anual ÷ 365 si estuvo en servicio el mínimo del día (a su primera vida activa)
  for acc in select p.id, p.staff_role from profiles p where p.staff_role is not null and (uid is null or p.id = uid) loop
    select coalesce(sum(extract(epoch from least(coalesce(ended_at,now()),(day+1)::timestamptz) - greatest(started_at,day::timestamptz))/60),0)
      into mins from shifts where user_id=acc.id and started_at < (day+1)::timestamptz and coalesce(ended_at,now()) > day::timestamptz;
    a := (select personal_acc(c.id) from characters c where c.user_id=acc.id and c.status='active' order by c.created_at limit 1);
    if mins >= smin and a is not null then
      insert into pay_log(kind, ref, day) values('staff', acc.id, day) on conflict do nothing;
      if found then
        declare y numeric := coalesce((select (value->>acc.staff_role)::numeric from settings where key='staff_salary'),40000)*cpi(); begin
          perform move_money(g, a, round((y - income_tax(y))/365,2), 'Nómina neta · Staff · '||acc.staff_role||' (ya con retención de impuestos)'); n := n+1;
        exception when others then delete from pay_log where kind='staff' and ref=acc.id and pay_log.day=pay_day.day; end;
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function pay_day(date, uuid) from public, anon, authenticated;

-- la web lo llama sola mientras estás en turno: cobras hoy en cuanto cumples tus minutos
create or replace function pay_now() returns int language sql security definer set search_path=public as $$ select pay_day(current_date, auth.uid()) $$;
grant execute on function pay_now() to authenticated;

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
  n := n + pay_day(d); -- lo que no se cobró al momento (pay_now) se paga aquí, una sola vez
  for e in select em.* from employments em join characters c on c.id=em.character_id where em.status not in ('fired','vacation') and c.status='active' and em.last_qualified < d - 6 loop
    update employments set status='fired' where id=e.id;
    perform set_config('app.trusted','on',true);
    update characters set roles = array_remove(roles, e.dept) where id=e.character_id; f := f+1;
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
  return n||' pagos, '||f||' despidos';
end $$;

-- renunciar a tu empleo: cierra tu turno abierto y te quita el rol
create or replace function quit_job(emp uuid) returns void language plpgsql security definer set search_path=public as $$
declare e employments;
begin
  select * into e from employments where id = emp;
  if e.id is null or not owns_char(e.character_id) then raise exception 'Ese no es tu empleo'; end if;
  if e.status = 'fired' then raise exception 'Ya no trabajas ahí'; end if;
  update work_shifts set ended_at = now() where character_id = e.character_id and dept = e.dept and ended_at is null;
  update employments set status = 'fired' where id = emp;
  perform set_config('app.trusted','on',true);
  update characters set roles = array_remove(roles, e.dept) where id = e.character_id;
  perform set_config('app.trusted','off',true);
end $$;
grant execute on function quit_job(uuid) to authenticated;

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

-- Casino: el resultado se decide en el servidor. Las apuestas van a la Tesorería y los premios los paga la Tesorería.
create table if not exists casino_bets(id uuid primary key default gen_random_uuid(), character_id uuid references characters on delete cascade,
  game text not null, bet numeric not null, mult numeric not null, payout numeric not null, result jsonb, created_at timestamptz default now());
create index if not exists casino_bets_char on casino_bets(character_id, created_at desc);
alter table casino_bets enable row level security;
drop policy if exists cb_sel on casino_bets; create policy cb_sel on casino_bets for select to authenticated using (owns_char(character_id) or staff_level()>=3);
insert into settings(key,value) values('casino_max_bet','50000') on conflict do nothing;

create or replace function casino_play(c uuid, game text, bet numeric, opts jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare acc uuid := personal_acc(c); mx numeric := coalesce((select (value#>>'{}')::numeric from settings where key='casino_max_bet'),50000);
  m numeric := 0; res jsonb; r numeric; t numeric; n int; s text; reels int[]; sym text[] := array['🍒','🍋','🔔','⭐','💎','7️⃣'];
  pay3 numeric[] := array[5,10,20,50,100,250]; w int[] := array[30,25,20,12,8,5]; i int; k int; path int[] := '{}';
  plk numeric[] := array[13,3,1.3,0.7,0.4,0.7,1.3,3,13]; wheel numeric[] := array[0,1.2,0,1.5,0,1.2,0,2,0,4];
  reds int[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  if not exists(select 1 from characters where id=c and status='active') then raise exception 'Tu vida debe estar activa'; end if;
  bet := round(bet, 2);
  if bet is null or bet < 1 then raise exception 'La apuesta mínima es $1'; end if;
  if bet > mx then raise exception 'La apuesta máxima es $%', mx; end if;
  perform move_money(acc, gov_acc(), bet, 'Casino · apuesta ' || game);
  if game = 'dice' then
    t := (opts->>'target')::numeric; if t is null or t < 2 or t > 98 then raise exception 'Objetivo entre 2 y 98'; end if;
    r := floor(random()*10000)/100;
    if coalesce((opts->>'over')::bool, true) then m := case when r > t then 99/(100-t) else 0 end; else m := case when r < t then 99/t else 0 end; end if;
    res := jsonb_build_object('roll', r);
  elsif game = 'limbo' then
    t := (opts->>'target')::numeric; if t is null or t < 1.01 or t > 1000 then raise exception 'Multiplicador entre 1.01 y 1000'; end if;
    r := least(floor(0.99/(1-random())*100)/100, 1000000); m := case when r >= t then t else 0 end; res := jsonb_build_object('result', r);
  elsif game = 'coin' then
    s := case when random() < 0.5 then 'cara' else 'cruz' end; m := case when s = opts->>'side' then 1.98 else 0 end; res := jsonb_build_object('side', s);
  elsif game = 'roulette' then
    n := floor(random()*37); s := opts->>'pick';
    m := case when s = 'rojo' and n = any(reds) then 2 when s = 'negro' and n > 0 and not n = any(reds) then 2
      when s = 'par' and n > 0 and n % 2 = 0 then 2 when s = 'impar' and n % 2 = 1 then 2 when s = 'bajo' and n between 1 and 18 then 2 when s = 'alto' and n >= 19 then 2
      when s ~ '^d[123]$' and n > 0 and (n-1)/12 + 1 = substr(s,2)::int then 3 when s ~ '^n[0-9]+$' and substr(s,2)::int = n then 36 else 0 end;
    res := jsonb_build_object('n', n, 'color', case when n = 0 then 'verde' when n = any(reds) then 'rojo' else 'negro' end);
  elsif game = 'slots' then
    for i in 1..3 loop r := random()*100; k := 1; while r >= w[k] loop r := r - w[k]; k := k + 1; end loop; reels := reels || k; end loop;
    if reels[1] = reels[2] and reels[2] = reels[3] then m := pay3[reels[1]];
    elsif reels[1] = reels[2] or reels[2] = reels[3] or reels[1] = reels[3] then m := 0.7; end if;
    res := jsonb_build_object('reels', to_jsonb(array[sym[reels[1]], sym[reels[2]], sym[reels[3]]]));
  elsif game = 'plinko' then
    k := 0; for i in 1..8 loop n := (random() < 0.5)::int; path := path || n; k := k + n; end loop; m := plk[k+1]; res := jsonb_build_object('path', to_jsonb(path), 'slot', k);
  elsif game = 'wheel' then
    n := floor(random()*10); m := wheel[n+1]; res := jsonb_build_object('seg', n);
  else raise exception 'Juego desconocido'; end if;
  if m > 0 then perform move_money(gov_acc(), acc, round(bet*m, 2), 'Casino · premio ' || game || ' ×' || round(m, 2)); end if;
  insert into casino_bets(character_id, game, bet, mult, payout, result) values(c, game, bet, round(m, 4), round(bet*m, 2), res);
  return res || jsonb_build_object('mult', round(m, 4), 'payout', round(bet*m, 2));
end $$;

-- Casino II: juegos por turnos (Blackjack, Video póker, Minas). La baraja y las minas viven solo en el servidor.
create table if not exists casino_hands(id uuid primary key default gen_random_uuid(), character_id uuid references characters on delete cascade,
  game text not null, bet numeric not null, state jsonb not null, status text not null default 'open', created_at timestamptz default now(), updated_at timestamptz default now());
alter table casino_hands enable row level security; -- sin políticas: solo se lee con las funciones (la baraja es secreta)
create unique index if not exists casino_hands_open on casino_hands(character_id, game) where status = 'open';

create or replace function ja(j jsonb) returns int[] language sql immutable as $$ select coalesce(array(select x::int from jsonb_array_elements_text(coalesce(j,'[]')) x), '{}') $$;

-- cartas 0..51: rango = n%13 (0=2 … 8=10, 9=J, 10=Q, 11=K, 12=A), palo = n/13
create or replace function bj_val(cs int[]) returns int language plpgsql immutable as $$
declare t int := 0; a int := 0; c int;
begin
  foreach c in array cs loop
    if c % 13 = 12 then t := t + 11; a := a + 1; elsif c % 13 >= 8 then t := t + 10; else t := t + c % 13 + 2; end if;
  end loop;
  while t > 21 and a > 0 loop t := t - 10; a := a - 1; end loop;
  return t;
end $$;

-- Jacks or Better 9/6: devuelve el multiplicador total (incluye la apuesta)
create or replace function poker_mult(cs int[]) returns numeric language plpgsql immutable as $$
declare r int[] := array(select c % 13 from unnest(cs) c order by 1); n int[]; fl bool; st bool; pr int;
begin
  n := array(select count(*)::int from unnest(r) x group by x order by 1 desc);
  fl := (select count(distinct c / 13) from unnest(cs) c) = 1;
  st := array_length(n, 1) = 5 and (r[5] - r[1] = 4 or r = array[0,1,2,3,12]);
  if st and fl and r[1] = 8 then return 800; end if;
  if st and fl then return 50; end if;
  if n[1] = 4 then return 25; end if;
  if n[1] = 3 and n[2] = 2 then return 9; end if;
  if fl then return 6; end if;
  if st then return 4; end if;
  if n[1] = 3 then return 3; end if;
  if n[1] = 2 and n[2] = 2 then return 2; end if;
  if n[1] = 2 then select x into pr from unnest(r) x group by x having count(*) = 2; if pr >= 9 then return 1; end if; end if;
  return 0;
end $$;

create or replace function mines_mult(n int, k int) returns numeric language sql immutable as $$
  select round(0.99 * coalesce(exp(sum(ln((25 - i)::numeric / (25 - n - i)))), 1), 4) from generate_series(0, k - 1) i $$;

create or replace function casino_view(h casino_hands) returns jsonb language plpgsql stable as $$
declare s jsonb := h.state; o bool := h.status = 'open'; v jsonb;
begin
  v := jsonb_build_object('id', h.id, 'game', h.game, 'bet', h.bet, 'status', h.status, 'mult', s->'mult', 'payout', s->'payout');
  if h.game = 'blackjack' then
    return v || jsonb_build_object('p', s->'p', 'pv', bj_val(ja(s->'p')), 'doubled', coalesce(s->'doubled', 'false'),
      'd', case when o then jsonb_build_array(s->'d'->0, -1) else s->'d' end,
      'dv', case when o then bj_val(array[(s->'d'->>0)::int]) else bj_val(ja(s->'d')) end);
  elsif h.game = 'poker' then return v || jsonb_build_object('h', s->'h', 'drawn', coalesce(s->'drawn', 'false'));
  else return v || jsonb_build_object('n', s->'n', 'open', s->'open', 'now', mines_mult((s->>'n')::int, jsonb_array_length(s->'open')),
      'next', mines_mult((s->>'n')::int, jsonb_array_length(s->'open') + 1), 'mines', case when o then null else s->'mines' end);
  end if;
end $$;

create or replace function casino_settle(hid uuid, m numeric) returns casino_hands language plpgsql security definer set search_path=public as $$
declare h casino_hands; pay numeric;
begin
  select * into h from casino_hands where id = hid;
  pay := round(h.bet * m, 2);
  if pay > 0 then perform move_money(gov_acc(), personal_acc(h.character_id), pay, 'Casino · premio ' || h.game || ' ×' || round(m, 2)); end if;
  update casino_hands set status = 'done', updated_at = now(), state = state || jsonb_build_object('mult', m, 'payout', pay) where id = hid returning * into h;
  insert into casino_bets(character_id, game, bet, mult, payout, result) values(h.character_id, h.game, h.bet, m, pay, casino_view(h) - 'id');
  return h;
end $$;
revoke all on function casino_settle(uuid, numeric) from public, anon, authenticated;

create or replace function casino_open(c uuid, game text) returns jsonb language plpgsql security definer set search_path=public as $$
declare h casino_hands;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  select * into h from casino_hands where character_id = c and casino_hands.game = casino_open.game and status = 'open';
  return case when h.id is null then null else casino_view(h) end;
end $$;

create or replace function casino_start(c uuid, game text, bet numeric, opts jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public as $$
declare h casino_hands; deck jsonb; mx numeric := coalesce((select (value#>>'{}')::numeric from settings where key='casino_max_bet'),50000); n int; pv int; dv int;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  if not exists(select 1 from characters where id=c and status='active') then raise exception 'Tu vida debe estar activa'; end if;
  if game not in ('blackjack','poker','mines') then raise exception 'Juego desconocido'; end if;
  select * into h from casino_hands where character_id = c and casino_hands.game = casino_start.game and status = 'open';
  if h.id is not null then return casino_view(h); end if;
  bet := round(bet, 2);
  if bet is null or bet < 1 then raise exception 'La apuesta mínima es $1'; end if;
  if bet > mx then raise exception 'La apuesta máxima es $%', mx; end if;
  if game = 'mines' then n := (opts->>'mines')::int; if n is null or n < 1 or n > 24 then raise exception 'Minas entre 1 y 24'; end if; end if;
  perform move_money(personal_acc(c), gov_acc(), bet, 'Casino · apuesta ' || game);
  select jsonb_agg(x order by random()) into deck from generate_series(0, 51) x;
  if game = 'blackjack' then
    insert into casino_hands(character_id, game, bet, state) values(c, game, bet, jsonb_build_object('p', jsonb_build_array(deck->0, deck->2), 'd', jsonb_build_array(deck->1, deck->3), 'deck', deck - 0 - 0 - 0 - 0)) returning * into h;
    pv := bj_val(ja(h.state->'p')); dv := bj_val(ja(h.state->'d'));
    if pv = 21 or dv = 21 then h := casino_settle(h.id, case when pv = 21 and dv = 21 then 1 when pv = 21 then 2.5 else 0 end); end if;
  elsif game = 'poker' then
    insert into casino_hands(character_id, game, bet, state) values(c, game, bet, jsonb_build_object('h', jsonb_build_array(deck->0, deck->1, deck->2, deck->3, deck->4), 'deck', deck - 0 - 0 - 0 - 0 - 0)) returning * into h;
  else
    insert into casino_hands(character_id, game, bet, state) values(c, game, bet, jsonb_build_object('n', n, 'open', '[]'::jsonb,
      'mines', (select jsonb_agg(x) from (select x from generate_series(0, 24) x order by random() limit n) q))) returning * into h;
  end if;
  return casino_view(h);
end $$;

create or replace function casino_act(hand uuid, action text, arg jsonb default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare h casino_hands; s jsonb; card int; pv int; dv int; i int; k int;
begin
  select * into h from casino_hands where id = hand and status = 'open' for update;
  if h.id is null then raise exception 'Esa mano ya terminó'; end if;
  if not owns_char(h.character_id) then raise exception 'No es tu mano'; end if;
  s := h.state;
  if h.game = 'blackjack' then
    if action = 'double' then
      if jsonb_array_length(s->'p') <> 2 then raise exception 'Solo puedes doblar con tus dos primeras cartas'; end if;
      perform move_money(personal_acc(h.character_id), gov_acc(), h.bet, 'Casino · doblar blackjack');
      h.bet := h.bet * 2; s := s || '{"doubled":true}';
    end if;
    if action in ('hit', 'double') then
      s := jsonb_set(s, '{p}', (s->'p') || (s->'deck'->0)); s := jsonb_set(s, '{deck}', (s->'deck') - 0);
    elsif action <> 'stand' then raise exception 'Acción inválida'; end if;
    update casino_hands set bet = h.bet, state = s, updated_at = now() where id = h.id;
    pv := bj_val(ja(s->'p'));
    if pv > 21 then h := casino_settle(h.id, 0);
    elsif action in ('stand', 'double') or pv = 21 then
      while bj_val(ja(s->'d')) < 17 loop s := jsonb_set(s, '{d}', (s->'d') || (s->'deck'->0)); s := jsonb_set(s, '{deck}', (s->'deck') - 0); end loop;
      update casino_hands set state = s where id = h.id; dv := bj_val(ja(s->'d'));
      h := casino_settle(h.id, case when dv > 21 or pv > dv then 2 when pv = dv then 1 else 0 end);
    else select * into h from casino_hands where id = hand; end if;
  elsif h.game = 'poker' then
    if action <> 'draw' then raise exception 'Acción inválida'; end if;
    for i in 0..4 loop
      if not coalesce((arg->>i)::bool, false) then s := jsonb_set(s, array['h', i::text], s->'deck'->0); s := jsonb_set(s, '{deck}', (s->'deck') - 0); end if;
    end loop;
    s := s || '{"drawn":true}'; update casino_hands set state = s where id = h.id;
    h := casino_settle(h.id, poker_mult(ja(s->'h')));
  else
    k := jsonb_array_length(s->'open');
    if action = 'cash' then
      if k = 0 then raise exception 'Destapa al menos una casilla'; end if;
      h := casino_settle(h.id, mines_mult((s->>'n')::int, k));
    elsif action = 'pick' then
      i := (arg#>>'{}')::int;
      if i is null or i < 0 or i > 24 or (s->'open') @> to_jsonb(i) then raise exception 'Casilla inválida'; end if;
      s := jsonb_set(s, '{open}', (s->'open') || to_jsonb(i)); update casino_hands set state = s, updated_at = now() where id = h.id;
      if (s->'mines') @> to_jsonb(i) then h := casino_settle(h.id, 0);
      elsif k + 1 = 25 - (s->>'n')::int then h := casino_settle(h.id, mines_mult((s->>'n')::int, k + 1));
      else select * into h from casino_hands where id = hand; end if;
    else raise exception 'Acción inválida'; end if;
  end if;
  return casino_view(h);
end $$;

-- Criptomonedas (simuladas). Los precios se mueven solos: cada minuto un paso aleatorio, calculado al momento en que alguien consulta.
-- El exchange es el gobierno: lo que compras se paga a la Tesorería y lo que vendes lo paga la Tesorería (comisión 0.5%).
create table if not exists crypto_coins(sym text primary key, name text not null, price numeric not null, base numeric not null, vol numeric not null, color text, ord int);
create table if not exists crypto_hist(sym text references crypto_coins on delete cascade, t timestamptz not null, price numeric not null, primary key(sym, t));
create table if not exists crypto_hold(character_id uuid references characters on delete cascade, sym text references crypto_coins, qty numeric not null default 0, cost numeric not null default 0, primary key(character_id, sym));
create table if not exists crypto_trades(id uuid primary key default gen_random_uuid(), character_id uuid references characters on delete cascade, sym text, side text, qty numeric, price numeric, usd numeric, created_at timestamptz default now());
alter table crypto_coins enable row level security; alter table crypto_hist enable row level security; alter table crypto_hold enable row level security; alter table crypto_trades enable row level security;
drop policy if exists cc_sel on crypto_coins; create policy cc_sel on crypto_coins for select to authenticated using (true);
drop policy if exists ch_sel on crypto_hist; create policy ch_sel on crypto_hist for select to authenticated using (true);
drop policy if exists cw_sel on crypto_hold; create policy cw_sel on crypto_hold for select to authenticated using (owns_char(character_id) or staff_level()>=2);
drop policy if exists ct_sel on crypto_trades; create policy ct_sel on crypto_trades for select to authenticated using (owns_char(character_id) or staff_level()>=2);
insert into crypto_coins(sym,name,price,base,vol,color,ord) values
 ('BTC','Bitcoin',95000,95000,0.0015,'#f7931a',1),('ETH','Ethereum',3500,3500,0.002,'#8c8cff',2),('SOL','Solana',180,180,0.003,'#14f195',3),
 ('XRP','XRP',2.3,2.3,0.003,'#c9d1d9',4),('DOGE','Dogecoin',0.35,0.35,0.004,'#c2a633',5),('ADA','Cardano',0.9,0.9,0.003,'#3a7bff',6),
 ('LARP','LA Coin',1,1,0.006,'#ff4d6d',7) on conflict do nothing;
insert into settings(key,value) values('crypto_last', to_jsonb(date_trunc('minute', now()))) on conflict do nothing;

create or replace function crypto_tick() returns void language plpgsql security definer set search_path=public as $$
declare last timestamptz; steps int; k int; c crypto_coins; p numeric; g float8;
begin
  select (value#>>'{}')::timestamptz into last from settings where key='crypto_last' for update;
  steps := least(floor(extract(epoch from now() - last) / 60)::int, 1440);
  if steps < 1 then return; end if;
  if extract(epoch from now() - last) > 86400 then last := date_trunc('minute', now()) - interval '1 day'; end if;
  for c in select * from crypto_coins loop
    p := c.price;
    for k in 1..steps loop
      g := sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random()); -- normal(0,1)
      p := greatest(p * exp(0.0005 * ln(c.base / p) + c.vol * g), c.base * 0.01);  -- caminata aleatoria que regresa poco a poco a su precio base
      insert into crypto_hist values(c.sym, last + k * interval '1 minute', round(p, 8)) on conflict do nothing;
    end loop;
    update crypto_coins set price = round(p, 8) where sym = c.sym;
  end loop;
  update settings set value = to_jsonb(last + steps * interval '1 minute') where key='crypto_last';
  delete from crypto_hist where t < now() - interval '7 days';
end $$;

-- historial resumido para la gráfica (máx. ~120 puntos)
create or replace function crypto_chart(s text, minutes int) returns table(t timestamptz, price numeric) language sql stable security definer set search_path=public as $$
  select t, price from (select t, price, row_number() over (order by t desc) - 1 rn from crypto_hist where sym = s and t > now() - make_interval(mins => minutes)) q
  where rn % greatest(1, minutes / 120) = 0 order by t $$;

create or replace function crypto_trade(c uuid, s text, side text, amount numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare p numeric; q numeric; usd numeric; h crypto_hold; fee numeric := 0.005;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  if not exists(select 1 from characters where id=c and status='active') then raise exception 'Tu vida debe estar activa'; end if;
  perform crypto_tick();
  select price into p from crypto_coins where sym = s; if p is null then raise exception 'Moneda desconocida'; end if;
  if side = 'buy' then -- amount = dólares a gastar
    usd := round(amount, 2); if usd is null or usd < 1 then raise exception 'Mínimo $1'; end if;
    q := round(usd * (1 - fee) / p, 8);
    perform move_money(personal_acc(c), gov_acc(), usd, 'Bitso · compra ' || s);
    insert into crypto_hold values(c, s, q, usd) on conflict (character_id, sym) do update set qty = crypto_hold.qty + q, cost = crypto_hold.cost + usd;
  elsif side = 'sell' then -- amount = cantidad de la moneda
    q := round(amount, 8); select * into h from crypto_hold where character_id = c and sym = s for update;
    if q is null or q <= 0 then raise exception 'Cantidad inválida'; end if;
    if coalesce(h.qty, 0) < q then raise exception 'No tienes tanto %', s; end if;
    usd := round(q * p * (1 - fee), 2); if usd < 0.01 then raise exception 'Muy poco para vender'; end if;
    update crypto_hold set qty = qty - q, cost = case when qty - q <= 0 then 0 else cost * (qty - q) / qty end where character_id = c and sym = s;
    perform move_money(gov_acc(), personal_acc(c), usd, 'Bitso · venta ' || s);
  else raise exception 'Operación inválida'; end if;
  insert into crypto_trades(character_id, sym, side, qty, price, usd) values(c, s, side, q, p, usd);
  return jsonb_build_object('qty', q, 'usd', usd, 'price', p);
end $$;
-- Bolsa como en la vida real (arregla el fraude de comprar acciones infinitas y meter dinero a la empresa):
-- * El precio = valor en libros ÷ acciones en circulación (las que tienen los jugadores) × prima de mercado.
-- * Al registrar la empresa, el dueño recibe todas sus acciones. Comprar = la empresa emite acciones nuevas (el dinero entra a la empresa);
--   vender = la empresa recompra (paga con SU efectivo; si no tiene, no se puede). El gobierno ya no pone ni recibe nada.
-- * Comprar sube la prima y vender la baja (oferta y demanda); la prima regresa sola a 1 con los días (20% diario).
alter table companies add column if not exists premium numeric not null default 1, add column if not exists premium_at timestamptz not null default now();

create or replace function co_book(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select coalesce((select balance from accounts where id=co.account_id),0)
       + coalesce((select sum(price) from properties where owner_company=co.id),0)
       + coalesce((select sum(m.price) from vehicles v join vehicle_models m on m.id=v.model_id where v.owner_company=co.id),0)
  from companies co where co.id=c $$;
create or replace function co_out(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select coalesce(sum(shares),0) from holdings where company_id=c and shares>0 $$;
create or replace function co_premium(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select 1 + (premium - 1) * power(0.8, extract(epoch from now() - premium_at) / 86400) from companies where id=c $$;

create or replace function share_price(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select case when co.industry='ETF' then coalesce((select round(avg(share_price(x.id))*10,2) from companies x where x.industry<>'ETF'),10)
  else greatest(0.01, round(co_book(co.id) / greatest(case when co_out(co.id) > 0 then co_out(co.id) else co.shares_total end, 1) * co_premium(co.id), 2)) end
  from companies co where co.id=c $$;

-- el dueño recibe todas las acciones al registrar su empresa
create or replace function co_founder_shares() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.industry <> 'ETF' and cardinality(new.owners) > 0 then
    insert into holdings(character_id, company_id, shares, cost) values(new.owners[1], new.id, greatest(new.shares_total, 1), 0) on conflict (character_id, company_id) do nothing;
  end if; return new;
end $$;
drop trigger if exists companies_founder on companies;
create trigger companies_founder after insert on companies for each row execute function co_founder_shares();
-- empresas que ya existían: el dueño recibe las acciones que falten para completar el total
insert into holdings(character_id, company_id, shares, cost)
  select co.owners[1], co.id, co.shares_total - co_out(co.id), 0 from companies co
  where co.industry <> 'ETF' and cardinality(co.owners) > 0 and co_out(co.id) < co.shares_total
  on conflict (character_id, company_id) do update set shares = holdings.shares + excluded.shares;

-- compra de acciones: la empresa emite títulos nuevos
create or replace function buy_shares(company uuid, qty int, acc uuid) returns numeric language plpgsql security definer set search_path=public as $$
declare co companies; buyer uuid; q int := qty; out_ numeric; ps numeric; p0 numeric; p1 numeric; total numeric;
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select owners[1] into buyer from accounts where id=acc and kind='personal';
  if buyer is null then raise exception 'Compra acciones con tu cuenta personal'; end if;
  if q is null or q < 1 then raise exception 'Cantidad inválida'; end if;
  select * into co from companies where id=company for update;
  if co.id is null then raise exception 'Empresa no existe'; end if;
  if co.industry = 'ETF' then raise exception 'El ETF ya no acepta compras nuevas'; end if;
  if co.account_id = acc then raise exception 'Ya es tuyo'; end if;
  out_ := greatest(co_out(company), 1); ps := co_book(company) / out_;
  p0 := co_premium(company); p1 := least(p0 * exp(q / out_), 5);
  total := round(greatest(ps, 0.01) * (p0 + p1) / 2 * q, 2);
  perform move_money(acc, co.account_id, total, 'Compra de acciones · ' || co.name);
  update companies set premium = p1, premium_at = now() where id = company;
  insert into holdings(character_id,company_id,shares,cost) values(buyer,company,q,total)
    on conflict(character_id,company_id) do update set shares=holdings.shares+q, cost=holdings.cost+total;
  insert into trades(character_id,company_id,side,qty,price,total) values(buyer,company,'compra',q,total/q,total);
  insert into price_history(company_id,price) values(company, share_price(company));
  return total;
end $$;

-- venta: la empresa recompra con su propio efectivo (el ETF viejo lo sigue pagando la Tesorería, que fue quien recibió ese dinero)
create or replace function sell_shares(company uuid, qty int, acc uuid) returns numeric language plpgsql security definer set search_path=public as $$
declare c uuid; co companies; h holdings; out_ numeric; ps numeric; p0 numeric; p1 numeric; total numeric; cash numeric;
begin
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select owners[1] into c from accounts where id=acc and kind='personal';
  select * into h from holdings where character_id=c and company_id=company for update;
  if h.shares is null or h.shares < qty or qty < 1 then raise exception 'No tienes tantas acciones'; end if;
  select * into co from companies where id=company for update;
  if co.industry = 'ETF' then
    total := share_price(company) * qty; perform move_money(gov_acc(), acc, total, 'Venta de acciones · ETF');
  else
    out_ := greatest(co_out(company), 1); ps := co_book(company) / out_;
    p0 := co_premium(company); p1 := greatest(p0 * exp(-qty / out_), 0.2);
    total := round(greatest(ps, 0) * (p0 + p1) / 2 * qty, 2);
    cash := coalesce((select balance from accounts where id=co.account_id), 0);
    if total > cash then raise exception 'La empresa solo tiene % en efectivo para recomprar acciones (tus % títulos valen %)', round(cash,2), qty, total; end if;
    if total > 0 then perform move_money(co.account_id, acc, total, 'Venta de acciones · ' || co.name); end if;
    update companies set premium = p1, premium_at = now() where id = company;
  end if;
  update holdings set cost = round(cost * (shares-qty) / shares, 2), shares=shares-qty where id=h.id;
  insert into trades(character_id,company_id,side,qty,price,total) values(c,company,'venta',qty,total/qty,total);
  insert into price_history(company_id,price) values(company, share_price(company));
  return total;
end $$;

-- buy('shares') ahora usa buy_shares
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
    return buy_shares(item, q, acc);
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

-- Cripto como en la vida real: oferta fija y precio por oferta y demanda entre jugadores (pool de liquidez x·y=k, como un exchange descentralizado).
-- El gobierno ya no es la contraparte: los dólares de los compradores quedan en la reserva del exchange y de ahí se les paga a los que venden.
-- La curva garantiza que la reserva siempre alcanza para recomprar todas las monedas en manos de jugadores.
alter table crypto_coins add column if not exists supply numeric, add column if not exists pool_coin numeric,
  add column if not exists pool_usd numeric not null default 0, add column if not exists virt_usd numeric;
insert into accounts(kind,name,owners) select 'business','Bitso · reserva de liquidez','{}' where not exists(select 1 from accounts where name='Bitso · reserva de liquidez' and kind='business');
create or replace function crypto_acc() returns uuid language sql stable security definer set search_path=public as $$
  select id from accounts where name='Bitso · reserva de liquidez' and kind='business' order by created_at limit 1 $$;

-- arranque: cada moneda conserva su precio; lo que la Tesorería cobró por cripto pasa a la reserva para respaldar a quien ya tiene monedas
do $$ declare c record; h numeric; net numeric; y numeric; v numeric; dep numeric;
begin
  for c in select * from crypto_coins where pool_coin is null loop
    h := coalesce((select sum(qty) from crypto_hold where sym=c.sym), 0);
    net := greatest(coalesce((select sum(case when side='buy' then usd else -usd end) from crypto_trades where sym=c.sym), 0), 0);
    net := least(net, coalesce((select balance from accounts where id=gov_acc()), 0));
    dep := case when c.sym='LARP' then 2000000 else 20000000 end;  -- profundidad: cuánto dinero mueve el precio
    y := dep / c.price; v := c.price * y - net;
    if h > 0 and v * h > net * y then v := net * y / h; end if;   -- que la reserva alcance para recomprar todo lo que ya tienen
    v := greatest(v, 0.01);
    update crypto_coins set supply = y + h, pool_coin = y, pool_usd = net, virt_usd = v, price = round((v + net) / y, 8) where sym = c.sym;
    if net > 0 then perform move_money(gov_acc(), crypto_acc(), net, 'Bitso · traspaso de reservas ' || c.sym); end if;
  end loop;
end $$;

-- ya no hay caminata aleatoria: solo rellena la gráfica con el último precio para que el tiempo avance
create or replace function crypto_tick() returns void language plpgsql security definer set search_path=public as $$
declare last timestamptz; steps int;
begin
  select (value#>>'{}')::timestamptz into last from settings where key='crypto_last' for update;
  steps := least(floor(extract(epoch from now() - last) / 60)::int, 1440);
  if steps < 1 then return; end if;
  if extract(epoch from now() - last) > 86400 then last := date_trunc('minute', now()) - interval '1 day'; end if;
  insert into crypto_hist select sym, last + g * interval '1 minute', price from crypto_coins, generate_series(1, steps) g on conflict do nothing;
  update settings set value = to_jsonb(last + steps * interval '1 minute') where key='crypto_last';
  delete from crypto_hist where t < now() - interval '7 days';
end $$;

create or replace function crypto_trade(c uuid, s text, side text, amount numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare k crypto_coins; x numeric; q numeric; usd numeric; h crypto_hold; fee numeric := 0.005; np numeric;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  if not exists(select 1 from characters where id=c and status='active') then raise exception 'Tu vida debe estar activa'; end if;
  perform crypto_tick();
  select * into k from crypto_coins where sym = s for update; if k.sym is null then raise exception 'Moneda desconocida'; end if;
  x := k.virt_usd + k.pool_usd;
  if side = 'buy' then -- amount = dólares
    usd := round(amount, 2); if usd is null or usd < 1 then raise exception 'Mínimo $1'; end if;
    q := trunc(k.pool_coin - x * k.pool_coin / (x + usd * (1 - fee)), 8);
    if q <= 0 then raise exception 'Muy poco para comprar'; end if;
    perform move_money(personal_acc(c), crypto_acc(), usd, 'Bitso · compra ' || s);
    update crypto_coins set pool_usd = pool_usd + usd, pool_coin = pool_coin - q where sym = s returning * into k;
    insert into crypto_hold values(c, s, q, usd) on conflict (character_id, sym) do update set qty = crypto_hold.qty + q, cost = crypto_hold.cost + usd;
  elsif side = 'sell' then -- amount = monedas
    q := round(amount, 8); select * into h from crypto_hold where character_id = c and sym = s for update;
    if q is null or q <= 0 then raise exception 'Cantidad inválida'; end if;
    if coalesce(h.qty, 0) < q then raise exception 'No tienes tanto %', s; end if;
    usd := trunc((x - x * k.pool_coin / (k.pool_coin + q)) * (1 - fee), 2);
    if usd < 0.01 then raise exception 'Muy poco para vender'; end if;
    if usd > k.pool_usd then raise exception 'La reserva no alcanza'; end if;
    update crypto_hold set qty = qty - q, cost = case when qty - q <= 0 then 0 else cost * (qty - q) / qty end where character_id = c and sym = s;
    perform move_money(crypto_acc(), personal_acc(c), usd, 'Bitso · venta ' || s);
    update crypto_coins set pool_usd = pool_usd - usd, pool_coin = pool_coin + q where sym = s returning * into k;
  else raise exception 'Operación inválida'; end if;
  np := round((k.virt_usd + k.pool_usd) / k.pool_coin, 8);
  update crypto_coins set price = np where sym = s;
  insert into crypto_hist values(s, now(), np) on conflict (sym, t) do update set price = excluded.price;
  insert into crypto_trades(character_id, sym, side, qty, price, usd) values(c, s, side, q, round(usd / q, 8), usd);
  return jsonb_build_object('qty', q, 'usd', usd, 'price', round(usd / q, 8), 'new_price', np);
end $$;

-- Economía cerrada: el dinero no se crea en ningún lado salvo cuando el Presidente lo emite (y eso causa inflación).
-- * staff_pay ya no puede crear dinero: todo sale de la Tesorería (solo el primer presupuesto de una economía vacía se crea).
-- * Nadie, ni el staff, puede cambiar un saldo a mano: los saldos solo cambian por move_money.
create or replace function move_money(f uuid, t uuid, amt numeric, concept text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if amt is null or amt <= 0 then raise exception 'Monto inválido'; end if;
  perform set_config('app.money', 'on', true);
  if f is not null then
    update accounts set balance=balance-amt where id=f and balance>=amt;
    if not found then raise exception 'Fondos insuficientes'; end if;
  end if;
  if t is not null then update accounts set balance=balance+amt where id=t; end if;
  insert into transactions(from_acc,to_acc,amount,concept) values(f,t,amt,concept);
  perform set_config('app.money', 'off', true);
end $$;
revoke all on function move_money(uuid,uuid,numeric,text) from public, anon, authenticated;

create or replace function guard_balance() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and coalesce(current_setting('app.money', true), 'off') <> 'on'
     and (tg_op = 'INSERT' and coalesce(new.balance, 0) <> 0 or tg_op = 'UPDATE' and new.balance is distinct from old.balance) then
    raise exception 'Los saldos solo cambian con movimientos de dinero (el dinero no se crea)';
  end if;
  return new;
end $$;
drop trigger if exists accounts_guard_balance on accounts;
create trigger accounts_guard_balance before insert or update on accounts for each row execute function guard_balance();

create or replace function staff_pay(acc uuid, amount numeric, concept text, mint bool default false) returns void
language plpgsql security definer set search_path=public as $$
begin
  if staff_level() < 3 then raise exception 'Solo admins'; end if;
  if mint and amount > 0 then
    if coalesce((select sum(balance) from accounts), 0) > 0 then raise exception 'El dinero no se crea: solo el Presidente puede emitir más (Reserva Federal)'; end if;
    perform move_money(null, acc, amount, concept);  -- presupuesto inicial de una economía vacía
  elsif amount >= 0 then perform move_money(gov_acc(), acc, amount, concept);
  else perform move_money(acc, gov_acc(), -amount, concept); end if;
end $$;

-- Tarjeta de crédito RRVA + historial crediticio (buró).
-- El crédito lo presta la Tesorería (el dinero ya existe: no se crea). Los intereses y cargos solo aumentan la deuda.
-- Ciclo semanal: cada 7 días hay un corte con pago mínimo; tienes 7 días para pagarlo. Pagar a tiempo sube tu score y tu línea;
-- pagar tarde la baja; 3 cortes sin pagar = impago y la tarjeta se cancela.
create table if not exists credit_cards(id uuid primary key default gen_random_uuid(), character_id uuid not null references characters on delete cascade,
  number text not null default '4152' || lpad(floor(random()*1e12)::bigint::text, 12, '0'), credit_limit numeric not null, owed numeric not null default 0,
  status text not null default 'active' check (status in ('active','frozen','closed')), apr numeric not null default 0.36,
  last_tick date not null default current_date, stmt_due date not null default current_date + 7, stmt_min numeric not null default 0, stmt_paid numeric not null default 0,
  missed int not null default 0, created_at timestamptz default now());
create unique index if not exists credit_cards_one on credit_cards(character_id) where status <> 'closed';
create table if not exists credit_events(id uuid primary key default gen_random_uuid(), character_id uuid references characters on delete cascade,
  kind text not null, amount numeric, note text, created_at timestamptz default now());
alter table credit_cards enable row level security; alter table credit_events enable row level security;
drop policy if exists cc_own on credit_cards; create policy cc_own on credit_cards for select to authenticated using (owns_char(character_id) or staff_level()>=2);
drop policy if exists ce_own on credit_events; create policy ce_own on credit_events for select to authenticated using (owns_char(character_id) or staff_level()>=2);

-- score 300–850: pagos puntuales suben, atrasos e impagos bajan (se borran del score a los 60 días), usar mucho de tu línea baja
create or replace function credit_score(c uuid) returns int language sql stable security definer set search_path=public as $$
  select greatest(300, least(850, round(620
    + 12 * least((select count(*) from credit_events where character_id=c and kind='pago_a_tiempo'), 15)
    - 45 * (select count(*) from credit_events where character_id=c and kind='pago_tarde' and created_at > now() - interval '60 days')
    - 160 * (select count(*) from credit_events where character_id=c and kind='impago' and created_at > now() - interval '60 days')
    - coalesce((select 80 * greatest(owed / nullif(credit_limit,0) - 0.3, 0) from credit_cards where character_id=c and status<>'closed'), 0)
    + least(30, coalesce((select extract(day from now() - min(created_at)) from credit_events where character_id=c), 0))
  )))::int $$;

create or replace function card_tick(c uuid) returns credit_cards language plpgsql security definer set search_path=public as $$
declare k credit_cards; d date; i int := 0;
begin
  select * into k from credit_cards where character_id=c and status<>'closed' for update;
  if k.id is null then return null; end if;
  d := k.last_tick;
  while d < current_date and i < 90 loop
    d := d + 1; i := i + 1;
    if k.owed > 0 then k.owed := round(k.owed * (1 + k.apr / 365), 2); end if;   -- interés diario
    if d >= k.stmt_due then                                                      -- corte
      if k.stmt_min > 0 and k.stmt_paid >= k.stmt_min then
        insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'pago_a_tiempo', k.stmt_paid, 'Pagaste tu mínimo a tiempo', d);
        k.missed := 0;
        if credit_score(c) >= 680 and k.owed <= k.credit_limit * 0.5 then k.credit_limit := round(least(k.credit_limit * 1.15, 250000 * cpi()), 2); end if;
      elsif k.stmt_min > 0 then
        k.missed := k.missed + 1; k.owed := k.owed + round(25 * cpi(), 2);
        insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'pago_tarde', k.stmt_min, 'No cubriste tu pago mínimo · cargo por atraso', d);
        k.credit_limit := round(greatest(k.credit_limit * 0.8, 500), 2);
        if k.missed >= 3 then
          k.status := 'closed';
          insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'impago', k.owed, '3 pagos vencidos: tarjeta cancelada, la deuda sigue', d);
        elsif k.missed >= 2 then k.status := 'frozen'; end if;
      end if;
      k.stmt_min := case when k.owed <= 0 then 0 else round(greatest(least(k.owed, 50 * cpi()), k.owed * 0.1), 2) end;
      k.stmt_paid := 0; k.stmt_due := d + 7;
    end if;
  end loop;
  k.last_tick := d;
  update credit_cards set owed=k.owed, credit_limit=k.credit_limit, status=k.status, last_tick=k.last_tick, stmt_due=k.stmt_due, stmt_min=k.stmt_min,
    stmt_paid=k.stmt_paid, missed=k.missed where id=k.id;
  return k;
end $$;

create or replace function card_apply(c uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare s int; lim numeric; debt numeric;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  if not exists(select 1 from characters where id=c and status='active') then raise exception 'Tu vida debe estar activa'; end if;
  perform card_tick(c);
  if exists(select 1 from credit_cards where character_id=c and status<>'closed') then raise exception 'Ya tienes una tarjeta de crédito'; end if;
  debt := coalesce((select sum(owed) from credit_cards where character_id=c and status='closed'), 0);
  if debt > 0 then
    insert into credit_events(character_id, kind, note) values(c, 'rechazo', 'Solicitud rechazada: tienes una deuda pendiente');
    return jsonb_build_object('ok', false, 'reason', 'Tienes una deuda pendiente de ' || round(debt,2) || ' con RRVA. Págala primero.');
  end if;
  s := credit_score(c);
  lim := round(10000 * cpi() * case when s >= 760 then 2 when s >= 700 then 1.5 when s >= 620 then 1 when s >= 560 then 0.5 else 0 end, 2);
  if lim <= 0 then
    insert into credit_events(character_id, kind, note) values(c, 'rechazo', 'Solicitud rechazada por historial (score ' || s || ')');
    return jsonb_build_object('ok', false, 'reason', 'Tu historial crediticio no alcanza (score ' || s || '). Necesitas al menos 560.', 'score', s);
  end if;
  insert into credit_cards(character_id, credit_limit) values(c, lim);
  insert into credit_events(character_id, kind, amount, note) values(c, 'apertura', lim, 'Tarjeta de crédito aprobada');
  return jsonb_build_object('ok', true, 'limit', lim, 'score', s);
end $$;

-- pagar con la tarjeta: a la cuenta de otra persona/empresa, o retiro de efectivo a tu cuenta (3% de comisión)
create or replace function card_charge(c uuid, dest text, amount numeric, concept text default 'Compra con tarjeta') returns jsonb language plpgsql security definer set search_path=public as $$
declare k credit_cards; t uuid; fee numeric := 0; amt numeric := round(amount, 2);
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  k := card_tick(c);
  if k.id is null then raise exception 'No tienes tarjeta de crédito'; end if;
  if k.status <> 'active' then raise exception 'Tu tarjeta está congelada por pagos atrasados. Paga tu mínimo.'; end if;
  if amt is null or amt < 1 then raise exception 'Monto inválido'; end if;
  select id into t from accounts where number = dest;
  if t is null then raise exception 'Cuenta destino no encontrada'; end if;
  if t = personal_acc(c) then fee := round(amt * 0.03, 2); end if;
  if k.owed + amt + fee > k.credit_limit then raise exception 'Te pasas de tu línea de crédito (disponible %)', round(k.credit_limit - k.owed, 2); end if;
  perform move_money(gov_acc(), t, amt, 'Tarjeta de crédito RRVA · ' || coalesce(nullif(concept,''), 'Compra'));
  update credit_cards set owed = owed + amt + fee where id = k.id;
  insert into credit_events(character_id, kind, amount, note) values(c, 'cargo', amt + fee, coalesce(nullif(concept,''), 'Compra') || case when fee > 0 then ' (retiro de efectivo, comisión 3%)' else '' end);
  return jsonb_build_object('owed', k.owed + amt + fee, 'available', k.credit_limit - k.owed - amt - fee);
end $$;

create or replace function card_pay(c uuid, amount numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare k credit_cards; amt numeric := round(amount, 2);
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  perform card_tick(c);
  select * into k from credit_cards where character_id=c and owed > 0 order by (status<>'closed') desc, created_at desc limit 1 for update;
  if k.id is null then raise exception 'No debes nada'; end if;
  if amt is null or amt <= 0 then raise exception 'Monto inválido'; end if;
  amt := least(amt, k.owed);
  perform move_money(personal_acc(c), gov_acc(), amt, 'Pago de tarjeta de crédito RRVA');
  update credit_cards set owed = owed - amt, stmt_paid = stmt_paid + amt,
    status = case when status = 'frozen' and stmt_paid + amt >= stmt_min then 'active' else status end where id = k.id;
  insert into credit_events(character_id, kind, amount, note) values(c, 'abono', amt, 'Pago a tu tarjeta');
  return jsonb_build_object('owed', k.owed - amt);
end $$;

create or replace function card_status(c uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare k credit_cards;
begin
  if not (owns_char(c) or staff_level() >= 2) then raise exception 'No es tu personaje'; end if;
  k := card_tick(c);
  return jsonb_build_object('score', credit_score(c), 'card', to_jsonb(k),
    'debt', coalesce((select sum(owed) from credit_cards where character_id=c), 0));
end $$;

-- Líneas de crédito que crecen hasta millones con buen historial.
-- Tope según score (ajustado a inflación): <650 $10k · 650 $50k · 700 $500k · 760 $2M · 800+ $10M.
-- Cada corte pagado a tiempo (y usando menos de la mitad de tu línea) la sube: ×1.1, ×1.25 (700+), ×1.5 (760+), ×2 (800+).
create or replace function credit_cap(s int) returns numeric language sql stable as $$
  select (case when s >= 800 then 10000000 when s >= 760 then 2000000 when s >= 700 then 500000 when s >= 650 then 50000 else 10000 end) * cpi() $$;

create or replace function card_tick(c uuid) returns credit_cards language plpgsql security definer set search_path=public as $$
declare k credit_cards; d date; i int := 0;
begin
  select * into k from credit_cards where character_id=c and status<>'closed' for update;
  if k.id is null then return null; end if;
  d := k.last_tick;
  while d < current_date and i < 90 loop
    d := d + 1; i := i + 1;
    if k.owed > 0 then k.owed := round(k.owed * (1 + k.apr / 365), 2); end if;   -- interés diario
    if d >= k.stmt_due then                                                      -- corte
      if k.stmt_min > 0 and k.stmt_paid >= k.stmt_min then
        insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'pago_a_tiempo', k.stmt_paid, 'Pagaste tu mínimo a tiempo', d);
        k.missed := 0;
        declare s int := credit_score(c); begin
          if s >= 650 and k.owed <= k.credit_limit * 0.5 then
            k.credit_limit := round(least(k.credit_limit * case when s >= 800 then 2 when s >= 760 then 1.5 when s >= 700 then 1.25 else 1.1 end, credit_cap(s)), 2);
          end if; end;
      elsif k.stmt_min > 0 then
        k.missed := k.missed + 1; k.owed := k.owed + round(25 * cpi(), 2);
        insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'pago_tarde', k.stmt_min, 'No cubriste tu pago mínimo · cargo por atraso', d);
        k.credit_limit := round(greatest(k.credit_limit * 0.8, 500), 2);
        if k.missed >= 3 then
          k.status := 'closed';
          insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'impago', k.owed, '3 pagos vencidos: tarjeta cancelada, la deuda sigue', d);
        elsif k.missed >= 2 then k.status := 'frozen'; end if;
      end if;
      k.stmt_min := case when k.owed <= 0 then 0 else round(greatest(least(k.owed, 50 * cpi()), k.owed * 0.1), 2) end;
      k.stmt_paid := 0; k.stmt_due := d + 7;
    end if;
  end loop;
  k.last_tick := d;
  update credit_cards set owed=k.owed, credit_limit=k.credit_limit, status=k.status, last_tick=k.last_tick, stmt_due=k.stmt_due, stmt_min=k.stmt_min,
    stmt_paid=k.stmt_paid, missed=k.missed where id=k.id;
  return k;
end $$;

-- Intereses visibles: se acumulan por periodo y aparecen en el historial en cada corte.
alter table credit_cards add column if not exists int_cycle numeric not null default 0;

create or replace function card_tick(c uuid) returns credit_cards language plpgsql security definer set search_path=public as $$
declare k credit_cards; d date; i int := 0;
begin
  select * into k from credit_cards where character_id=c and status<>'closed' for update;
  if k.id is null then return null; end if;
  d := k.last_tick;
  while d < current_date and i < 90 loop
    d := d + 1; i := i + 1;
    if k.owed > 0 then k.int_cycle := k.int_cycle + round(k.owed * k.apr / 365, 2); k.owed := k.owed + round(k.owed * k.apr / 365, 2); end if;   -- interés diario
    if d >= k.stmt_due then                                                      -- corte
      if k.int_cycle > 0 then insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'intereses', k.int_cycle, 'Intereses del periodo (' || round(k.apr*100) || '% anual)', d); k.int_cycle := 0; end if;
      if k.stmt_min > 0 and k.stmt_paid >= k.stmt_min then
        insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'pago_a_tiempo', k.stmt_paid, 'Pagaste tu mínimo a tiempo', d);
        k.missed := 0;
        declare s int := credit_score(c); begin
          if s >= 650 and k.owed <= k.credit_limit * 0.5 then
            k.credit_limit := round(least(k.credit_limit * case when s >= 800 then 2 when s >= 760 then 1.5 when s >= 700 then 1.25 else 1.1 end, credit_cap(s)), 2);
          end if; end;
      elsif k.stmt_min > 0 then
        k.missed := k.missed + 1; k.owed := k.owed + round(25 * cpi(), 2);
        insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'pago_tarde', k.stmt_min, 'No cubriste tu pago mínimo · cargo por atraso', d);
        k.credit_limit := round(greatest(k.credit_limit * 0.8, 500), 2);
        if k.missed >= 3 then
          k.status := 'closed';
          insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'impago', k.owed, '3 pagos vencidos: tarjeta cancelada, la deuda sigue', d);
        elsif k.missed >= 2 then k.status := 'frozen'; end if;
      end if;
      k.stmt_min := case when k.owed <= 0 then 0 else round(greatest(least(k.owed, 50 * cpi()), k.owed * 0.1), 2) end;
      k.stmt_paid := 0; k.stmt_due := d + 7;
    end if;
  end loop;
  k.last_tick := d;
  update credit_cards set owed=k.owed, credit_limit=k.credit_limit, status=k.status, last_tick=k.last_tick, stmt_due=k.stmt_due, stmt_min=k.stmt_min,
    stmt_paid=k.stmt_paid, missed=k.missed, int_cycle=k.int_cycle where id=k.id;
  return k;
end $$;

-- Transferir escribiendo el nombre de la persona (además del número de cuenta).
create or replace function account_by_name(q text) returns table(number text, holder text) language sql stable security definer set search_path=public as $$
  select a.number, c.first_name || ' ' || c.last_name from characters c join accounts a on a.id = personal_acc(c.id)
  where c.status = 'active' and lower(c.first_name || ' ' || c.last_name) like '%' || lower(trim(q)) || '%' order by c.first_name limit 5 $$;
