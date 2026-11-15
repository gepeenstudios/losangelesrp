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
