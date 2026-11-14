-- Cada casa es una unidad con su ubicación; precios lógicos (el remolque es más grande que las casas de bajos ingresos)
alter table properties add column if not exists location text;
update properties set price = v.p from (values
  ('Casa de bajos ingresos (más pequeña)',18000),('Casa de bajos ingresos',22000),('Casa de bajos ingresos (con garaje)',26000),
  ('Casa de bajos ingresos (mejores vistas)',30000),('Remolque individual',38000),('Remolque doble',52000)) v(n,p)
where properties.name = v.n and properties.owner_char is null and properties.owner_company is null;
