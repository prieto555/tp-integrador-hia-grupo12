# Procedimiento de migración y carga de datos

Entregable del punto 15.6. Cubre los datos que la consigna pide documentar en
el punto 4: cantidad de registros por tabla, tamaño de la base, método de
generación, tiempo de carga, restricciones de integridad, y tiempo y resultado
de las copias de seguridad.

Medición del **9 de noviembre de 2026**, sobre el contenedor `restoya_db`
(PostgreSQL 16.15) en la notebook: Intel i7-1265U, 15,4 GB de RAM, disco NVMe.

---

## Qué tablas forman el conjunto de prueba

Cinco, las que crecen con el uso real del sistema:

`usuarios`, `pedidos`, `detalle_pedidos`, `pagos` e `historial_accesos`.

Las de catálogo quedan con su tamaño natural: `productos`, `mesas`, `roles`,
`funciones` y las tablas intermedias. Seis millones de mesas no describirían
ningún restaurante. `cajas` se llenó a 5.000 turnos, que es lo que hacen falta
para que los pagos tengan a qué apuntar.

## Método de generación

Datos sintéticos generados **dentro de PostgreSQL** con `generate_series` e
`INSERT ... SELECT`, desde `infra/postgres/generar-dataset.sql`. No se usó un
script en Node: mover 30 millones de filas por el driver habría multiplicado el
tiempo por ida y vuelta de red y serialización.

```bash
docker cp infra/postgres/generar-dataset.sql restoya_db:/tmp/
docker exec restoya_db psql -U restoya -d restoyadb -v filas=6000000 -f /tmp/generar-dataset.sql
```

El script acepta `-v filas=N`, así que sirve igual para una prueba rápida de
10.000 filas que para la carga completa.

### Los datos no son uniformes, y es deliberado

Las fechas se concentran en los meses recientes (distribución `i^1.6`), los
estados siguen una proporción parecida a la real, y el 70% de los pedidos son
de local contra 30% de delivery.

**Por qué importa:** el planificador de PostgreSQL elige el plan según la
selectividad estimada de cada condición. Con datos planos —todas las fechas
iguales, todos los estados equiprobables— cualquier índice parece igual de
bueno y los `EXPLAIN ANALYZE` del punto 5 no representarían nada. El sesgo es
lo que hace que el análisis de optimización tenga sentido.

### Dos correcciones durante la calibración

Se calibró con 10.000 y 50.000 filas antes de la carga completa.

1. **`enum_pedidos_tipoPedido` necesita comillas.** El tipo tiene mayúsculas y
   PostgreSQL las exige; sin ellas el script moría en la segunda tabla.
2. **El bloque de `detalle_pedidos` era inviable a escala.** Usaba
   `CROSS JOIN LATERAL ... OFFSET`, que recorre la tabla de productos una vez
   por fila. Legible, pero a seis millones de ejecuciones no termina nunca. Se
   reemplazó por un `row_number()` sobre el catálogo con join por módulo.

## Cantidad de registros

Conteos exactos con `COUNT(*)`, no las estimaciones de `pg_stat_user_tables`,
que por muestreo informaban entre 5.999.978 y 6.002.142.

| Tabla | Filas |
|---|---|
| `usuarios` | 6.000.001 |
| `pedidos` | 6.000.000 |
| `detalle_pedidos` | 6.000.000 |
| `pagos` | 6.000.000 |
| `historial_accesos` | 6.000.000 |
| `cajas` | 5.000 |
| **Total** | **30.005.001** |

`usuarios` tiene una fila de más: el administrador que crea el *seed*, que ya
existía antes de la carga.

## Tiempo de carga

**Total: 30 minutos 47 segundos** (20:00:41 → 20:31:28).

| Etapa | Tiempo |
|---|---|
| `cajas` (5.000) | 0,09 s |
| `usuarios` | 32,07 s |
| `pedidos` | 6 min 21 s |
| `detalle_pedidos` | 7 min 08 s |
| `pagos` | 10 min 09 s |
| `historial_accesos` | 6 min 24 s |
| `ANALYZE` de las seis tablas | 11,5 s |

`pagos` es la más lenta porque valida **dos** claves foráneas por fila, contra
`pedidos` (6M) y `cajas`. `usuarios` es la más rápida porque no valida ninguna:
no referencia a nadie.

El `ANALYZE` final no es opcional. Sin estadísticas frescas el planificador
trabaja con los números de cuando las tablas estaban vacías, y los planes del
punto 5 serían inservibles.

## Tamaño de la base

**3269 MB en total**, incluyendo índices.

| Tabla | Tamaño |
|---|---|
| `usuarios` | 1134 MB |
| `historial_accesos` | 628 MB |
| `pedidos` | 519 MB |
| `pagos` | 505 MB |
| `detalle_pedidos` | 473 MB |
| `cajas` | 536 kB |

`usuarios` pesa más del doble que las demás con la misma cantidad de filas,
porque cada fila lleva el hash bcrypt de la contraseña (60 caracteres), el
correo, el nombre y el apellido. Las otras tablas son casi todas enteros,
fechas y números de punto flotante.

Todas las filas comparten el mismo hash bcrypt, de una contraseña de prueba.
Generar seis millones de hashes reales habría tardado horas sin aportar nada:
bcrypt es lento por diseño.

## Restricciones de integridad

**Las siete claves foráneas estuvieron activas y validadas durante toda la
carga.** No se desactivaron para ganar velocidad, que es la trampa habitual.

