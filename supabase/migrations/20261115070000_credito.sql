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
