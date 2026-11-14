-- Bot de Discord y roles con vencimiento

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