| Tabla | Restricción | Referencia | Validada |
|---|---|---|---|
| `pedidos` | `pedidos_idMesa_fkey` | `mesas` | sí |
| `pedidos` | `pedidos_usuarioId_fkey` | `usuarios` | sí |
| `detalle_pedidos` | `detalle_pedidos_idPedido_fkey` | `pedidos` | sí |
| `detalle_pedidos` | `detalle_pedidos_idProducto_fkey` | `productos` | sí |
| `pagos` | `pagos_idPedido_fkey` | `pedidos` | sí |
| `pagos` | `pagos_idCaja_fkey` | `cajas` | sí |
| `historial_accesos` | `historial_accesos_usuarioId_fkey` | `usuarios` | sí |

```sql
SELECT conrelid::regclass, conname, convalidated
FROM pg_constraint WHERE contype = 'f';
```

Las siete devuelven `convalidated = true`. Eso significa que PostgreSQL
verificó cada una de las 30 millones de filas contra su tabla padre: no hay
huérfanos, y no puede haberlos.

### Una observación sobre el modelo

Las siete claves son `ON DELETE SET NULL`, que es el valor por omisión de
Sequelize. Para `detalle_pedidos.idPedido` es discutible: borrar un pedido
deja sus líneas de detalle vivas con `idPedido` en nulo, en vez de borrarlas
con él. Son líneas de factura sin factura. Lo razonable ahí sería
`ON DELETE CASCADE`.

No se cambió porque excede la carga de datos, pero queda anotado como hallazgo.

## Copias de seguridad

| Medición | Resultado |
|---|---|
| Tiempo de `pg_dump -Fc` | **201 s** (3 min 21 s) |
| Tamaño de la copia | **466,8 MB** |
| Relación de compresión | 7 a 1 desde 3269 MB |
| Verificación con `pg_restore -l` | correcta |

El servicio `restoya_backup` hace esto solo cada hora, verifica cada copia y
rota dejando las siete más nuevas. La bitácora queda en
`infra/compose/backups/backups.log`.

### Prueba de restauración

Una copia que nunca se restauró no sirve de nada. Se restauró sobre una base
nueva y vacía, no sobre la original:

```bash
docker exec restoya_db psql -U restoya -d postgres -c "CREATE DATABASE prueba_restauracion;"
docker exec restoya_backup pg_restore -d prueba_restauracion -j 4 /backups/medicion-6M.dump
```

| Medición | Resultado |
|---|---|
| Tiempo de restauración | **75 s** (con `-j 4`, cuatro procesos en paralelo) |
| `usuarios` | 6.000.001 ✓ |
| `pedidos` | 6.000.000 ✓ |
| `detalle_pedidos` | 6.000.000 ✓ |
| `pagos` | 6.000.000 ✓ |
| `historial_accesos` | 6.000.000 ✓ |

Los cinco conteos coinciden exactamente con el origen. La restauración es más
rápida que la copia (75 s contra 201 s) porque `pg_restore -j 4` paraleliza la
carga de tablas e índices, mientras que `pg_dump` comprime en un solo proceso.

La base de prueba se eliminó después de verificar.

## Hallazgo: el arranque del backend degrada la base

Al levantar el backend contra las tablas ya cargadas, tardó **45 segundos**
contra los menos de 10 habituales. El motivo está en el registro de Sequelize:
`sequelize.sync({ alter: true })` no es inofensivo.

En cada arranque:

1. **Suelta y vuelve a crear las siete claves foráneas.** Cada `ADD FOREIGN
   KEY` sobre una tabla de seis millones de filas exige una validación
   completa. Entre el `DROP` y el `ADD` la restricción no existe.
2. **Toma bloqueo exclusivo** sobre tablas de seis millones, bloqueando
   lecturas y escrituras mientras dura.
3. **Ejecuta `ALTER COLUMN ... TYPE` sobre cada columna de cada tabla.** Acá
   los tipos coinciden y PostgreSQL puede evitar la reescritura, pero si
   alguna vez no coincidieran, reescribiría la tabla entera.
4. **Agrega una restricción `UNIQUE` nueva a `mesas` en cada arranque.**

El punto 4 no es teórico. Después de siete arranques:

```
mesas_numMesa_key    mesas_numMesa_key4
mesas_numMesa_key1   mesas_numMesa_key5
mesas_numMesa_key2   mesas_numMesa_key6
mesas_numMesa_key3
```

Siete índices únicos idénticos sobre la misma columna, que crecen de a uno por
arranque y que PostgreSQL mantiene en cada `INSERT` y cada `UPDATE` de la
tabla. Es degradación acumulativa, sin techo.

**Esto bloquea el trabajo del punto 5:** cualquier medición de rendimiento
hecha sobre una base que el backend viene alterando en cada arranque no es
reproducible. Hay que resolver E4-05 (sacar el `sync`) y E4-06 (migraciones)
antes de empezar la optimización.

## Cómo reproducir la carga desde cero

```bash
cd infra/compose && docker compose up -d
```

```bash
docker exec restoya_db psql -U restoya -d restoyadb -c "TRUNCATE historial_accesos, pagos, detalle_pedidos, pedidos RESTART IDENTITY CASCADE;"
```

```bash
docker cp ../postgres/generar-dataset.sql restoya_db:/tmp/ && docker exec restoya_db psql -U restoya -d restoyadb -v filas=6000000 -f /tmp/generar-dataset.sql
```

Media hora después, la base queda igual que la medida en este documento.
