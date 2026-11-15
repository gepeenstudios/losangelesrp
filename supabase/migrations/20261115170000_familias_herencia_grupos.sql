-- Familias, herencias y grupos de WhatsApp.
-- Al morir un personaje: primero se pagan sus deudas (tarjeta de crédito) y luego todo pasa a 1) su heredero, 2) si no tiene, a su familia
-- (dinero repartido en partes iguales; casas/autos/objetos al primero), 3) si no tiene familia, a la siguiente vida del mismo usuario
-- (si la registra en 7 días reales), 4) si no, a la Tesorería.

-- ---------- familias ----------
create table if not exists families(id uuid primary key default gen_random_uuid(), name text not null, created_by uuid references characters on delete set null,
  group_id uuid, created_at timestamptz default now());
create table if not exists family_members(family_id uuid references families on delete cascade, character_id uuid references characters on delete cascade,
  relation text not null default 'Familiar', status text not null default 'pending' check (status in ('pending','active')), invited_by uuid, created_at timestamptz default now(),
  primary key(family_id, character_id));
create unique index if not exists family_one on family_members(character_id) where status = 'active';
alter table families enable row level security; alter table family_members enable row level security;
drop policy if exists fam_sel on families; create policy fam_sel on families for select to authenticated using (true);
drop policy if exists fm_sel on family_members; create policy fm_sel on family_members for select to authenticated using (true);
alter table characters add column if not exists heir uuid references characters on delete set null;

-- ---------- grupos de WhatsApp ----------
create table if not exists chat_groups(id uuid primary key default gen_random_uuid(), name text not null, photo text, created_by uuid references characters on delete set null, created_at timestamptz default now());
create table if not exists chat_group_members(group_id uuid references chat_groups on delete cascade, character_id uuid references characters on delete cascade,
  admin bool not null default false, created_at timestamptz default now(), primary key(group_id, character_id));
create table if not exists group_messages(id uuid primary key default gen_random_uuid(), group_id uuid references chat_groups on delete cascade,
  from_char uuid references characters on delete set null, body text not null, created_at timestamptz default now());
create index if not exists group_messages_g on group_messages(group_id, created_at);
alter table chat_groups enable row level security; alter table chat_group_members enable row level security; alter table group_messages enable row level security;
create or replace function in_group(g uuid) returns bool language sql stable security definer set search_path=public as $$
  select exists(select 1 from chat_group_members m where m.group_id = g and owns_char(m.character_id)) $$;
drop policy if exists cg_sel on chat_groups; create policy cg_sel on chat_groups for select to authenticated using (in_group(id));
drop policy if exists cgm_sel on chat_group_members; create policy cgm_sel on chat_group_members for select to authenticated using (in_group(group_id));
drop policy if exists gm_sel on group_messages; create policy gm_sel on group_messages for select to authenticated using (in_group(group_id));
drop policy if exists gm_ins on group_messages; create policy gm_ins on group_messages for insert to authenticated with check (owns_char(from_char) and exists(select 1 from chat_group_members m where m.group_id = group_messages.group_id and m.character_id = from_char));

create or replace function group_create(c uuid, name text, members uuid[]) returns uuid language plpgsql security definer set search_path=public as $$
declare g uuid; m uuid;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  if coalesce(trim(name), '') = '' then raise exception 'Ponle nombre al grupo'; end if;
  insert into chat_groups(name, created_by) values(trim(name), c) returning id into g;
  insert into chat_group_members values(g, c, true);
  foreach m in array coalesce(members, '{}') loop
    if m <> c and exists(select 1 from characters where id = m and status = 'active') then insert into chat_group_members(group_id, character_id) values(g, m) on conflict do nothing; end if;
  end loop;
  return g;
