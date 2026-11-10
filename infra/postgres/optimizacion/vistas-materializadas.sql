-- Vistas materializadas del punto 5 (E5-07).
--
-- Despues de crear los indices, las cuatro consultas mas caras que quedaron
-- en pg_stat_statements son las cuatro del dashboard:
--
--   productos mas vendidos        581 ms
--   ventas por metodo de pago     553 ms
--   ticket promedio               207 ms
--   ventas por dia                136 ms
--
-- Ninguna se arregla con un indice, y no es una falla del indice: las cuatro
-- agregan la tabla entera. No hay nada que buscar, hay que leer todo. Un
-- indice acelera encontrar filas; estas consultas ya saben que las quieren
-- todas.
--
-- La respuesta para un panel de control es no recalcular lo mismo en cada
-- visita. Se calcula una vez, se guarda, y se vuelve a calcular cada tanto.
--
-- EL COSTO ES QUE LOS NUMEROS QUEDAN VIEJOS. Por eso solo se materializa lo
-- historico, donde cinco minutos de atraso no cambian ninguna decision:
--
--   - productos mas vendidos      -> materializado
--   - ventas por metodo de pago   -> materializado
--   - ventas de HOY y pedidos de HOY (dashboard/resumen) -> siguen en vivo.
--     Son las que mira el encargado para decidir ahora; ahi el atraso si
--     importa y la consulta ya es barata porque filtra por fecha.
--
--   docker exec -i restoya_db psql -U restoya -d restoyadb -f - < vistas-materializadas.sql

\timing on

-- ---------------------------------------------------------------------------
-- Productos mas vendidos.
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_ventas_por_producto;

CREATE MATERIALIZED VIEW mv_ventas_por_producto AS
SELECT d."idProducto",
       pr.nombre,
       sum(d.cantidad)   AS unidades,
       sum(d."subTotal") AS importe
FROM detalle_pedidos d
JOIN productos pr ON pr."idProducto" = d."idProducto"
GROUP BY d."idProducto", pr.nombre
WITH DATA;

-- El indice UNICO es obligatorio para poder refrescar CONCURRENTLY, que es lo
-- que evita que el dashboard quede sin datos mientras se recalcula.
CREATE UNIQUE INDEX mv_ventas_por_producto_pk
    ON mv_ventas_por_producto ("idProducto");

-- ---------------------------------------------------------------------------
-- Ventas por metodo de pago.
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_ventas_por_metodo;

CREATE MATERIALIZED VIEW mv_ventas_por_metodo AS
SELECT "metodoPago",
       count(*)    AS cantidad,
       sum(monto)  AS total
FROM pagos
GROUP BY "metodoPago"
WITH DATA;

CREATE UNIQUE INDEX mv_ventas_por_metodo_pk
    ON mv_ventas_por_metodo ("metodoPago");

-- ---------------------------------------------------------------------------
-- Ventas por dia.
--
-- Esta se materializa completa y la aplicacion le pide el rango que quiera.
-- Son unos mil doscientos dias: la vista entera entra en una pagina.
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_ventas_por_dia;

CREATE MATERIALIZED VIEW mv_ventas_por_dia AS
SELECT date("fechaPago") AS fecha,
       count(*)          AS cantidad,
       sum(monto)        AS total
FROM pagos
WHERE "fechaPago" IS NOT NULL
GROUP BY date("fechaPago")
WITH DATA;

CREATE UNIQUE INDEX mv_ventas_por_dia_pk
    ON mv_ventas_por_dia (fecha);

-- ---------------------------------------------------------------------------
-- Ticket promedio historico.
--
-- Es el ultimo numero del dashboard que seguia recorriendo la tabla: dos
-- millones de pedidos PAGADO para devolver un promedio, 171 ms. Es historico
-- por definicion (todos los pedidos pagados de siempre), asi que entra en la
-- misma regla que las vistas de arriba.
--
-- Las otras tres cifras del resumen -- ventas de hoy, pedidos de hoy y mesas
-- ocupadas -- NO se materializan: son las que mira el encargado para decidir
-- en el momento, y son baratas porque filtran por fecha o por estado sobre
-- una tabla chica.
--
-- La vista tiene una sola fila. La columna id existe solo para poder crear el
-- indice unico que exige REFRESH CONCURRENTLY.
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_resumen_historico;

CREATE MATERIALIZED VIEW mv_resumen_historico AS
SELECT 1                AS id,
       count(*)         AS pedidos_pagados,
       avg(total)       AS ticket_promedio,
       sum(total)       AS total_historico
FROM pedidos
WHERE estado = 'PAGADO'
WITH DATA;

CREATE UNIQUE INDEX mv_resumen_historico_pk ON mv_resumen_historico (id);

-- ---------------------------------------------------------------------------
-- Refresco.
--
-- CONCURRENTLY no bloquea las lecturas: el dashboard sigue respondiendo con
-- los datos viejos mientras se recalculan los nuevos. A cambio tarda mas y
-- exige el indice unico de arriba.
--
-- Queda como funcion para que algo la llame cada tanto. Las opciones son
-- pg_cron (otra extension que instalar) o un flujo de n8n, que ya esta en el
-- trabajo por el punto 13. Es n8n: no agrega nada al stack.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refrescar_vistas_dashboard()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    inicio timestamptz := clock_timestamp();
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ventas_por_producto;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ventas_por_metodo;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ventas_por_dia;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_resumen_historico;
    RETURN 'vistas del dashboard refrescadas en ' ||
           round(extract(epoch FROM clock_timestamp() - inicio)::numeric, 2) || ' s';
END $$;

ANALYZE mv_ventas_por_producto;
ANALYZE mv_ventas_por_metodo;
ANALYZE mv_ventas_por_dia;
ANALYZE mv_resumen_historico;
