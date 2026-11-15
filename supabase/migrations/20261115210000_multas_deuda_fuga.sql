-- Multas y multas de arresto: se cobra lo que haya en la cuenta personal; el resto queda como deuda (saldo negativo a la vista)
-- y se cobra solo en cuanto le entre dinero. La Tesorería solo recibe lo que de verdad se cobra.
alter table records add column if not exists collected numeric default 0;

create or replace function collect_fines(c uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r records; acc uuid := personal_acc(c); have numeric; take numeric;
begin
  if acc is null then return; end if;
  for r in select * from records where character_id = c and kind in ('multa','arresto') and not paid and coalesce(amount,0) > 0 order by created_at for update loop
    select balance into have from accounts where id = acc;
    take := least(have, r.amount - coalesce(r.collected,0));
    if take > 0 then perform move_money(acc, gov_acc(), take, 'Multa: ' || left(coalesce(r.description,''), 60)); end if;
    update records set collected = coalesce(collected,0) + greatest(take,0), paid = coalesce(collected,0) + greatest(take,0) >= amount where id = r.id;
    exit when have - greatest(take,0) <= 0;
  end loop;
end $$;

create or replace function fines_on_record() returns trigger language plpgsql security definer set search_path=public as $$
begin perform collect_fines(new.character_id); return new; end $$;
drop trigger if exists records_collect on records;
create trigger records_collect after insert on records for each row when (new.kind in ('multa','arresto') and coalesce(new.amount,0) > 0) execute function fines_on_record();

create or replace function fines_on_deposit() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from records where character_id = new.owners[1] and kind in ('multa','arresto') and not paid and coalesce(amount,0) > 0) then
    perform collect_fines(new.owners[1]); end if;
  return new;
end $$;
drop trigger if exists accounts_collect on accounts;
create trigger accounts_collect after update of balance on accounts for each row when (new.kind = 'personal' and new.balance > old.balance) execute function fines_on_deposit();

-- pagar a mano (también multas de arresto): cobra lo que alcance de la cuenta elegida
create or replace function pay_fine(record uuid, acc uuid) returns void
language plpgsql security definer set search_path=public as $$
declare r records; have numeric; take numeric;
begin
  select * into r from records where id=record and kind in ('multa','arresto') and not paid for update;
  if not found or not owns_char(r.character_id) then raise exception 'Multa no válida'; end if;
  if not owns_acc(acc) then raise exception 'No es tu cuenta'; end if;
  select balance into have from accounts where id = acc;
  take := least(have, r.amount - coalesce(r.collected,0));
  if take <= 0 then raise exception 'No tienes saldo en esa cuenta'; end if;
  perform move_money(acc, gov_acc(), take, 'Multa');
  update records set collected = coalesce(collected,0) + take, paid = coalesce(collected,0) + take >= amount where id=record;
end $$;

insert into penal_code(code, title, kind, fine, years, lic, notes) values
  ('Art. 89', 'Intento de evasión de prisión', 'grave', 50000, 2.0, false, 'Se suma a la condena que ya cumple'),
  ('Art. 90', 'Evasión de prisión (fuga consumada)', 'grave', 120000, 5.0, false, 'Se suma a la condena que ya cumple'),
  ('Art. 91', 'Ayudar a un preso a escapar', 'grave', 100000, 4.0, false, null)
on conflict (code) do nothing;
