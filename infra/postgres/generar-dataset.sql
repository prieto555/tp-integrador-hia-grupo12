-- Generador del conjunto de datos de prueba. Entregable del punto 4.
--
-- Uso:
--   psql -v filas=6000000 -f generar-dataset.sql
--   psql -v filas=10000   -f generar-dataset.sql   (prueba rapida)
--
-- Genera datos sinteticos en las cinco tablas que forman el conjunto de
-- prueba, respetando las claves foraneas. Las tablas de catalogo
-- (productos, mesas, roles, funciones) quedan como estan: poner seis
-- millones de mesas no tendria sentido.
--
-- Los datos NO son uniformes a proposito. Si todos los pedidos tuvieran la
-- misma fecha y el mismo estado, los planes de ejecucion del punto 5 serian
-- irreales: el planificador elige segun selectividad, y con datos planos
-- cualquier indice parece igual de bueno. Acá hay sesgo deliberado:
--   - las fechas se concentran en los meses recientes
--   - los estados siguen una distribucion parecida a la real
--   - el 70% de los pedidos son LOCAL y el 30% DELIVERY

\set ON_ERROR_STOP on

\echo '=============================================='
\echo 'Generando dataset'
\echo '=============================================='

-- synchronous_commit off acelera mucho la carga masiva. Si el servidor se
-- cae a mitad se pierden las ultimas transacciones, lo que para un dataset
-- regenerable es aceptable. Es de sesion: no afecta a nadie mas.
SET synchronous_commit = off;
SET maintenance_work_mem = '512MB';

\timing on

-- ---------------------------------------------------------------------
-- Cajas: el catalogo de turnos. Pocas, pero necesarias para los pagos.
-- ---------------------------------------------------------------------
\echo '--- cajas ---'
INSERT INTO cajas ("idCaja", "montoInicial", "montoFinal", estado, "fechaApertura", "fechaCierre")
SELECT
    i,
    10000,
    10000 + (random() * 500000)::numeric(12,2),
    CASE WHEN i % 500 = 0 THEN 'ABIERTA' ELSE 'CERRADA' END::enum_cajas_estado,
    now() - (i || ' hours')::interval,
    now() - (i || ' hours')::interval + interval '8 hours'
FROM generate_series(1, 5000) AS i
ON CONFLICT ("idCaja") DO NOTHING;

-- ---------------------------------------------------------------------
-- Usuarios. Arranca despues del maximo existente para no pisar al admin.
-- El correo es unico por construccion.
-- ---------------------------------------------------------------------
\echo '--- usuarios ---'
INSERT INTO usuarios ("usuarioId", apellido, nombre, dni, email, password, "createdAt", "updatedAt")
SELECT
    base + i,
    'Apellido' || (i % 9000),
    'Nombre' || (i % 4500),
    (20000000 + i)::text,
    'usuario' || (base + i) || '@ejemplo.test',
    -- Hash bcrypt de una clave de prueba. Todos comparten el mismo: generar
    -- seis millones de hashes reales tardaria horas y no aporta nada.
    '$2b$10$N9qo8uLOickgx2ZMRZoMye1VdLLQ0rCGvKMyaCFH0pRXBHPbkT3pS',
    now() - ((i % 1095) || ' days')::interval,
    now() - ((i % 1095) || ' days')::interval
FROM generate_series(1, :filas) AS i,
     LATERAL (SELECT COALESCE(MAX("usuarioId"), 0) AS base FROM usuarios) AS m;

SELECT setval(pg_get_serial_sequence('usuarios', 'usuarioId'), (SELECT MAX("usuarioId") FROM usuarios));

-- ---------------------------------------------------------------------
-- Pedidos. Fechas sesgadas hacia lo reciente: i^1.6 concentra la mayoria
-- de los pedidos en los ultimos meses.
-- ---------------------------------------------------------------------
\echo '--- pedidos ---'
INSERT INTO pedidos ("idPedido", estado, "tipoPedido", "fechaCreacion", total, "idMesa", "usuarioId")
SELECT
    i,
    (ARRAY['PAGADO','PAGADO','PAGADO','ENTREGADO','ENTREGADO','LISTO_PARA_ENTREGA','EN_COCINA','PENDIENTE','CANCELADO']
        )[1 + (i * 7 % 9)]::enum_pedidos_estado,
    CASE WHEN i % 10 < 7 THEN 'LOCAL' ELSE 'DELIVERY' END::"enum_pedidos_tipoPedido",
    now() - (power((i % 100000)::numeric / 100000, 1.6) * 1095 || ' days')::interval,
    (3000 + (i % 47) * 950)::double precision,
    CASE WHEN i % 10 < 7 THEN 1 + (i % 7) ELSE NULL END,
    1 + (i % GREATEST((SELECT COUNT(*) FROM usuarios)::int, 1))
