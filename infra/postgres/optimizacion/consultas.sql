-- Consultas de referencia del punto 5.
--
-- Son las siete consultas que la aplicacion corre de verdad, copiadas de lo
-- que Sequelize genera en los controladores. El archivo se corre igual antes
-- y despues de crear los indices, para que los numeros sean comparables:
--
--   docker exec -i restoya_db psql -U restoya -d restoyadb -f - < consultas.sql
--
-- Cada consulta esta envuelta en EXPLAIN (ANALYZE, BUFFERS) porque el tiempo
-- solo no dice nada: lo que explica el tiempo es el plan y los bloques leidos.

\timing on
\pset pager off

-- ---------------------------------------------------------------------------
-- Q1 - Pantalla de cocina.
-- GET /api/pedidos/cocina, en pedido.controller.js.
-- Filtra por estado y se une a detalle_pedidos y productos.
-- ---------------------------------------------------------------------------
\echo '===== Q1 cocina: pedidos PENDIENTE/EN_COCINA con sus detalles ====='
EXPLAIN (ANALYZE, BUFFERS)
SELECT p."idPedido", p.estado, p."fechaCreacion", p.total,
       d."idDetalle", d.cantidad, pr.nombre
FROM pedidos p
JOIN detalle_pedidos d ON d."idPedido" = p."idPedido"
JOIN productos pr ON pr."idProducto" = d."idProducto"
WHERE p.estado IN ('PENDIENTE', 'EN_COCINA')
  AND pr.categoria IN ('plato_principal', 'postre')
ORDER BY p."fechaCreacion" ASC
LIMIT 200;

-- ---------------------------------------------------------------------------
-- Q2 - Detalle de un pedido concreto.
-- Lo usa cada vez que se abre un pedido en la caja o en la cocina.
-- Es la consulta mas frecuente de toda la aplicacion.
-- ---------------------------------------------------------------------------
\echo '===== Q2 detalle de un pedido ====='
EXPLAIN (ANALYZE, BUFFERS)
SELECT d.*, pr.nombre
FROM detalle_pedidos d
JOIN productos pr ON pr."idProducto" = d."idProducto"
WHERE d."idPedido" = 3000000;

-- ---------------------------------------------------------------------------
-- Q3 - Pagos de una caja.
-- reporte.controller.js la corre dos veces por reporte, una para el PDF y
-- otra para el Excel.
-- ---------------------------------------------------------------------------
\echo '===== Q3 pagos de una caja ====='
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM pagos WHERE "idCaja" = 2500;

-- ---------------------------------------------------------------------------
-- Q4 - Ticket promedio del dashboard.
-- dashboard.controller.js la trae cruda y promedia en JavaScript. Aca va
-- calculada en la base, que es como deberia estar.
-- ---------------------------------------------------------------------------
\echo '===== Q4 ticket promedio (estado PAGADO) ====='
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) AS cantidad, avg(total) AS ticket_promedio, sum(total) AS total
FROM pedidos
WHERE estado = 'PAGADO';

-- ---------------------------------------------------------------------------
-- Q5 - Ventas por dia de los ultimos 30 dias.
-- GET /api/dashboard/ventas-por-dia
-- ---------------------------------------------------------------------------
\echo '===== Q5 ventas por dia, ultimos 30 dias ====='
EXPLAIN (ANALYZE, BUFFERS)
SELECT date("fechaPago") AS fecha, sum(monto) AS total
FROM pagos
WHERE "fechaPago" >= now() - interval '30 days'
GROUP BY date("fechaPago")
ORDER BY fecha ASC;

-- ---------------------------------------------------------------------------
-- Q6 - Productos mas vendidos.
-- GET /api/dashboard/productos-mas-vendidos
-- Agrega las seis millones de lineas de detalle. No hay indice que la salve:
-- el interes aca es ver si se puede paralelizar.
-- ---------------------------------------------------------------------------
\echo '===== Q6 productos mas vendidos ====='
EXPLAIN (ANALYZE, BUFFERS)
SELECT d."idProducto", pr.nombre, sum(d.cantidad) AS total_vendido
FROM detalle_pedidos d
JOIN productos pr ON pr."idProducto" = d."idProducto"
GROUP BY d."idProducto", pr.nombre
ORDER BY total_vendido DESC
LIMIT 10;

-- ---------------------------------------------------------------------------
-- Q7 - Historial de accesos.
-- GET /api/historial. Los cien mas recientes con el usuario que los hizo.
-- ---------------------------------------------------------------------------
\echo '===== Q7 historial de accesos, ultimos 100 ====='
EXPLAIN (ANALYZE, BUFFERS)
SELECT h.*, u.nombre, u.apellido, u.email
FROM historial_accesos h
LEFT JOIN usuarios u ON u."usuarioId" = h."usuarioId"
ORDER BY h."fechaHora" DESC
LIMIT 100;

-- ---------------------------------------------------------------------------
-- Q8 - Inicio de sesion.
-- login.controller.js busca al usuario por correo. Es la consulta mas
-- frecuente de todo el sistema y la columna no tenia indice.
-- ---------------------------------------------------------------------------
\echo '===== Q8 inicio de sesion: usuario por correo ====='
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM usuarios WHERE email = 'usuario500000@ejemplo.test';

-- ---------------------------------------------------------------------------
-- Q9 y Q10 - La misma pregunta escrita de dos formas (E5-05).
--
-- Q9 aplica date() sobre la columna del WHERE. Eso la hace no SARGable: el
-- indice sobre "fechaCreacion" no se puede usar, porque el indice guarda el
-- valor de la columna, no el resultado de la funcion.
--
-- Q10 pregunta lo mismo como un rango, y si puede usar el indice.
-- ---------------------------------------------------------------------------
\echo '===== Q9 no SARGable: date(columna) = valor ====='
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM pedidos WHERE date("fechaCreacion") = date(now() - interval '400 days');

\echo '===== Q10 la misma, como rango ====='
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM pedidos
WHERE "fechaCreacion" >= date(now() - interval '400 days')
  AND "fechaCreacion" <  date(now() - interval '399 days');
