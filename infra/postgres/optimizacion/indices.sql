-- Indices del punto 5.
--
-- Cada uno responde a una consulta medida en consultas.sql, y los numeros
-- estan en docs/07-optimizacion-sql.md. No hay ningun indice "por si acaso":
-- un indice que nadie usa se paga igual en cada INSERT, UPDATE y DELETE.
--
--   docker exec -i restoya_db psql -U restoya -d restoyadb -f - < indices.sql
--
-- Se usa CONCURRENTLY para no bloquear escrituras mientras se construyen, que
-- sobre tablas de seis millones de filas tarda decenas de segundos. Eso obliga
-- a que cada sentencia vaya fuera de una transaccion, por lo que este archivo
-- no puede envolverse en BEGIN/COMMIT.

\timing on

-- ---------------------------------------------------------------------------
-- 1. Claves foraneas sin indice.
--
-- PostgreSQL indexa automaticamente el lado referenciado (la clave primaria),
-- nunca el lado que referencia. Las once claves foraneas del esquema estaban
-- todas sin indice, asi que cada vez que la aplicacion buscaba "los detalles
-- del pedido 3000000" recorria los seis millones de filas.
--
-- Ademas todas estan declaradas ON DELETE SET NULL: sin indice, borrar un
-- pedido recorre detalle_pedidos y pagos completos.
-- ---------------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS detalle_pedidos_id_pedido
    ON detalle_pedidos ("idPedido");

CREATE INDEX CONCURRENTLY IF NOT EXISTS pagos_id_pedido
    ON pagos ("idPedido");

CREATE INDEX CONCURRENTLY IF NOT EXISTS pagos_id_caja
    ON pagos ("idCaja");

CREATE INDEX CONCURRENTLY IF NOT EXISTS pedidos_usuario_id
    ON pedidos ("usuarioId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS pedidos_id_mesa
    ON pedidos ("idMesa");

CREATE INDEX CONCURRENTLY IF NOT EXISTS historial_accesos_usuario_id
    ON historial_accesos ("usuarioId");

-- detalle_pedidos."idProducto" queda A PROPOSITO sin indice.
-- Tiene cuatro valores distintos sobre seis millones de filas: cualquier
-- busqueda por producto devuelve un millon y medio de filas, y el planificador
-- va a preferir recorrer la tabla. El unico uso seria la verificacion de la
-- clave foranea al borrar un producto, que con ON DELETE SET NULL tiene que
-- escribir ese millon y medio de filas de todos modos.
-- Indexarlo costaria ~129 MB y una escritura extra por cada linea de pedido,
-- para no acelerar nada.

-- ---------------------------------------------------------------------------
-- 2. Indice parcial para la pantalla de cocina.
--
-- La cocina pide los pedidos PENDIENTE o EN_COCINA ordenados por fecha. Eso es
-- el 22% de la tabla, pero el 100% de las consultas de esa pantalla.
--
-- El indice guarda solo esas filas y las guarda YA ORDENADAS por fecha, asi
-- que el planificador puede caminarlo y cortar al llegar al limite, sin
-- ordenar seis millones de filas para devolver doscientas.
-- ---------------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS pedidos_cocina
    ON pedidos ("fechaCreacion")
    WHERE estado IN ('PENDIENTE', 'EN_COCINA');

-- ---------------------------------------------------------------------------
-- 3. Fechas.
--
-- El dashboard filtra pagos y pedidos por fecha. Se probo BRIN primero, que
-- para datos temporales suele ser la respuesta correcta y ocupa unos kilobytes
-- en lugar de 128 MB. No sirvio: la correlacion de "fechaPago" con el orden
-- fisico de la tabla es -0.01, practicamente cero, porque el generador de
-- datos reparte las fechas en abanico y no en orden.
--
-- Queda btree, y con la advertencia de que para rangos anchos (treinta dias,
-- que son el 10% de la tabla) el planificador lo va a ignorar y va a recorrer
-- la tabla. Eso no es un error suyo: leer 600.000 filas salteadas por el
-- indice cuesta mas que leer la tabla de corrido. El indice sirve para los
-- rangos angostos, que son los que usa la pantalla del dia.
-- ---------------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS pagos_fecha_pago
    ON pagos ("fechaPago");

CREATE INDEX CONCURRENTLY IF NOT EXISTS pedidos_fecha_creacion
    ON pedidos ("fechaCreacion");

-- ---------------------------------------------------------------------------
-- 4. Refrescar las estadisticas.
--
-- Sin esto el planificador sigue decidiendo con los numeros viejos, y un
-- indice recien creado que no figura en las estadisticas no se usa.
-- ---------------------------------------------------------------------------

ANALYZE detalle_pedidos;
ANALYZE pagos;
ANALYZE pedidos;
ANALYZE historial_accesos;
ANALYZE usuarios;

-- ---------------------------------------------------------------------------
-- 5. Correo del usuario: el hallazgo mas grave.
--
-- "usuarios"."email" no tenia indice ni restriccion UNIQUE, y el modelo de
-- Sequelize tampoco la declara. Eso tenia dos consecuencias:
--
--   a) cada inicio de sesion recorria los seis millones de usuarios. Es la
--      consulta mas caliente del sistema y era la peor de todas;
--
--   b) la unicidad del correo se verificaba SOLO en la aplicacion, con un
--      findOne seguido de un create (usuario.controller.js, alta de usuario).
--      Entre esas dos sentencias cabe otra alta con el mismo correo, y la base
--      no tenia nada que lo impidiera. Dos cuentas con el mismo correo rompen
--      el inicio de sesion, porque findOne devuelve una sola.
--
-- El indice UNIQUE arregla las dos cosas de una vez: acelera la busqueda y
-- convierte la condicion de carrera en un error de clave duplicada, que es
-- algo que la aplicacion puede manejar.
--
-- Se verifico que no hubiera duplicados antes de crearlo (habia cero).
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS usuarios_email_unico
    ON usuarios (email);

ANALYZE usuarios;
