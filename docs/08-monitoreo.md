# Monitoreo

Entregable del punto 15.8. Cubre el punto 10 de la consigna (épica E10 del
backlog).

Todo verificado contra el stack corriendo, con la base de 30 millones de filas
y la aplicación en contenedores.

## Cómo se levanta

```bash
cd infra/compose
docker compose --profile app --profile monitoreo up -d
```

Perfil aparte a propósito: el stack de datos y la aplicación se levantan sin
esto, y esto se levanta sin tocar aquello.

| Dónde | Qué |
|---|---|
| http://127.0.0.1:3001 | Grafana — usuario `admin`, contraseña en `infra/compose/.env` |
| http://127.0.0.1:9090 | Prometheus — consultas y estado de las reglas |
| http://127.0.0.1:9093 | Alertmanager — alertas activas y silencios |

## Los siete servicios

| Servicio | Imagen | Tamaño | Puerto en el host |
|---|---|---:|---|
| `prometheus` | `prom/prometheus:v3.1.0` | 414 MB | `127.0.0.1:9090` |
| `grafana` | `grafana/grafana:11.4.0` | 647 MB | `127.0.0.1:3001` |
| `alertmanager` | `prom/alertmanager:v0.27.0` | 106 MB | `127.0.0.1:9093` |
| `node-exporter` | `prom/node-exporter:v1.8.2` | 38 MB | **ninguno** |
| `cadvisor` | `gcr.io/cadvisor/cadvisor:v0.49.1` | 115 MB | **ninguno** |
| `postgres-exporter` | `prometheuscommunity/postgres-exporter:v0.16.0` | 35 MB | **ninguno** |
| `receptor-alertas` | `nginx:1.27-alpine` | ya estaba | **ninguno** |

Los tres exportadores y el receptor **no publican nada**: los consulta
Prometheus por la red interna y no tienen por qué ser alcanzables desde
afuera. Los tres que sí publican están atados a `127.0.0.1`.

**Las métricas de la aplicación tampoco se publican.** El backend expone
`/metrics`, pero nginx sólo hace de *proxy* de `/api/`, así que esa ruta no es
alcanzable desde el navegador: sólo la ve Prometheus. No es un detalle
decorativo — `/metrics` cuenta rutas, códigos de error, nombres de base y
versiones. Es un mapa del sistema para quien lo quiera atacar, y publicarlo
"para poder verlo" es el error clásico.

## Qué se mide

### Sistema operativo — `node-exporter`

CPU, memoria, disco y red.

> **Lo que mide no es Windows.** En Docker Desktop, el "sistema" que ve este
> exportador es la máquina virtual de WSL2. Los números son reales y sirven,
> pero no son los del Administrador de tareas. Conviene decirlo antes de que
> lo pregunten.

### Contenedores — `cAdvisor`, y hasta dónde llega

Acá hay una limitación del entorno que vale la pena contar entera, porque es
el tipo de cosa que en la defensa se pregunta.

cAdvisor arrancó, respondió y quedó sano, pero **no enumera los contenedores
uno por uno**. En su registro, 36 veces:

```
Failed to create existing container: /docker/7b845694b104...:
failed to identify the read-write layer ID for container "7b845694b104..."
- open /rootfs/var/lib/docker/image/overlayfs/layerdb/mounts/.../mount-id:
  no such file or directory
```

La causa:

```
$ docker info
 Storage Driver: overlayfs
  driver-type: io.containerd.snapshotter.v1
```

Esta instalación de Docker Desktop usa **el almacén de imágenes de
containerd**. cAdvisor busca la capa de escritura de cada contenedor en
`/var/lib/docker/image/<driver>/layerdb`, que es la estructura del
almacenamiento clásico y con containerd no existe. Sin esa capa no arma el
manejador del contenedor, y sin manejador no publica sus métricas.

Se probaron `--docker_only=true` y `--disable_metrics=disk,diskIO,...` en un
contenedor de prueba aparte. **No alcanza**: el error es al crear el
manejador, antes de decidir qué métricas recolectar.

Las dos salidas de verdad son cambiar la configuración de la máquina:

1. apagar el almacén de containerd en Docker Desktop (Settings → General), que
   invalida las imágenes ya descargadas;
2. exponer las métricas del propio demonio con `"metrics-addr"` en
   `daemon.json`, que exige reiniciar Docker.

**No se hizo ninguna de las dos**: son configuración del sistema del dueño de
la máquina, no del proyecto.

Lo que sí funciona y es lo que está en el tablero:

| Qué | De dónde sale |
|---|---|
| CPU y memoria de **todos los contenedores juntos** | cAdvisor, `id="/docker"` |
| CPU, memoria y reinicios **del backend** | sus propias métricas |
| Todo lo de PostgreSQL | `postgres-exporter` |

Para lo que importa —el backend, que es el que ya se murió una vez— el dato es
incluso más preciso: `process_start_time_seconds` mide el proceso, no el
contenedor que lo envuelve.

### PostgreSQL — `postgres-exporter`

Conexiones, transacciones confirmadas y abortadas, tamaño de la base, aciertos
de caché y **bloqueos por tipo**.

El panel de bloqueos está por un motivo concreto: `ACCESS EXCLUSIVE` es el que
bloquea absolutamente todo, lecturas incluidas, y es el que tomaba
`sync({ alter: true })` al recrear las claves foráneas en cada arranque sobre
tablas de seis millones de filas (ver [07-optimizacion-sql.md](07-optimizacion-sql.md)).
Está ahí para que eso no vuelva a pasar sin que nadie lo vea.

### Replicación — E10-04, armado pero vacío

`pg_replication_is_replica` y `pg_replication_lag_seconds` están en el tablero.
**Hoy el primero vale 0 y el segundo no significa nada**, porque el punto 6 no
está hecho y no hay réplica. El panel queda listo para cuando exista; decir que
"el monitoreo de replicación funciona" sería mentir.

### La aplicación — `prom-client` en el backend

Se agregó `prom-client@15.1.3` y un *middleware* que mide cada petición.
Publica:

- `http_requests_total` por método, ruta y código de respuesta;
- `http_request_duration_seconds`, un histograma;
- memoria del proceso, montículo de V8 y retraso del bucle de eventos.

**Por qué un histograma y no un promedio.** El promedio esconde justamente lo
que interesa. Si una de cada veinte peticiones tarda diez segundos y el resto
un milisegundo, el promedio da medio segundo y parece que está todo bien. Con
el histograma se puede preguntar por el percentil 95.

**Los límites del histograma no son los que vienen por defecto.** Se eligieron
con los números medidos en el punto 5: después de los índices, los nueve
endpoints responden entre 7 y 23 ms. Con los límites de fábrica casi todo cae
en los dos primeros cajones y el percentil 95 queda sin resolución justo donde
vive la aplicación.

**La etiqueta `route` es la plantilla, no la URL.** `/api/pedidos/:id`, no
`/api/pedidos/3000000`. Si fuera la URL, cada id distinto crearía una serie
nueva y la memoria de Prometheus se iría al techo. Las peticiones que no
coinciden con ninguna ruta (404, sondas, escaneos) van todas a la misma
etiqueta `desconocida`, por el mismo motivo.

## El tablero

Un solo tablero, `infra/grafana/dashboards/restoya.json`, con cuatro filas de
lo más general a lo más específico: sistema operativo, contenedores,
PostgreSQL y aplicación. Se lee de arriba hacia abajo cuando algo anda mal: si
la fila de arriba está sana, el problema está más abajo.

**La fuente de datos y el tablero se aprovisionan desde archivos**, no se
cargan a mano por la interfaz. Así se levantan igual en cualquier máquina, se
revisan en un *pull request* como cualquier otro archivo, y no se pierden si
alguien borra el volumen. Lo que se entrega es el archivo, no una captura de
pantalla de alguien configurándolo.

Grafana tiene apagadas las dos cosas que salen a Internet solas:
`GF_ANALYTICS_REPORTING_ENABLED` y `GF_ANALYTICS_CHECK_FOR_UPDATES`.

## Las alertas

Siete reglas en `infra/prometheus/reglas/restoya.yml`. Cada una lleva su
umbral **y por qué es ese número y no otro**, en las anotaciones de la propia
regla. Un umbral sin justificación es ruido: salta cuando no pasa nada, la
gente lo silencia, y el día que importa ya nadie lo mira.

| Alerta | Condición | Severidad |
|---|---|---|
| `ObjetivoCaido` | `up == 0` por 1 min | crítica |
| `ProcesoReiniciandoSolo` | más de 2 arranques en 15 min | alta |
| `MemoriaDelBackendAlta` | montículo al 80% de su techo | alta |
| `ApiLenta` | percentil 95 por encima de 1 s | media |
| `ConexionesDeLaBaseAlLimite` | 80% de `max_connections` | alta |
| `CacheDeLaBaseConPocosAciertos` | menos del 90% por 10 min | media |
| `DiscoPorLlenarse` | menos del 15% libre | crítica |

Cuatro de las siete salen de cosas que pasaron de verdad en este trabajo, no
de una lista de recomendaciones.

### Una regla que estuvo mal escrita, y cómo se notó

