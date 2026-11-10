# Optimización de consultas SQL

Entregable del punto 15.7. Cubre el punto 5 de la consigna (épica E5 del
backlog).

Todo lo que sigue está medido sobre la base real de **30.000.000 de filas**
descrita en [06-carga-datos.md](06-carga-datos.md), corriendo en
`postgres:16-alpine` dentro de Docker, en la notebook.

Los archivos están en `infra/postgres/optimizacion/`:

| Archivo | Para qué |
|---|---|
| `consultas.sql` | Las diez consultas con `EXPLAIN (ANALYZE, BUFFERS)` |
| `consultas-planas.sql` | Las mismas sin `EXPLAIN`, para cronometrar |
| `indices.sql` | Los índices, cada uno con su justificación |
| `vistas-materializadas.sql` | Las cuatro vistas del dashboard |
| `medir.sh` | Corre la comparación con índices y sin índices |

---

## Antes de poder medir: el esquema se movía solo

El backend arrancaba con `sequelize.sync({ alter: true })`. En cada arranque:

- soltaba y recreaba las **siete claves foráneas**, tomando bloqueo
  `ACCESS EXCLUSIVE` sobre tablas de seis millones de filas;
- acumulaba **una restricción `UNIQUE` duplicada en `mesas` por arranque**. Se
  encontraron ocho: `mesas_numMesa_key` hasta `mesas_numMesa_key7`;
- ejecutaba **122 sentencias `ALTER`** antes de ponerse a escuchar, al punto
  que Docker lo mataba por no responder al *healthcheck*.

Con el esquema cambiando debajo, ninguna medición es reproducible. Así que lo
primero fue sacarlo (tarea E4-05):

```js
const MODO_SYNC = (process.env.DB_SYNC || 'none').toLowerCase();
```

- `none` (el valor por defecto, y el único válido para medir): verifica que la
  base responda y nada más.
- `alter`: el comportamiento viejo, para una base de prueba.
- `create`: crea lo que falte sin tocar lo que existe.

Se eliminaron las siete restricciones duplicadas. **Verificado**: el arranque
pasó a nueve segundos, con cero sentencias `ALTER` en el registro, y las once
claves foráneas intactas.

> El esquema real vive en `infra/postgres/schema.sql`. Migraciones versionadas
> (E4-06) sigue siendo trabajo pendiente: hoy el esquema se versiona como un
> volcado, no como una secuencia de cambios.

---

## E5-01 · Qué consultas costaban de verdad

Con `pg_stat_statements` activo, se reinició la estadística y se le dio
tráfico real a la aplicación por los nueve endpoints que usa el frente. Las que
dominaban el tiempo total:

| ms promedio | Consulta |
|---:|---|
| 581 | Productos más vendidos (`SUM` sobre 6M de líneas de detalle) |
| 553 | Ventas por método de pago (`GROUP BY` sobre 6M de pagos, sin filtro) |
| 207 | Ticket promedio (2M de pedidos en estado `PAGADO`) |
| 136 | Ventas por día (filtro de 30 días sobre 6M de pagos) |

Las cuatro son del dashboard. Volvemos sobre ellas más abajo, porque ninguna se
arregla con un índice.

---

## E5-03 y E5-04 · El diagnóstico

**Ninguna de las once claves foráneas tenía índice.** PostgreSQL indexa
automáticamente el lado referenciado (la clave primaria), nunca el lado que
referencia. Buscar "los detalles del pedido 3000000" recorría las seis millones
de filas.

**`usuarios.email` no tenía índice ni restricción `UNIQUE`**, y el modelo de
Sequelize tampoco la declara. Esto es lo más grave del informe, por dos motivos
a la vez:

1. *Rendimiento*: cada inicio de sesión recorría los seis millones de usuarios.
   Es la consulta más caliente del sistema y era la peor de todas.
2. *Corrección*: la unicidad del correo se verificaba **sólo en la aplicación**,
   con un `findOne` seguido de un `create`. Entre esas dos sentencias cabe otra
   alta con el mismo correo, y la base no tenía nada que lo impidiera. Dos
   cuentas con el mismo correo rompen el inicio de sesión, porque `findOne`
   devuelve una sola.

Se verificó que no hubiera duplicados (había cero) antes de crear el índice
`UNIQUE`, que arregla las dos cosas de una vez: acelera la búsqueda y convierte
la condición de carrera en un error de clave duplicada, que la aplicación sí
puede manejar.

