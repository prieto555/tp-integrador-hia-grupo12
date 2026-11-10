-- Las mismas siete consultas de consultas.sql, sin EXPLAIN, separadas por un
-- marcador "-- @@ <nombre>" para que medir.sh pueda cortarlas y cronometrar
-- cada una por separado. Mantener los dos archivos en sincronia.

-- @@ Q1 cocina: pedidos PENDIENTE/EN_COCINA con sus detalles
SELECT p."idPedido", p.estado, p."fechaCreacion", p.total,
       d."idDetalle", d.cantidad, pr.nombre
FROM pedidos p
JOIN detalle_pedidos d ON d."idPedido" = p."idPedido"
JOIN productos pr ON pr."idProducto" = d."idProducto"
WHERE p.estado IN ('PENDIENTE', 'EN_COCINA')
  AND pr.categoria IN ('plato_principal', 'postre')
ORDER BY p."fechaCreacion" ASC
LIMIT 200;

-- @@ Q2 detalle de un pedido
SELECT d.*, pr.nombre
FROM detalle_pedidos d
JOIN productos pr ON pr."idProducto" = d."idProducto"
WHERE d."idPedido" = 3000000;

-- @@ Q3 pagos de una caja
SELECT * FROM pagos WHERE "idCaja" = 2500;

-- @@ Q4 ticket promedio (estado PAGADO)
SELECT count(*) AS cantidad, avg(total) AS ticket_promedio, sum(total) AS total
FROM pedidos
WHERE estado = 'PAGADO';

-- @@ Q5 ventas por dia, ultimos 30 dias
SELECT date("fechaPago") AS fecha, sum(monto) AS total
FROM pagos
WHERE "fechaPago" >= now() - interval '30 days'
GROUP BY date("fechaPago")
ORDER BY fecha ASC;

-- @@ Q6 productos mas vendidos
SELECT d."idProducto", pr.nombre, sum(d.cantidad) AS total_vendido
FROM detalle_pedidos d
JOIN productos pr ON pr."idProducto" = d."idProducto"
GROUP BY d."idProducto", pr.nombre
ORDER BY total_vendido DESC
LIMIT 10;

-- @@ Q7 historial de accesos, ultimos 100
SELECT h.*, u.nombre, u.apellido, u.email
FROM historial_accesos h
LEFT JOIN usuarios u ON u."usuarioId" = h."usuarioId"
ORDER BY h."fechaHora" DESC
LIMIT 100;

-- @@ Q8 inicio de sesion: usuario por correo
SELECT * FROM usuarios WHERE email = 'usuario500000@ejemplo.test';

-- @@ Q9 no SARGable: pedidos de un dia con funcion sobre la columna
SELECT count(*) FROM pedidos WHERE date("fechaCreacion") = date(now() - interval '400 days');

-- @@ Q10 la misma de Q9, escrita como rango (SARGable)
SELECT count(*) FROM pedidos
WHERE "fechaCreacion" >= date(now() - interval '400 days')
  AND "fechaCreacion" <  date(now() - interval '399 days');
