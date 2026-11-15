-- Casino con gente: mesas donde juegan varios jugadores entre sí. El dinero se guarda en la cuenta «Casino · mesas»,
-- el ganador se lleva el bote y la casa cobra 5% que va a la Tesorería.
create table if not exists casino_tables(id uuid primary key default gen_random_uuid(), game text not null check (game in ('jackpot','dados')),
  buy_in numeric not null, host uuid references characters on delete cascade, max_players int not null default 8,
  status text not null default 'open', winner uuid, pot numeric default 0, result jsonb, created_at timestamptz default now(), finished_at timestamptz);
create table if not exists casino_seats(table_id uuid references casino_tables on delete cascade, character_id uuid references characters on delete cascade,
  amount numeric not null, roll int, joined_at timestamptz default now(), primary key(table_id, character_id));
alter table casino_tables enable row level security; alter table casino_seats enable row level security;
drop policy if exists ct_sel on casino_tables; create policy ct_sel on casino_tables for select to authenticated using (true);
drop policy if exists cs_sel on casino_seats; create policy cs_sel on casino_seats for select to authenticated using (true);

create or replace function pvp_escrow() returns uuid language plpgsql security definer set search_path=public as $$
declare a uuid := (select id from accounts where kind='business' and name='Casino · mesas' limit 1);
begin
  if a is null then insert into accounts(kind, name, owners) values('business', 'Casino · mesas', '{}') returning id into a; end if;
  return a;
end $$;