---

## E5-06 · Los índices creados

Diez índices, cada uno atado a una consulta medida. No hay ninguno "por si
acaso".

| Índice | Tabla | Tamaño | Para qué |
|---|---|---:|---|
| `usuarios_email_unico` | usuarios | 285 MB | Inicio de sesión + unicidad |
| `detalle_pedidos_id_pedido` | detalle_pedidos | 129 MB | Detalle de un pedido |
| `pagos_id_pedido` | pagos | 129 MB | Cobertura de clave foránea |
| `pedidos_usuario_id` | pedidos | 129 MB | Cobertura de clave foránea |
| `historial_accesos_usuario_id` | historial_accesos | 129 MB | Historial con usuario |
| `pedidos_id_mesa` | pedidos | 40 MB | Cobertura de clave foránea |
| `pagos_id_caja` | pagos | 39 MB | Reporte de caja |
| `pedidos_fecha_creacion` | pedidos | 39 MB | Pedidos de hoy |
| `pagos_fecha_pago` | pagos | 39 MB | Ventas por día |
| `pedidos_cocina` (parcial) | pedidos | 11 MB | Pantalla de cocina |

Todos se crearon con `CONCURRENTLY`, que no bloquea escrituras. Tardaron entre
1,7 y 4,8 segundos cada uno; 31 segundos en total.

### El índice parcial

La cocina pide los pedidos `PENDIENTE` o `EN_COCINA` ordenados por fecha. Eso
es el 22% de la tabla, pero el 100% de las consultas de esa pantalla:

```sql
CREATE INDEX pedidos_cocina ON pedidos ("fechaCreacion")
    WHERE estado IN ('PENDIENTE', 'EN_COCINA');
```

Guarda sólo esas filas, y las guarda **ya ordenadas por fecha**. El
planificador lo camina y corta al llegar al límite, en lugar de ordenar seis
millones de filas para devolver doscientas. Por eso ocupa 11 MB y no 129.

### Lo que se decidió NO indexar

**`detalle_pedidos."idProducto"`.** Tiene cuatro valores distintos sobre seis
millones de filas: cualquier búsqueda por producto devuelve un millón y medio
de filas y el planificador va a preferir recorrer la tabla. Costaría 129 MB y
una escritura extra por cada línea de pedido, para no acelerar nada.

**BRIN para las fechas.** Para datos temporales BRIN suele ser la respuesta
correcta: ocupa kilobytes en lugar de megabytes. No sirvió acá, y el motivo se
puede mirar:

```
pagos."fechaPago"  -> correlation = -0.0117
```

La correlación entre el valor de la columna y el orden físico de la tabla es
prácticamente cero, porque el generador de datos reparte las fechas en abanico
y no en orden. BRIN sin correlación no descarta nada.

**`usuario_roles` por `usuarioId`.** Su clave primaria es `(rolId, usuarioId)`,
con `rolId` primero, así que buscar los roles de un usuario no la puede usar.
Hoy la tabla tiene una sola fila y no hay nada que medir; queda anotado para
cuando crezca.

### El costo en escritura

Un índice no es gratis: se paga en cada `INSERT`, `UPDATE` y `DELETE`. Medido
con dos tablas idénticas, una con los cuatro índices de `pedidos` y otra sin
ninguno, insertando 200.000 filas en cada una:

| | Sin índices | Con los 4 índices |
|---|---:|---:|
| Tiempo de inserción | 293 ms | **1086 ms** |
| Tamaño en disco | 12 MB | 17 MB |

**Las escrituras se vuelven 3,7 veces más lentas** y ocupan 42% más. Sobre la
base completa, los índices llevaron la base de 3.269 MB a 4.237 MB: casi un
giga de más.

Es un intercambio deliberado. RestoYa lee muchísimo más de lo que escribe: un
pedido se escribe una vez y se consulta en la cocina, en la caja, en el
historial y en el dashboard.

### Tres índices que todavía no se usaron

