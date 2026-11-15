-- Buscados que ya tenían orden antes del cambio: también se les abre su cuenta encriptada
insert into accounts(kind, name, owners)
select distinct 'encrypted', 'Cuenta encriptada 🔐', array[r.character_id] from records r
 where r.kind = 'orden' and not r.paid and not exists(select 1 from accounts a where a.kind = 'encrypted' and a.owners = array[r.character_id]);
