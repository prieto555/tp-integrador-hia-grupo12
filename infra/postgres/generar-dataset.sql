-- Generador del conjunto de datos de prueba. Entregable del punto 4.
--
-- Uso:
--   psql -v filas=6000000 -f generar-dataset.sql
--   psql -v filas=10000   -f generar-dataset.sql   (prueba rapida)
--
-- Volumenes (v3):
--   filas            pedidos, detalle_pedidos y pagos (las tablas del
--                    movimiento diario, donde 6M tiene sentido)
--   filas_usuarios   usuarios            (por defecto 10000)
--   filas_historial  historial_accesos   (por defecto 50000)
--   Ejemplo: psql -v filas=6000000 -v filas_usuarios=10000 -v filas_historial=50000 -f ...
--
-- POR QUE NO TODO VALE 6 MILLONES. La primera version usaba :filas para las
-- cinco tablas, asi que generaba seis millones de USUARIOS y seis millones de
-- inicios de sesion. Un restaurante con seis millones de empleados no existe,
-- y un dato que no puede existir tampoco sirve para medir: el planificador
-- elige segun selectividad, y una tabla de usuarios absurda distorsiona
-- cualquier JOIN contra ella.
--
-- Las tres que si llegan a seis millones son las del movimiento diario
-- -pedidos, sus detalles y sus pagos-, que es donde el volumen tiene sentido
-- y donde se miden las consultas del punto 5.
--
-- Genera datos sinteticos respetando las claves foraneas. Las tablas de
-- catalogo (productos, mesas, roles, funciones) quedan como estan: poner seis
-- millones de mesas no tendria sentido.
--
-- Los datos NO son uniformes a proposito. Si todos los pedidos tuvieran la
-- misma fecha y el mismo estado, los planes de ejecucion del punto 5 serian
-- irreales: el planificador elige segun selectividad, y con datos planos
-- cualquier indice parece igual de bueno. Aca hay sesgo deliberado:
--   - las fechas se concentran en los meses recientes
--   - los estados siguen una distribucion parecida a la real
--   - el 70% de los pedidos son LOCAL y el 30% DELIVERY
--
-- TODOS LOS USUARIOS GENERADOS COMPARTEN LA CLAVE "1234" y tienen un rol
-- asignado. Es un entorno de laboratorio que se levanta para demostrar y se
-- borra: una clave distinta por usuario no aportaria nada y haria imposible
-- entrar a probar una pantalla. Las cuentas del equipo no salen de aca, las
-- crea el seed.

\set ON_ERROR_STOP on

\if :{?filas_usuarios}
\else
  \set filas_usuarios 10000
\endif
\if :{?filas_historial}
\else
  \set filas_historial 50000
\endif

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
    -- Hash bcrypt de "1234", la misma para todos. Generar miles de hashes
    -- distintos tardaria y no aporta nada; y que sea una clave tipeable
    -- permite entrar con cualquiera de estas cuentas a probar una pantalla.
    '$2b$10$tyDwYjmJQIfFaPStSZXQ4uLe7LxV.sCZivLiII2dFiAsqgUEhiWlO',
    now() - ((i % 1095) || ' days')::interval,
    now() - ((i % 1095) || ' days')::interval
FROM generate_series(1, :filas_usuarios) AS i,
     LATERAL (SELECT COALESCE(MAX("usuarioId"), 0) AS base FROM usuarios) AS m;

SELECT setval(pg_get_serial_sequence('usuarios', 'usuarioId'), (SELECT MAX("usuarioId") FROM usuarios));

-- ---------------------------------------------------------------------
-- Roles de esos usuarios.
--
-- Sin esto, la pantalla de usuarios del frente los muestra con la columna de
-- rol vacia: el rol no esta en la tabla de usuarios, esta en usuario_roles.
--
-- El reparto imita la planta de un restaurante y no es parejo a proposito:
-- hay muchos mas mozos que gerentes. Los ids de los roles se buscan POR
-- NOMBRE y no se escriben a mano, porque los crea el seed y su numeracion
-- depende del orden en que se corrio.
-- ---------------------------------------------------------------------
\echo '--- usuario_roles ---'
INSERT INTO usuario_roles ("rolId", "usuarioId", "createdAt", "updatedAt")
SELECT
    r."rolId",
    u."usuarioId",
    now(),
    now()
FROM usuarios AS u
CROSS JOIN LATERAL (
    SELECT CASE
        WHEN u."usuarioId" % 20 < 9  THEN 'Mozo'     -- 45%
        WHEN u."usuarioId" % 20 < 14 THEN 'Cocina'   -- 25%
        WHEN u."usuarioId" % 20 < 18 THEN 'Cajero'   -- 20%
        ELSE 'Gerente'                               -- 10%
    END AS nombre
) AS elegido
JOIN roles AS r ON r.nombre = elegido.nombre
-- Solo las cuentas generadas aca. Sin este filtro, al admin y a las del equipo
-- -que el seed ya dejo como Gerente- se les agregaba ADEMAS un rol al azar, y
-- la pantalla de usuarios mostraba "Gerente, Mozo".
WHERE u.email LIKE '%@ejemplo.test'
ON CONFLICT ("rolId", "usuarioId") DO NOTHING;

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
FROM generate_series(1, :filas_historial) AS i;

SELECT setval(pg_get_serial_sequence('historial_accesos', 'idHistorial'), (SELECT MAX("idHistorial") FROM historial_accesos));

-- ---------------------------------------------------------------------
-- Estadisticas. Sin esto el planificador trabaja con numeros viejos y los
-- EXPLAIN del punto 5 no valen nada.
-- ---------------------------------------------------------------------
\echo '--- ANALYZE ---'
ANALYZE usuarios;
ANALYZE usuario_roles;
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

\echo '--- usuarios por rol ---'
SELECT
    r.nombre AS rol,
    to_char(count(*), 'FM999,999,999') AS usuarios
FROM usuario_roles AS ur
JOIN roles AS r ON r."rolId" = ur."rolId"
GROUP BY r.nombre
ORDER BY count(*) DESC;

SELECT pg_size_pretty(pg_database_size(current_database())) AS "tamanio total de la base";