La primera versión de `MemoriaDelBackendAlta` era la que parece obvia:

```promql
nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes > 0.85
```

Al cargarla, **saltó enseguida, con el sistema ocioso**. No era un falso
positivo de umbral: la métrica estaba mal elegida.

```
nodejs_heap_size_used_bytes  = 40.713.984   (41 MB)
nodejs_heap_size_total_bytes = 43.950.080   (44 MB)
relación = 0,916
```

V8 mantiene el montículo **reservado** casi lleno a propósito y lo agranda
cuando hace falta. Esa relación da 0,92 recién arrancado y no dice nada sobre
cuánta memoria queda.

Lo que importa es cuánto falta para el **techo**, que es donde el proceso
muere. Y ese número prom-client no lo publica, así que el backend lo publica:

```js
new client.Gauge({
  name: "nodejs_heap_size_limit_bytes",
  collect() { this.set(require("v8").getHeapStatistics().heap_size_limit); },
});
```

En este contenedor son **2240 MB**, y el proceso murió a los 2 GB en el punto
5: la cuenta cierra. Con la métrica corregida, la misma máquina ociosa da
**1,7%** y la regla queda inactiva.

Es un gauge y no una constante porque el techo depende de la memoria de la
máquina: en otra da otro número, y la alerta tiene que seguir valiendo sin
tocar nada.

### E10-06 · La prueba de que la alerta sale

No alcanza con que la regla exista. Se provocó la condición parando el backend
a propósito y se siguió el camino completo:

```
[00:28:54]  estado inicial: inactive
[00:28:55]  docker stop restoya_backend
[00:29:27]  la alerta pasó a: pending      (32 s después)
[00:30:25]  la alerta pasó a: firing       (90 s después, el for: 1m se cumplió)
```

Y llegó a destino. Esto es lo que recibió el receptor, recortado:

```json
{"receiver":"registro","status":"firing","alerts":[{"status":"firing",
 "labels":{"alertname":"ObjetivoCaido","job":"backend","severidad":"critica"},
 "annotations":{"resumen":"backend no responde", ...}}]}
```

Al volver a levantar el backend llegó también el aviso de resuelto, con la
hora de inicio y de fin:

```
estado: resolved
ObjetivoCaido  inicio = 2026-11-10T03:30:09Z
               fin    = 2026-11-10T03:33:24Z
```

**Por qué el receptor no es un correo.** Mandar correo exige una contraseña de
aplicación de Gmail, y eso es un secreto que no puede entrar al repositorio.
Para lo que hay que demostrar da igual: lo que se evalúa es que la regla salte
y que el aviso llegue, no que Gmail ande.

El receptor es un nginx de quince líneas que acepta el POST, escribe el cuerpo
entero en su registro y responde 204:

```bash
docker logs restoya_receptor_alertas
```

**El receptor definitivo es un flujo de n8n** (punto 13), que ya sabe mandar
correo y abrir un ticket en Mantis (punto 11). Cuando exista se cambia la URL
en `alertmanager.yml` y este servicio se borra.

### Reglas de inhibición

Si el objetivo está caído, no tiene sentido avisar además que su memoria está
alta y que la API está lenta: es la misma noticia contada tres veces.
`ObjetivoCaido` inhibe a las de severidad alta y media de la misma instancia.

## Lo que falta y lo que no se pudo comprobar

- **El tablero no se recorrió a ojo en el navegador.** Se verificó por API que
  Grafana levantó la fuente de datos y el tablero, y **consulta por consulta**
  que las veinte devuelven datos contra Prometheus. La revisión visual queda
  pendiente.
- **No hay métricas por contenedor**, por la limitación de containerd de más
  arriba. Hay agregado de todos juntos y detalle del backend.
- **La replicación está armada pero vacía** hasta que exista el punto 6.
- **nginx no tiene exportador.** Se vería el tráfico del frente por separado
  del backend. Hoy el frente sólo aparece en el agregado de contenedores.
- **Ningún servicio tiene límites de CPU ni memoria declarados**, así que el
  tablero muestra consumo sin un techo contra el cual compararlo. Es la misma
  deuda que ya estaba anotada en [05-docker.md](05-docker.md).
- **Las mediciones son de una sola máquina, sin carga concurrente real.** El
  tráfico de prueba fueron 320 peticiones en ráfagas de nueve.
- `@scarf/scarf`, un paquete que avisa a su servidor cuando se instala, entra
  de arrastre por `swagger-ui-express`. npm bloqueó su script de instalación.
  No es del monitoreo, pero apareció mientras se instalaba `prom-client` y va
  anotado para el punto 14.
