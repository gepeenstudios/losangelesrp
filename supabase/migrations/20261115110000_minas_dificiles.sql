-- Minas más difíciles: con pocas minas la casa se queda con más (pagas poco), con muchas minas el pago se acerca al justo (pagas mucho).
-- Ventaja de la casa: 1 mina ≈ 7.7%, 5 minas ≈ 6.5%, 10 minas ≈ 5%, 24 minas ≈ 0.8%.
create or replace function mines_mult(n int, k int) returns numeric language sql immutable as $$
  select round((0.92 + 0.003 * n) * coalesce(exp(sum(ln((25 - i)::numeric / (25 - n - i)))), 1), 4) from generate_series(0, k - 1) i $$;
