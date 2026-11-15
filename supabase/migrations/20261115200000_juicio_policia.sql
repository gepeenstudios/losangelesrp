-- La policía manda a juicio a otro personaje: el request es del acusado, no del oficial.
drop policy if exists r_ins on requests;
create policy r_ins on requests for insert to authenticated with check (owns_char(character_id) or (type = 'juicio' and is_police()));