end $$;
create or replace function group_add(c uuid, g uuid, who uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not owns_char(c) or not exists(select 1 from chat_group_members where group_id = g and character_id = c and admin) then raise exception 'Solo los admins del grupo agregan gente'; end if;
  if not exists(select 1 from characters where id = who and status = 'active') then raise exception 'Esa persona no tiene vida activa'; end if;
  insert into chat_group_members(group_id, character_id) values(g, who) on conflict do nothing;
end $$;
create or replace function group_leave(c uuid, g uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  delete from chat_group_members where group_id = g and character_id = c;
  if not exists(select 1 from chat_group_members where group_id = g) then delete from chat_groups where id = g;
  elsif not exists(select 1 from chat_group_members where group_id = g and admin) then
    update chat_group_members set admin = true where group_id = g and character_id = (select character_id from chat_group_members where group_id = g order by created_at limit 1);
  end if;
end $$;
grant execute on function group_create(uuid, text, uuid[]) to authenticated; grant execute on function group_add(uuid, uuid, uuid) to authenticated; grant execute on function group_leave(uuid, uuid) to authenticated;

-- ---------- funciones de familia ----------
create or replace function family_create(c uuid, name text) returns uuid language plpgsql security definer set search_path=public as $$
declare f uuid; g uuid;
begin
  if not owns_char(c) or not exists(select 1 from characters where id = c and status = 'active') then raise exception 'Necesitas una vida activa'; end if;
  if exists(select 1 from family_members where character_id = c and status = 'active') then raise exception 'Ya perteneces a una familia'; end if;
  if coalesce(trim(name), '') = '' then raise exception 'Ponle nombre a tu familia'; end if;
  g := group_create(c, 'Familia ' || trim(name), '{}');
  insert into families(name, created_by, group_id) values(trim(name), c, g) returning id into f;
  insert into family_members(family_id, character_id, relation, status, invited_by) values(f, c, 'Jefe de familia', 'active', c);
  return f;
end $$;
create or replace function family_invite(c uuid, who uuid, relation text) returns void language plpgsql security definer set search_path=public as $$
declare f uuid := (select family_id from family_members where character_id = c and status = 'active');
begin
  if not owns_char(c) or f is null then raise exception 'Primero crea o únete a una familia'; end if;
  if who = c or not exists(select 1 from characters where id = who and status = 'active') then raise exception 'Esa persona no tiene vida activa'; end if;
  if exists(select 1 from family_members where character_id = who and status = 'active') then raise exception 'Esa persona ya tiene familia'; end if;
  insert into family_members(family_id, character_id, relation, invited_by) values(f, who, coalesce(nullif(trim(relation), ''), 'Familiar'), c)
    on conflict (family_id, character_id) do update set relation = excluded.relation, status = 'pending';
end $$;
create or replace function family_respond(c uuid, f uuid, accept bool) returns void language plpgsql security definer set search_path=public as $$
begin
  if not owns_char(c) or not exists(select 1 from family_members where family_id = f and character_id = c and status = 'pending') then raise exception 'No tienes esa invitación'; end if;
  if not accept then delete from family_members where family_id = f and character_id = c; return; end if;
  if exists(select 1 from family_members where character_id = c and status = 'active') then raise exception 'Ya perteneces a una familia'; end if;
  update family_members set status = 'active' where family_id = f and character_id = c;
  insert into chat_group_members(group_id, character_id) select group_id, c from families where id = f and group_id is not null on conflict do nothing;
end $$;
create or replace function family_leave(c uuid) returns void language plpgsql security definer set search_path=public as $$
declare f uuid := (select family_id from family_members where character_id = c and status = 'active');
begin
  if not owns_char(c) or f is null then raise exception 'No perteneces a una familia'; end if;
  delete from family_members where family_id = f and character_id = c;
  delete from chat_group_members where character_id = c and group_id = (select group_id from families where id = f);
  if not exists(select 1 from family_members where family_id = f and status = 'active') then delete from families where id = f; end if;
end $$;
create or replace function set_heir(c uuid, h uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  if h is not null and (h = c or not exists(select 1 from characters where id = h and status = 'active')) then raise exception 'El heredero debe ser otra persona con vida activa'; end if;
  perform set_config('app.trusted', 'on', true);
  update characters set heir = h where id = c;
  perform set_config('app.trusted', 'off', true);
end $$;
grant execute on function family_create(uuid, text) to authenticated; grant execute on function family_invite(uuid, uuid, text) to authenticated;
grant execute on function family_respond(uuid, uuid, bool) to authenticated; grant execute on function family_leave(uuid) to authenticated; grant execute on function set_heir(uuid, uuid) to authenticated;

-- ---------- herencias ----------
create table if not exists inheritances(id uuid primary key default gen_random_uuid(), from_char uuid references characters on delete cascade, user_id uuid,
  route text not null, recipients uuid[] default '{}', money numeric default 0, debt_paid numeric default 0, status text not null default 'done',
  expires_at timestamptz, created_at timestamptz default now());
alter table inheritances enable row level security;
drop policy if exists inh_sel on inheritances; create policy inh_sel on inheritances for select to authenticated using (user_id = auth.uid() or recipients && (select coalesce(array_agg(id), '{}') from characters where user_id = auth.uid()) or staff_level() >= 1);

-- pasa todo lo de «dead» a «rec» (lista; dinero en partes iguales, lo indivisible al primero). rec vacío = Tesorería.
create or replace function estate_transfer(dead uuid, rec uuid[]) returns numeric language plpgsql security definer set search_path=public as $$
declare a record; n int := coalesce(array_length(rec, 1), 0); first uuid := rec[1]; part numeric; total numeric := 0; i int; h record; dest uuid; nm text;
begin
  nm := (select first_name || ' ' || last_name from characters where id = dead);
  -- dinero de sus cuentas personales y de ahorro (solo las que son únicamente suyas)
  for a in select id, balance from accounts where owners = array[dead] and kind in ('personal','savings') and balance > 0 for update loop
    total := total + a.balance;
    if n = 0 then perform move_money(a.id, gov_acc(), a.balance, 'Herencia sin herederos · ' || nm);
    else
      for i in 1..n loop
        part := case when i = n then a.balance - round(a.balance / n, 2) * (n - 1) else round(a.balance / n, 2) end;
        dest := personal_acc(rec[i]);
        if part > 0 and dest is not null then perform move_money(a.id, dest, part, 'Herencia de ' || nm); end if;
      end loop;
    end if;
  end loop;
  -- casas, autos y objetos: al primero (o quedan libres si va a la Tesorería)
  update properties set owner_char = first, for_sale = case when first is null then true else for_sale end where owner_char = dead;
  if first is null then delete from vehicles where owner_char = dead; else update vehicles set owner_char = first where owner_char = dead; end if;
  if first is null then delete from items where owner_char = dead; else update items set owner_char = first where owner_char = dead; end if;
  -- empresas: el heredero entra como dueño en su lugar
  update companies set owners = case when first is null then array_remove(owners, dead) else array_replace(owners, dead, first) end where dead = any(owners);
  update accounts set owners = case when first is null then array_remove(owners, dead) else array_replace(owners, dead, first) end where dead = any(owners) and kind = 'business';
  -- acciones y cripto: repartidas en partes iguales (el sobrante al primero)
  for h in select * from holdings where character_id = dead and shares > 0 loop
    if n = 0 then delete from holdings where id = h.id;
    else
      for i in 1..n loop
        part := floor(h.shares / n) + case when i = 1 then h.shares - floor(h.shares / n) * n else 0 end;
        if part > 0 then insert into holdings(character_id, company_id, shares, cost) values(rec[i], h.company_id, part, round(h.cost * part / h.shares, 2))
          on conflict (character_id, company_id) do update set shares = holdings.shares + excluded.shares, cost = holdings.cost + excluded.cost; end if;
      end loop;
      delete from holdings where id = h.id;
    end if;
  end loop;
  for h in select * from crypto_hold where character_id = dead and qty > 0 loop
    if n = 0 then update crypto_coins set pool_coin = pool_coin + h.qty where sym = h.sym;  -- las monedas regresan al mercado
    else
      for i in 1..n loop
        insert into crypto_hold values(rec[i], h.sym, round(h.qty / n, 8), round(h.cost / n, 2))
          on conflict (character_id, sym) do update set qty = crypto_hold.qty + excluded.qty, cost = crypto_hold.cost + excluded.cost;
      end loop;
    end if;
    delete from crypto_hold where character_id = dead and sym = h.sym;
  end loop;
  return total;
end $$;
revoke all on function estate_transfer(uuid, uuid[]) from public, anon, authenticated;

create or replace function estate_on_death() returns trigger language plpgsql security definer set search_path=public as $$
declare rec uuid[]; route text; debt numeric; paid numeric := 0; a record; k credit_cards; take numeric;
begin
  if not (new.status = 'dead' and old.status is distinct from 'dead') then return new; end if;
  -- 1) deudas: la tarjeta de crédito se cobra primero de su dinero
  for k in select * from credit_cards where character_id = new.id and owed > 0 loop
    debt := k.owed;
    for a in select id, balance from accounts where owners = array[new.id] and kind in ('personal','savings') and balance > 0 order by kind loop
      exit when debt <= 0; take := least(a.balance, debt);
      perform move_money(a.id, gov_acc(), take, 'Pago de deuda de tarjeta (herencia)'); debt := debt - take; paid := paid + take;
    end loop;
    update credit_cards set owed = debt, status = 'closed' where id = k.id;
  end loop;
  -- 2) a quién le toca
  if new.heir is not null and exists(select 1 from characters where id = new.heir and status = 'active') then rec := array[new.heir]; route := 'heredero';
  else
    select array_agg(m.character_id order by (m.relation ilike '%espos%' or m.relation ilike '%pareja%') desc, m.created_at) into rec
      from family_members m join characters ch on ch.id = m.character_id
      where m.status = 'active' and ch.status = 'active' and m.character_id <> new.id and m.family_id = (select family_id from family_members where character_id = new.id and status = 'active');
    route := case when rec is not null then 'familia' end;
  end if;
  if rec is not null then
    insert into inheritances(from_char, user_id, route, recipients, money, debt_paid) values(new.id, new.user_id, route, rec, estate_transfer(new.id, rec), paid);
  else  -- 3) espera a la siguiente vida del mismo usuario (7 días reales); después, 4) Tesorería
    insert into inheritances(from_char, user_id, route, money, debt_paid, status, expires_at)
      values(new.id, new.user_id, 'siguiente_vida', coalesce((select sum(balance) from accounts where owners = array[new.id] and kind in ('personal','savings')), 0), paid, 'pending', now() + interval '7 days');
  end if;
  delete from family_members where character_id = new.id;
  return new;