`pagos_id_pedido`, `pedidos_usuario_id` y `pedidos_id_mesa` figuran con **cero
usos** en `pg_stat_user_indexes`. No es un error: existen para cubrir claves
foráneas declaradas `ON DELETE SET NULL`. Sin ellos, borrar un pedido recorre
`detalle_pedidos` y `pagos` enteros. Como en estas pruebas no se borró nada,
nunca se usaron. Si el camino de borrado nunca se ejerce en producción, son los
primeros candidatos a sacar: 298 MB y una escritura por fila.

---

## E5-07 · Medición antes y después

### Cómo se midió

Medir "antes de crear los índices" y "después" como dos momentos distintos no
sirve: entre uno y otro cambia la caché, y la segunda medición sale mejor
aunque el índice no haga nada.

Por eso `medir.sh` corre las dos mitades **seguidas, sobre la misma caché**, y
lo único que cambia es si el planificador tiene permiso de usar los índices:

```sql
SET enable_indexscan=off; SET enable_bitmapscan=off; SET enable_indexonlyscan=off;
```

Eso le deja exactamente las opciones que tenía antes de que los índices
existieran. Cada consulta corre cinco veces y se informa **el mejor tiempo**,
no el promedio: el promedio mezcla el ruido del sistema operativo, el mejor
tiempo es el piso real de la consulta.

### Resultados

| Consulta | Sin índices | Con índices | Mejora |
|---|---:|---:|---:|
| Q1 · Pantalla de cocina | 1204,8 ms | **0,9 ms** | 1337× |
| Q2 · Detalle de un pedido | 133,8 ms | **0,11 ms** | 1206× |
| Q3 · Pagos de una caja | 173,3 ms | **1,8 ms** | 98× |
| Q4 · Ticket promedio | 179,9 ms | 174,6 ms | — |
| Q5 · Ventas por día (30 días) | 396,4 ms | **126,5 ms** | 3,1× |
| Q6 · Productos más vendidos | 714,4 ms | 719,2 ms | — |
| Q7 · Historial de accesos | 3323,1 ms | **0,5 ms** | 6659× |
| Q8 · Inicio de sesión | 282,1 ms | **0,09 ms** | 3281× |

**Q7 no es mérito de este trabajo.** El índice sobre `fechaHora` ya existía.
Lo que muestra la fila es cuánto estaba ahorrando ya: sin él, devolver los cien
accesos más recientes obliga a ordenar seis millones de filas.

**Q4 y Q6 no mejoraron, y está bien.** Las dos agregan la tabla entera. No hay
nada que buscar: ya se sabe que se quieren todas las filas. Un índice acelera
encontrar filas, no leerlas. La respuesta para esas dos está en la sección de
vistas materializadas.

---

## E5-05 · Consultas no SARGables

Una consulta es *SARGable* cuando el motor puede usar un índice para resolver
su `WHERE`. Aplicar una función sobre la columna lo impide: el índice guarda el
valor de la columna, no el resultado de la función.

En los controladores **no se encontró ninguna**. El caso que lo parece —
`DATE("fechaPago")` en `ventasPorDia` — está en el `GROUP BY`, no en el
`WHERE`, así que no estorba.

Para dejar el efecto medido igual, se escribió la misma pregunta de las dos
maneras:

| | Consulta | Tiempo |
|---|---|---:|
| Q9 | `WHERE date("fechaCreacion") = <día>` | 683,2 ms |
| Q10 | `WHERE "fechaCreacion" >= <día> AND < <día+1>` | **0,39 ms** |

**1785 veces más rápida**, misma pregunta, misma respuesta, mismo índice
disponible. Sólo cambia cómo está escrita.

---

## E5-08 · Parámetros del motor

### `shm_size`: un error que tapaba la medición

La primera corrida de Q1 no dio un tiempo, dio un error:

```
could not resize shared memory segment "/PostgreSQL.627713750"
to 16777216 bytes: No space left on device
```

Docker da 64 MB de `/dev/shm` por defecto, y PostgreSQL usa memoria compartida
para los *hash join* en paralelo. No es un problema de PostgreSQL ni de la
consulta: es el contenedor. Se subió a 512 MB en `docker-compose.yml` y la
consulta pasó a correr.

Vale la pena señalarlo porque es un error que **no aparece fuera de Docker** y
que no se parece en nada a su causa.

### `random_page_cost`: el consejo de manual que acá empeoró las cosas

