-- Cripto: sin impuestos al comprar, tener o enviar; solo al venderla a dinero, sobre la ganancia (settings.impuestos.crypto, 25% por defecto)
create or replace function crypto_trade(c uuid, s text, side text, amount numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare tax numeric := 0; k crypto_coins; x numeric; q numeric; usd numeric; h crypto_hold; fee numeric := 0.005; np numeric;
begin
  if not owns_char(c) then raise exception 'No es tu personaje'; end if;
  perform char_guard(c);
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
    -- impuesto solo al convertir a dinero: sobre la ganancia (venta − lo que te costaron esas monedas)
    tax := round(greatest(usd - h.cost * q / h.qty, 0) * tax_cfg('crypto', 25) / 100, 2);
    update crypto_hold set qty = qty - q, cost = case when qty - q <= 0 then 0 else cost * (qty - q) / qty end where character_id = c and sym = s;
    perform move_money(crypto_acc(), personal_acc(c), usd - tax, 'Bitso · venta ' || s || case when tax > 0 then ' (neto de impuesto sobre ganancias)' else '' end);
    if tax > 0 then perform move_money(crypto_acc(), gov_acc(), tax, 'Impuesto sobre ganancias cripto · ' || s); end if;
    update crypto_coins set pool_usd = pool_usd - usd, pool_coin = pool_coin + q where sym = s returning * into k;
  else raise exception 'Operación inválida'; end if;
  np := round((k.virt_usd + k.pool_usd) / k.pool_coin, 8);
  update crypto_coins set price = np where sym = s;
  insert into crypto_hist values(s, now(), np) on conflict (sym, t) do update set price = excluded.price;
  insert into crypto_trades(character_id, sym, side, qty, price, usd) values(c, s, side, q, round(usd / q, 8), usd);
  return jsonb_build_object('tax', tax, 'qty', q, 'usd', usd, 'price', round(usd / q, 8), 'new_price', np);
end $$;

create or replace function enact_law(c uuid, title text, body text, effect text default 'ninguno', params jsonb default '{}') returns int
language plpgsql security definer set search_path=public as $$
declare office text := lawmaker(c); prev jsonb; v numeric; k text; n int; nm text := (select first_name || ' ' || last_name from characters where id = c);
begin
  if office is null then raise exception 'Solo el Presidente o el Gobernador pueden promulgar leyes'; end if;
  if coalesce(trim(title), '') = '' or coalesce(trim(body), '') = '' then raise exception 'La ley necesita título y texto'; end if;
  if effect = 'impuesto' then
    k := params->>'tipo'; v := (params->>'valor')::numeric;
    if k not in ('sales','property','corp','transfer','crypto') or v is null or v < 0 or v > 50 then raise exception 'Impuesto inválido (0 a 50%%)'; end if;
    prev := jsonb_build_object('tipo', k, 'valor', tax_cfg(k, null));
    insert into settings values('impuestos', jsonb_build_object(k, v)) on conflict(key) do update set value = settings.value || jsonb_build_object(k, v);
  elsif effect in ('ahorro','dinero_inicial','casino_max','visa_dias') then
    k := case effect when 'ahorro' then 'savings_rate' when 'dinero_inicial' then 'start_money' when 'casino_max' then 'casino_max_bet' else 'visa_days' end;
    v := (params->>'valor')::numeric;
    if v is null or v < 0 or (effect = 'ahorro' and v > 30) or (effect = 'dinero_inicial' and v > 100000) or (effect = 'casino_max' and (v < 100 or v > 1000000)) or (effect = 'visa_dias' and (v < 1 or v > 365)) then
      raise exception 'Valor fuera de rango'; end if;
    prev := jsonb_build_object('key', k, 'value', (select value from settings where key = k));
    insert into settings values(k, to_jsonb(v)) on conflict(key) do update set value = excluded.value;
  elsif effect = 'servicio_militar' then
    if jsonb_typeof(params->'depts') <> 'array' then raise exception 'Elige los empleos'; end if;
    prev := jsonb_build_object('key', 'military_required', 'value', (select value from settings where key = 'military_required'));
    insert into settings values('military_required', params->'depts') on conflict(key) do update set value = excluded.value;
  elsif effect = 'delito' then
    if coalesce(params->>'code','') = '' or coalesce(params->>'title','') = '' then raise exception 'El delito necesita artículo y nombre'; end if;
    if exists(select 1 from penal_code where code = params->>'code') then raise exception 'Ya existe el artículo %', params->>'code'; end if;
    if coalesce((params->>'fine')::numeric, 0) not between 0 and 1000000 or coalesce((params->>'months')::numeric, 0) not between 0 and 480 then raise exception 'Multa o pena fuera de rango'; end if;
    insert into penal_code(code, title, kind, fine, years, notes) values(params->>'code', params->>'title', coalesce(nullif(params->>'kind',''), 'delito'),
      coalesce((params->>'fine')::numeric, 0), coalesce((params->>'months')::numeric, 0) / 12, 'Ley ' || title);
  elsif effect <> 'ninguno' then raise exception 'Efecto desconocido'; end if;
  insert into laws(title, body, effect, params, prev, author, author_office) values(trim(title), trim(body), effect, params, prev, c, office) returning number into n;
  insert into posts(app, section, character_id, anonimo, title, body) values('news', 'Gobierno', null, true,
    'Entra en vigor la Ley ' || n || ': ' || trim(title), 'El ' || lower(office) || ' ' || coalesce(nm, '') || ' promulgó la Ley ' || n || '. ' || trim(body));
  return n;
end $$;
