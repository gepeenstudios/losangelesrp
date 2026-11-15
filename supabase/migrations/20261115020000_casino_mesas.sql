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
