-- Recompensas públicas: cualquiera puede ver quién se busca (app Se Busca).
drop policy if exists rec_wanted on records;
create policy rec_wanted on records for select to authenticated using (kind = 'orden' and not paid);

-- Compras a plazos con la tarjeta de crédito: 1, 3, 6 o 12 meses del juego (12 meses ≈ 1 mes real). Más plazo = más interés.
create table if not exists credit_plans(id uuid primary key default gen_random_uuid(), character_id uuid not null references characters on delete cascade,
  concept text not null, principal numeric not null, total numeric not null, months int not null, monthly numeric not null, paid int not null default 0,
  next_due date not null, status text not null default 'active', created_at timestamptz default now());
alter table credit_plans enable row level security;
drop policy if exists cp_sel on credit_plans; create policy cp_sel on credit_plans for select to authenticated using (owns_char(character_id) or staff_level() >= 2);
create or replace function plan_rate(months int) returns numeric language sql immutable as $$
  select case months when 1 then 0.03 when 3 then 0.09 when 6 then 0.20 when 12 then 0.45 end $$;
-- lo que falta por cobrar de tus planes (aparta línea de crédito)
create or replace function plan_left(c uuid) returns numeric language sql stable security definer set search_path=public as $$
  select coalesce(sum(total - monthly * paid), 0) from credit_plans where character_id = c and status = 'active' $$;

create or replace function card_tick(c uuid) returns credit_cards language plpgsql security definer set search_path=public as $$
declare k credit_cards; d date; i int := 0; p record; m numeric;
begin
  select * into k from credit_cards where character_id=c and status<>'closed' for update;
  if k.id is null then return null; end if;
  d := k.last_tick;
  while d < game_day() and i < 90 loop
    d := d + 1; i := i + 1;
    if k.owed > 0 then k.int_cycle := k.int_cycle + round(k.owed * k.apr / 365, 2); k.owed := k.owed + round(k.owed * k.apr / 365, 2); end if;   -- interés diario
    -- compras a plazos: cada 30 días del juego (1 mes) la mensualidad pasa a lo que debes en la tarjeta
    for p in select * from credit_plans where character_id=c and status='active' and next_due <= d loop
      m := case when p.paid + 1 >= p.months then p.total - p.monthly * p.paid else p.monthly end;
      k.owed := k.owed + m;
      update credit_plans set paid = paid + 1, next_due = next_due + 30, status = case when paid + 1 >= months then 'done' else 'active' end where id = p.id;
      insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'cargo', m, 'Mensualidad ' || (p.paid + 1) || '/' || p.months || ' · ' || p.concept, game_start(d));
    end loop;
    if d >= k.stmt_due then                                                      -- corte
      if k.int_cycle > 0 then insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'intereses', k.int_cycle, 'Intereses del periodo (' || round(k.apr*100) || '% anual)', game_start(d)); k.int_cycle := 0; end if;
      if k.stmt_min > 0 and k.stmt_paid >= k.stmt_min then
        insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'pago_a_tiempo', k.stmt_paid, 'Pagaste tu mínimo a tiempo', game_start(d));
        k.missed := 0;
        declare s int := credit_score(c); begin
          if s >= 650 and k.owed <= k.credit_limit * 0.5 then
            k.credit_limit := round(least(k.credit_limit * case when s >= 800 then 2 when s >= 760 then 1.5 when s >= 700 then 1.25 else 1.1 end, credit_cap(s)), 2);
          end if; end;
      elsif k.stmt_min > 0 then
        k.missed := k.missed + 1; k.owed := k.owed + round(25 * cpi(), 2);
        insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'pago_tarde', k.stmt_min, 'No cubriste tu pago mínimo · cargo por atraso', game_start(d));
        k.credit_limit := round(greatest(k.credit_limit * 0.8, 500), 2);
        if k.missed >= 3 then
          k.status := 'closed';
          insert into credit_events(character_id, kind, amount, note, created_at) values(c, 'impago', k.owed, '3 pagos vencidos: tarjeta cancelada, la deuda sigue', game_start(d));
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
  if k.owed + plan_left(c) + amt + fee > k.credit_limit then raise exception 'Te pasas de tu línea de crédito (disponible %)', round(k.credit_limit - k.owed - plan_left(c), 2); end if;
  perform move_money(gov_acc(), t, amt, 'Tarjeta de crédito RRVA · ' || coalesce(nullif(concept,''), 'Compra'));
  update credit_cards set owed = owed + amt + fee where id = k.id;
  insert into credit_events(character_id, kind, amount, note) values(c, 'cargo', amt + fee, coalesce(nullif(concept,''), 'Compra') || case when fee > 0 then ' (retiro de efectivo, comisión 3%)' else '' end);
  return jsonb_build_object('owed', k.owed + amt + fee, 'available', k.credit_limit - k.owed - amt - fee);
end $$;

create or replace function card_plan(c uuid, dest text, amount numeric, months int, concept text default 'Compra a plazos') returns jsonb language plpgsql security definer set search_path=public as $$
declare k credit_cards; t uuid; amt numeric := round(amount, 2); tot numeric; mo numeric;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  k := card_tick(c);
  if k.id is null then raise exception 'No tienes tarjeta de crédito'; end if;
  if k.status <> 'active' then raise exception 'Tu tarjeta está congelada por pagos atrasados. Paga tu mínimo.'; end if;
  if plan_rate(months) is null then raise exception 'Plazo no válido (1, 3, 6 o 12 meses)'; end if;
  if amt is null or amt < 100 then raise exception 'Las compras a plazos son desde $100'; end if;
  select id into t from accounts where number = replace(dest, ' ', '');
  if t is null then raise exception 'Cuenta destino no encontrada'; end if;
  if t = personal_acc(c) then raise exception 'A plazos no puedes retirar efectivo a tu propia cuenta'; end if;
  tot := round(amt * (1 + plan_rate(months)), 2); mo := round(tot / months, 2);
  if k.owed + plan_left(c) + tot > k.credit_limit then raise exception 'Te pasas de tu línea de crédito (disponible %)', round(k.credit_limit - k.owed - plan_left(c), 2); end if;
  perform move_money(gov_acc(), t, amt, 'Tarjeta de crédito RRVA · ' || coalesce(nullif(concept,''), 'Compra') || ' (a ' || months || ' meses)');
  insert into credit_plans(character_id, concept, principal, total, months, monthly, next_due) values(c, coalesce(nullif(concept,''), 'Compra a plazos'), amt, tot, months, mo, game_day() + 30);
  insert into credit_events(character_id, kind, amount, note) values(c, 'cargo', amt, coalesce(nullif(concept,''), 'Compra') || ' a ' || months || ' meses: total ' || tot || ' en ' || months || ' mensualidades de ' || mo);
  return jsonb_build_object('total', tot, 'monthly', mo);
end $$;
grant execute on function card_plan(uuid, text, numeric, int, text) to authenticated;