FROM generate_series(1, :filas) AS i;

SELECT setval(pg_get_serial_sequence('pedidos', 'idPedido'), (SELECT MAX("idPedido") FROM pedidos));

-- ---------------------------------------------------------------------
-- Detalle de pedidos. Uno por pedido para mantener la relacion 1:N simple
-- y llegar al volumen pedido.
-- ---------------------------------------------------------------------
\echo '--- detalle_pedidos ---'
INSERT INTO detalle_pedidos ("idDetalle", cantidad, "precioUnitario", "subTotal", "idPedido", "idProducto")
SELECT
    i,
    1 + (i % 4),
    p.precio,
    (1 + (i % 4)) * p.precio,
    i,
    p."idProducto"
FROM generate_series(1, :filas) AS i
-- El catalogo se numera una sola vez y se une por modulo. La version con
-- CROSS JOIN LATERAL ... OFFSET era legible pero recorria la tabla de
-- productos una vez por fila: a seis millones, inviable.
JOIN (
    SELECT
        row_number() OVER (ORDER BY "idProducto") - 1 AS n,
        count(*) OVER ()                             AS total,
        "idProducto",
        precio
    FROM productos
) AS p ON p.n = i % p.total;

SELECT setval(pg_get_serial_sequence('detalle_pedidos', 'idDetalle'), (SELECT MAX("idDetalle") FROM detalle_pedidos));

-- ---------------------------------------------------------------------
-- Pagos. MERCADOPAGO y EFECTIVO son mayoria, como en el negocio real.
-- ---------------------------------------------------------------------
\echo '--- pagos ---'
INSERT INTO pagos ("idPago", "metodoPago", monto, "referenciaExterna", "fechaPago", "idPedido", "idCaja")
SELECT
    i,
    (ARRAY['EFECTIVO','EFECTIVO','MERCADOPAGO','MERCADOPAGO','MERCADOPAGO','TARJETA','TRANSFERENCIA']
        )[1 + (i * 3 % 7)]::"enum_pagos_metodoPago",
    (3000 + (i % 47) * 950)::double precision,
    CASE WHEN i % 3 = 0 THEN 'MP-' || lpad(i::text, 12, '0') ELSE NULL END,
    now() - (power((i % 100000)::numeric / 100000, 1.6) * 1095 || ' days')::interval,
    i,
    1 + (i % 5000)
FROM generate_series(1, :filas) AS i;

SELECT setval(pg_get_serial_sequence('pagos', 'idPago'), (SELECT MAX("idPago") FROM pagos));

-- ---------------------------------------------------------------------
-- Historial de accesos. La tabla que mas crece en produccion: una fila por
-- inicio de sesion.
-- ---------------------------------------------------------------------
\echo '--- historial_accesos ---'
INSERT INTO historial_accesos ("idHistorial", metodo, "fechaHora", ip, "usuarioId")
SELECT
    i,
    CASE WHEN i % 4 = 0 THEN 'GOOGLE' ELSE 'EMAIL' END,
    now() - (power((i % 100000)::numeric / 100000, 1.6) * 1095 || ' days')::interval,
    '192.168.' || (i % 256) || '.' || ((i * 7) % 256),
    1 + (i % GREATEST((SELECT COUNT(*) FROM usuarios)::int, 1))
FROM generate_series(1, :filas) AS i;

SELECT setval(pg_get_serial_sequence('historial_accesos', 'idHistorial'), (SELECT MAX("idHistorial") FROM historial_accesos));

-- ---------------------------------------------------------------------
-- Estadisticas. Sin esto el planificador trabaja con numeros viejos y los
-- EXPLAIN del punto 5 no valen nada.
-- ---------------------------------------------------------------------
\echo '--- ANALYZE ---'
ANALYZE usuarios;
ANALYZE pedidos;
ANALYZE detalle_pedidos;
ANALYZE pagos;
ANALYZE historial_accesos;
ANALYZE cajas;

\timing off

\echo '=============================================='
\echo 'Resumen'
\echo '=============================================='
SELECT
    relname AS tabla,
    to_char(n_live_tup, 'FM999,999,999') AS filas,
    pg_size_pretty(pg_total_relation_size(relid)) AS tamanio
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_live_tup DESC;

SELECT pg_size_pretty(pg_database_size(current_database())) AS "tamanio total de la base";
