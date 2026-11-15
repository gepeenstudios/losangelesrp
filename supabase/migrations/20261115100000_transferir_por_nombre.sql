-- Transferir escribiendo el nombre de la persona (además del número de cuenta).
create or replace function account_by_name(q text) returns table(number text, holder text) language sql stable security definer set search_path=public as $$
  select a.number, c.first_name || ' ' || c.last_name from characters c join accounts a on a.id = personal_acc(c.id)
  where c.status = 'active' and lower(c.first_name || ' ' || c.last_name) like '%' || lower(trim(q)) || '%' order by c.first_name limit 5 $$;
