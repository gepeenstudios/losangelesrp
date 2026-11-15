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