end $$;
drop trigger if exists characters_estate on characters;
create trigger characters_estate after update of status on characters for each row execute function estate_on_death();

-- la siguiente vida del usuario recibe la herencia pendiente al ser aprobada
create or replace function estate_on_activate() returns trigger language plpgsql security definer set search_path=public as $$
declare i inheritances;
begin
  if not (new.status = 'active' and old.status is distinct from 'active') then return new; end if;
  for i in select * from inheritances where user_id = new.user_id and status = 'pending' and expires_at > now() and from_char <> new.id loop
    update inheritances set money = estate_transfer(i.from_char, array[new.id]), recipients = array[new.id], status = 'done' where id = i.id;
  end loop;
  return new;
end $$;
drop trigger if exists characters_estate_next on characters;
create trigger characters_estate_next after update of status on characters for each row execute function estate_on_activate();

-- herencias que nadie reclamó a tiempo → Tesorería (lo llama la web cada pocos minutos)
create or replace function estate_expire() returns int language plpgsql security definer set search_path=public as $$
declare i inheritances; n int := 0;
begin
  for i in select * from inheritances where status = 'pending' and expires_at <= now() for update skip locked loop
    perform estate_transfer(i.from_char, '{}'); update inheritances set route = 'tesoreria', status = 'done' where id = i.id; n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function estate_expire() to authenticated;