El disco de la máquina es un **NVMe** (KIOXIA KBG50ZNV512G, verificado). El
valor por defecto de `random_page_cost` es 4,0, que le dice al planificador que
una lectura al azar cuesta cuatro veces una secuencial. Eso era cierto en
discos rígidos. La recomendación habitual para SSD es bajarlo a 1,1.

Se probó. **Dio peor**:

| Escenario | Q5 (ventas por día) |
|---|---:|
| `random_page_cost = 4` (por defecto) | **106,8 ms** |
| `random_page_cost = 1.1` | 224,4 ms |

El plan explica por qué:

| | Plan elegido | Bloques leídos |
|---|---|---:|
| `rpc = 4` | Bitmap Heap Scan | **5.661** |
| `rpc = 1.1` | Index Scan | **632.029** |

Las 631.500 filas que devuelve la consulta viven en 5.661 páginas. El *bitmap
scan* junta primero todas las páginas que necesita, las deduplica y las lee en
orden físico. El *index scan* común visita una página por fila, y termina
pidiendo la misma página una y otra vez: **112 veces más accesos**.

Con el filtro de treinta días, que toca el 10% de la tabla, el acceso ordenado
gana por lejos. Bajar `random_page_cost` le hizo creer al planificador que el
acceso salteado era barato y eligió el plan equivocado.

**Decisión: queda en 4,0.** La recomendación de bajarlo para SSD vale cuando
las consultas son selectivas; con filtros anchos, perjudica.

### `effective_io_concurrency`

Quedó en el valor por defecto. Sólo tiene efecto cuando el *bitmap heap scan*
lee del disco de verdad, y en estas pruebas todo venía de `shared_buffers`
(`shared hit`, cero `read`). **No se pudo medir, así que no se tocó.**

### Lo que sí quedó configurado

En el `command` del servicio `db`:

| Parámetro | Valor | Por qué |
|---|---|---|
| `shared_buffers` | 512 MB | Por defecto son 128 MB |
| `work_mem` | 32 MB | Ordenamientos y *hash* en memoria |
| `maintenance_work_mem` | 512 MB | Creación de índices y `VACUUM` |
| `effective_cache_size` | 2 GB | Lo que el planificador supone cacheado |
| `log_min_duration_statement` | 500 ms | Deja registro de lo lento |
| `shared_preload_libraries` | `pg_stat_statements` | Sin esto no hay E5-01 |

---

## Lo que ningún índice arregla

Tres de los problemas más graves no estaban en la base. Estaban en cómo la
aplicación la usaba.

### 1. `GET /api/pedidos/cocina` tumbaba el servidor

Con la base cargada, ese endpoint tardó **91 segundos** y devolvió 502. Los
siguientes también. El registro del contenedor dice por qué:

```
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
```

La consulta no tenía `LIMIT`. Son 1,33 millones de pedidos con sus detalles y
sus productos; Sequelize arma un objeto por fila y el proceso muere a los 2 GB
de montículo. `restart: unless-stopped` lo levantó de nuevo.

**Una sola petición autenticada bastaba para tirar abajo todo el backend.**

Y acá está la lección del punto 5 entera en un caso: después de crear los
índices, **la consulta SQL tarda 0,9 ms**. El servidor se moría igual. El
problema no era encontrar las filas, era cuántas devolvía.

`GET /api/pedidos` tenía exactamente el mismo defecto. Las dos tienen ahora un
tope de 100 filas por defecto, configurable con `?limite=` y `?pagina=` hasta
un máximo duro. La respuesta sigue siendo un arreglo, para no romper al frente,
que espera `any[]`; devolver metadatos de paginación queda como E5-10.

### 2. El promedio se calculaba en JavaScript

```js
Pedido.findAll({ where: { estado: "PAGADO" }, attributes: ["total"] })
// ...
const ticketPromedio = total / pedidosPagados.length;
```

Dos millones de filas viajando de la base a Node para devolver **un número**.
`AVG()` lo resuelve en la base, en un recorrido, sin transferir nada.

### 3. Un error que introduje yo en el punto 7

Al poner nginx como *proxy* agregué la cabecera `X-Forwarded-For`, sin tocar
Express. El backend empezó a lanzar en cada petición:

```
ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
```

`express-rate-limit` ve una cabecera que dice de dónde viene el cliente, no
tiene permiso para confiar en ella, y entonces no puede identificar a nadie: el
límite de intentos de inicio de sesión **dejó de limitar**. Es un agujero de
seguridad, no una molestia en el registro.