create or replace function pvp_check(c uuid, amount numeric) returns void language plpgsql security definer set search_path=public as $$
declare mx numeric := coalesce((select (value#>>'{}')::numeric from settings where key='casino_max_bet'),50000);
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  if not exists(select 1 from characters where id=c and status='active') then raise exception 'Tu vida debe estar activa'; end if;
  if amount is null or amount < 1 then raise exception 'La apuesta mínima es $1'; end if;
  if amount > mx then raise exception 'La apuesta máxima es $%', mx; end if;
end $$;

create or replace function pvp_resolve(t uuid) returns void language plpgsql security definer set search_path=public as $$
declare tb casino_tables; total numeric; rake numeric; r numeric; acc numeric := 0; s record; w uuid; best int; tied uuid[]; rounds jsonb := '[]'; rr jsonb;
begin
  select * into tb from casino_tables where id=t for update;
  if tb.status <> 'open' then return; end if;
  select sum(amount) into total from casino_seats where table_id=t;
  rake := round(total*0.05, 2);
  if tb.game = 'jackpot' then
    r := random()*total;
    for s in select * from casino_seats where table_id=t order by joined_at loop acc := acc + s.amount; if w is null and r < acc then w := s.character_id; end if; end loop;
  else -- dados: todos tiran 2 dados; si empatan los más altos, vuelven a tirar solo ellos
    select array_agg(character_id) into tied from casino_seats where table_id=t;
    loop
      rr := '{}'; best := 0;
      for s in select unnest(tied) id loop r := 2 + floor(random()*6) + floor(random()*6); rr := rr || jsonb_build_object(s.id::text, r); best := greatest(best, r::int); end loop;
      rounds := rounds || jsonb_build_array(rr);
      update casino_seats set roll = (rr->>character_id::text)::int where table_id=t and roll is null and rr ? character_id::text;
      select array_agg(k::uuid) into tied from jsonb_each_text(rr) x(k, v) where v::int = best;
      exit when array_length(tied,1) = 1;
    end loop;
    w := tied[1];
  end if;
  perform move_money(pvp_escrow(), personal_acc(w), total - rake, 'Casino con gente · ganaste el bote');
  if rake > 0 then perform move_money(pvp_escrow(), gov_acc(), rake, 'Casino con gente · comisión de la casa'); end if;
  insert into casino_bets(character_id, game, bet, mult, payout, result)
    select character_id, 'mesa_' || tb.game, amount, case when character_id = w then round((total-rake)/amount, 4) else 0 end, case when character_id = w then total - rake else 0 end, jsonb_build_object('table', t)
    from casino_seats where table_id=t;
  update casino_tables set status='done', winner=w, result=jsonb_build_object('pot', total, 'rake', rake, 'prize', total-rake, 'rounds', rounds), finished_at=now() where id=t;
  update casino_tables set pot = (select sum(casino_seats.amount) from casino_seats where table_id=t) where id=t;
end $$;

create or replace function pvp_create(c uuid, game text, amount numeric, maxp int default 8) returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid;
begin
  perform pvp_check(c, amount);
  if game not in ('jackpot','dados') then raise exception 'Juego no válido'; end if;
  if exists(select 1 from casino_tables where host=c and status='open') then raise exception 'Ya tienes una mesa abierta'; end if;
  insert into casino_tables(game, buy_in, host, max_players, pot) values(game, round(amount,2), c, least(greatest(coalesce(maxp,8),2),10), round(amount,2)) returning id into t;
  perform move_money(personal_acc(c), pvp_escrow(), round(amount,2), 'Casino con gente · entrada a mesa');
  insert into casino_seats(table_id, character_id, amount) values(t, c, round(amount,2));
  return t;
end $$;

create or replace function pvp_join(t uuid, c uuid, amount numeric default null) returns void language plpgsql security definer set search_path=public as $$
declare tb casino_tables; n int;
begin
  select * into tb from casino_tables where id=t for update;
  if tb.id is null or tb.status <> 'open' then raise exception 'Esa mesa ya no está abierta'; end if;
  if tb.game = 'dados' then amount := tb.buy_in; end if;
  perform pvp_check(c, amount);
  if exists(select 1 from casino_seats where table_id=t and character_id=c) then raise exception 'Ya estás en esta mesa'; end if;
  select count(*) into n from casino_seats where table_id=t;
  if n >= tb.max_players then raise exception 'La mesa está llena'; end if;
  perform move_money(personal_acc(c), pvp_escrow(), round(amount,2), 'Casino con gente · entrada a mesa');
  insert into casino_seats(table_id, character_id, amount) values(t, c, round(amount,2));
  update casino_tables set pot = (select sum(casino_seats.amount) from casino_seats where table_id=t) where id=t;
  if n + 1 >= tb.max_players then perform pvp_resolve(t); end if; -- mesa llena: se juega sola
end $$;

create or replace function pvp_leave(t uuid, c uuid) returns void language plpgsql security definer set search_path=public as $$
declare tb casino_tables; s record;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  select * into tb from casino_tables where id=t for update;
  if tb.status <> 'open' then raise exception 'La mesa ya se jugó'; end if;
  for s in select * from casino_seats where table_id=t and (character_id=c or tb.host=c) loop -- si se va el anfitrión se cierra la mesa y se devuelve todo
    perform move_money(pvp_escrow(), personal_acc(s.character_id), s.amount, 'Casino con gente · devolución');
    delete from casino_seats where table_id=t and character_id=s.character_id;
  end loop;
  if tb.host=c then update casino_tables set status='cancelled', finished_at=now() where id=t;
  else update casino_tables set pot = coalesce((select sum(casino_seats.amount) from casino_seats where table_id=t),0) where id=t; end if;
end $$;

create or replace function pvp_start(t uuid) returns void language plpgsql security definer set search_path=public as $$
declare tb casino_tables;
begin
  select * into tb from casino_tables where id=t;
  if tb.id is null or not owns_char(tb.host) then raise exception 'Solo el anfitrión inicia la mesa'; end if;
  if (select count(*) from casino_seats where table_id=t) < 2 then raise exception 'Se necesitan al menos 2 jugadores'; end if;
  perform pvp_resolve(t);
end $$;
revoke all on function pvp_resolve(uuid) from public, anon, authenticated;
revoke all on function pvp_escrow() from public, anon, authenticated;
grant execute on function pvp_create(uuid,text,numeric,int), pvp_join(uuid,uuid,numeric), pvp_leave(uuid,uuid), pvp_start(uuid) to authenticated;