Arreglado con `app.set('trust proxy', 1)`: confiar en exactamente un salto, el
de nginx, y no en más.

---

## Las vistas materializadas

Después de los índices, las cuatro consultas más caras eran las cuatro del
dashboard, y ninguna tenía arreglo por índice: las cuatro agregan la tabla
entera.

La respuesta para un panel de control es **no recalcular lo mismo en cada
visita**. Se calcula una vez, se guarda, y se recalcula cada tanto.

El costo es que los números quedan viejos. Por eso se materializó sólo lo
histórico:

| Vista | Qué guarda | Antes | Después |
|---|---|---:|---:|
| `mv_ventas_por_producto` | Unidades e importe por producto | 581 ms | **3,3 ms** |
| `mv_ventas_por_metodo` | Total por método de pago | 553 ms | **2,0 ms** |
| `mv_ventas_por_dia` | Total por día (1.096 días) | 136 ms | **< 1 ms** |
| `mv_resumen_historico` | Ticket promedio histórico | 171 ms | **1,4 ms** |

**Lo que NO se materializó, a propósito**: ventas de hoy, pedidos de hoy y
mesas ocupadas. Son las cifras que mira el encargado para decidir en el
momento, ahí el atraso sí importa, y ya son baratas porque filtran por fecha o
por estado.

El refresco es una función:

```sql
SELECT refrescar_vistas_dashboard();
-- vistas del dashboard refrescadas en 1.89 s
```

Usa `REFRESH MATERIALIZED VIEW CONCURRENTLY`, que no bloquea las lecturas: el
dashboard sigue respondiendo con los datos viejos mientras se calculan los
nuevos. A cambio exige un índice único en cada vista, que por eso están.

**Falta programarla.** Las opciones son `pg_cron`, que es otra extensión que
instalar, o un flujo de n8n, que ya entra en el trabajo por el punto 13. Es
n8n: no agrega nada al stack.

---

## El resultado, de punta a punta

Lo que importa no es el tiempo de la consulta sino el de la respuesta. Medido
contra la aplicación corriendo en contenedores, atravesando nginx, tercera
pasada:

| Endpoint | Antes | Después |
|---|---:|---:|
| `GET /api/pedidos/cocina` | 91,3 s → **502, backend caído** | **0,022 s** |
| `GET /api/historial` | 502 (backend caído) | **0,013 s** |
| `GET /api/dashboard/resumen` | 502 (backend caído) | **0,009 s** |
| `GET /api/dashboard/ventas-por-dia` | 502 (backend caído) | **0,007 s** |
| `GET /api/dashboard/ventas-por-metodo-pago` | 502 (backend caído) | **0,007 s** |
| `GET /api/dashboard/productos-mas-vendidos` | 502 (backend caído) | **0,007 s** |
| `GET /api/pedidos` | nunca funcionó | **0,018 s** |

Los seis 502 son la misma caída: el primer endpoint mató al proceso y los
siguientes encontraron el backend reiniciándose.

Después de todo esto, **la consulta más lenta de todo el sistema tarda 1,4 ms**
según `pg_stat_statements`.

---

## Lo que no se hizo y lo que no se pudo comprobar

- **No se abrió el dashboard en el navegador con sesión iniciada.** Se
  verificó campo por campo que las respuestas de la API mantienen la forma que
  el componente lee (`item.producto.nombre`, `item.totalVendido`, `item.fecha`,
  `item.metodoPago`), y que las cuatro devuelven 200 con datos. El recorrido
  visual queda pendiente.
- **El refresco de las vistas no está programado.** Hay que llamarlo a mano
  hasta que exista el flujo de n8n.
- **Las migraciones versionadas (E4-06) siguen pendientes.** Hoy el esquema se
  versiona como un volcado.
- **`effective_io_concurrency` no se pudo medir**: todas las pruebas corrieron
  con los datos en memoria.
- **El generador de datos pone exactamente una línea de detalle por pedido.**
  Un pedido real tiene dos o cuatro. Eso no cambia ninguna conclusión sobre los
  índices, pero hace que Q2 devuelva menos filas de las que devolvería en
  producción.
- **Todo está medido en una sola máquina, sin concurrencia.** No hay pruebas de
  carga con varios usuarios a la vez. Eso es trabajo del punto 10.
