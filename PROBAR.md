# Probar el TP, punto por punto

Lista corta para ir comprobando que cada punto de la consigna **funciona de
verdad**, uno por vez. Cada bloque dice **qué prueba**, el comando, y **qué
tenés que ver**.

Para instalar desde cero está [`INSTALACION.md`](INSTALACION.md). Esto es para
cuando ya está levantado.

> Las salidas marcadas **(medido)** se obtuvieron corriendo esto el 11/11/2026.
> Las marcadas **(a comprobar)** son lo que el informe dice que tiene que
> pasar, pero no se corrieron en esa tanda.

---

## Antes de empezar

```bash
cd infra/compose
docker compose --profile app --profile replica --profile monitoreo \
  --profile incidencias --profile documental --profile automatizacion \
  --profile tunel up -d
```

```bash
docker compose ps --format "{{.Name}}\t{{.State}}"
```

**Tenés que ver (medido):** 23 contenedores en `running`. Si alguno dice
`restarting`, no sigas: mirá `docker logs <nombre>`.

> Si Docker Desktop está cerrado, nada de esto anda. Es el impedimento I-01 y
> pasó cuatro veces el 11/11.

---

## Puntos 1, 2 y 3 — Diagnóstico, Scrum y control de versiones

Estos tres no se prueban con un comando: se comprueban mirando.

**Punto 1 — diagnóstico.** Abrí [`docs/01-descripcion.md`](docs/01-descripcion.md)
y buscá **D-01**. Cada afirmación del documento cita archivo y línea: elegí una
cualquiera y verificala. Si una no se sostiene, hay que dudar del resto.

**Punto 2 — Scrum.** Abrí el [tablero](https://trello.com/b/ZF8ZDLWA).
**Tenés que ver:** las listas Backlog, Sprint, En curso, En revisión y Hecho,
y tarjetas con criterio de aceptación. Las evidencias de seguimiento
—bitácora, siete impedimentos y seis cambios de alcance— están en
[`docs/scrum/seguimiento.md`](docs/scrum/seguimiento.md).

> ⚠️ El tablero tiene **un solo miembro** hasta que los otros cuatro acepten la
> invitación. Mientras tanto, la tarjeta E2-03 no se puede cerrar.

**Punto 3 — control de versiones.**

```bash
git log --oneline origin/develop | wc -l && git branch -r | wc -l
```

**Tenés que ver:** un historial largo —incluye los 150 commits originales de
RestoYa, traídos con `git subtree` para no perderlo— y varias ramas.

```bash
gh pr list --state merged --limit 20 --json number,title --jq '.[] | "#\(.number) \(.title)"'
```

**Tenés que ver (medido):** los PR mergeados, cada uno con su revisión escrita.

> ⚠️ **Ninguno tiene aprobación de otro integrante**, y eso es lo primero que
> conviene reconocer si lo preguntan. Es el impedimento **I-04**, está escrito
> sin maquillar en [`docs/scrum/seguimiento.md`](docs/scrum/seguimiento.md), y
> se cierra con una sola aprobación de un compañero.

---

## Punto 4 — Base contenerizada y cliente de administración

**Qué prueba:** que la base tiene los datos y que pgAdmin la alcanza.

```bash
docker exec restoya_db psql -U restoya -d restoyadb -At -F' | ' -c \
  "SELECT 'pedidos', count(*) FROM pedidos
   UNION ALL SELECT 'detalle_pedidos', count(*) FROM detalle_pedidos
   UNION ALL SELECT 'pagos', count(*) FROM pagos;"
```

**Tenés que ver (medido):** `6000000` en las tres. Exactos.

Después abrí **http://127.0.0.1:5050** → `TP Integrador HIA` → doble clic en
`RestoYa (contenedor)` → `Databases` → `restoyadb` → `Schemas` → `public`.
**Tenés que ver:** `Tables (12)`.

> ⚠️ Ojo con esto en la defensa: pgAdmin **no pide ninguna credencial**. Es el
> hallazgo 17 de [`docs/09-seguridad.md`](docs/09-seguridad.md), está
> documentado y sin corregir a propósito.

---

## Punto 4 (copias) — Backup y restauración

**Qué prueba:** que las copias existen y no están vacías.

```bash
ls -la infra/compose/backups/*.dump
```

**Tenés que ver:** archivos de **cientos de MB**.

> ⚠️ **Hay copias de 0 bytes** del 11/11: quedaron de las veces que el motor de
> Docker se cayó en mitad del volcado. Una copia de 0 bytes es peor que ninguna,
> porque parece que hay respaldo. Borralas antes de mostrar esto.

---

## Punto 5 — Optimización

**Qué prueba:** que los índices están y que la consulta más cara es rápida.

```bash
docker exec restoya_db psql -U restoya -d restoyadb -c \
  "SELECT count(*) AS indices FROM pg_indexes WHERE schemaname='public';"
```

```bash
docker exec restoya_db psql -U restoya -d restoyadb -c \
  "EXPLAIN ANALYZE SELECT * FROM pedidos WHERE estado='PENDIENTE' ORDER BY \"fechaCreacion\" DESC LIMIT 50;"
```

**Tenés que ver (a comprobar):** un `Index Scan`, **no** un `Seq Scan`, y un
`Execution Time` de milisegundos. El antes y después completo está en
[`docs/07-optimizacion-sql.md`](docs/07-optimizacion-sql.md).

---

## Punto 6 — Clúster y replicación

**Qué prueba:** que la réplica está al día y que no acepta escrituras.

```bash
docker exec restoya_db psql -U restoya -d restoyadb -At -F' | ' -c \
  "SELECT application_name, state,
          pg_wal_lsn_diff(sent_lsn, replay_lsn) AS bytes_atras,
          coalesce(replay_lag::text,'0') AS retraso
   FROM pg_stat_replication;"
```

**Tenés que ver (medido):** `walreceiver | streaming | 0 | 0`.

```bash
docker exec restoya_db_replica psql -U restoya -d restoyadb -c \
  "INSERT INTO mesas(\"numMesa\") VALUES (9999);"
```

**Tenés que ver (medido):** `ERROR: cannot execute INSERT in a read-only transaction`.
**Que falle es el resultado correcto.**

> **No hay failover automático** y hay que decirlo así. La prueba de caída
> completa está en [`docs/10-cluster.md`](docs/10-cluster.md); el guion es
> `infra/postgres/simular-caida.sh`.

---

## Punto 7 — Aplicación en contenedores

**Qué prueba:** que el frente, el proxy y la API hablan entre sí.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/api/productos
```

**Tenés que ver (medido):** `200` las dos. La segunda prueba que nginx hace de
*proxy* de `/api/` y que el backend llega a la base.

> El backend **no publica puerto**. Si intentás `http://127.0.0.1:3000` no hay
> nada, y está bien: sólo lo alcanza nginx por la red interna.

---

## Punto 8 — CI/CD

**Qué prueba:** que el *pipeline* corre y publica.

```bash
gh run list --branch develop --limit 4
```

**Tenés que ver (medido):** `CI … success` y `Entrega … success`.

```bash
gh run view --log $(gh run list --workflow=entrega.yml --branch develop --limit 1 --json databaseId --jq '.[0].databaseId') | grep "pushing manifest" | head -4
```

**Tenés que ver (medido):** las dos imágenes empujadas a `ghcr.io` con su
digest y las etiquetas `develop` y el SHA.

> El trabajo **Desplegar** queda en `skipped` y es correcto: sólo corre desde
> `main` y sobre el *runner* autoalojado, que no está registrado.

---

## Punto 9 — Publicación en Internet

**Qué prueba:** que se llega desde afuera y que pasa por Cloudflare.

```bash
curl -sI https://restoya.liners-panel.com/ | grep -iE "^(cf-ray|server|x-frame-options|x-content-type-options)"
```

**Tenés que ver (medido):** `CF-RAY: …-EZE` —el sufijo es el datacenter de
Ezeiza, o sea que no es un atajo local— y las dos cabeceras de seguridad.

```bash
for r in / /metrics /api-docs; do printf "%-12s " "$r"; curl -s "https://restoya.liners-panel.com$r" | wc -c; done
```

**Tenés que ver (medido):** **16695** las tres. `/metrics` y `/api-docs`
devuelven el `index.html` de la SPA: **no están protegidos, están fuera del
camino**, y conviene decirlo con esas palabras.

> **La prueba que falta:** abrirlo desde el celular **con datos móviles**, no
> con el WiFi de casa.

---

## Punto 10 — Monitoreo

**Qué prueba:** que Prometheus ve todo y que las alertas están cargadas.

```bash
curl -s "http://127.0.0.1:9090/api/v1/targets?state=active" \
  | node -e 'let b="";process.stdin.on("data",d=>b+=d).on("end",()=>{const t=JSON.parse(b).data.activeTargets;console.log(t.filter(x=>x.health==="up").length+" de "+t.length+" en UP")})'
```

**Tenés que ver (medido):** `6 de 6 en UP`.

Después abrí **http://127.0.0.1:3001** (Grafana) y el tablero de RestoYa.

> ⚠️ **Abrilo con tiempo.** Grafana sólo dibuja los paneles que entran en
> pantalla: si lo abrís en el momento, se ve negro.

---

## Punto 11 — Incidencias

**Qué prueba:** que están las 17 con su ciclo completo.

Abrí **http://127.0.0.1:8089** y después pegá esta ruta:

```
http://127.0.0.1:8089/view_all_set.php?type=1&hide_status=-2&sort=id&dir=ASC&per_page=50
```

**Tenés que ver (medido):** *«Visualizando incidencias 1 - 17 / 17»*.

> ⚠️ **Sin ese `hide_status=-2` vas a ver UNA sola.** El filtro por defecto
> esconde las cerradas. Es el error más fácil de cometer en vivo.

---

## Punto 12 — Gestión documental

**Qué prueba:** la estructura y que los permisos del robot son los correctos.

Abrí **http://127.0.0.1:8081** → carpeta `RestoYa`.
**Tenés que ver:** las seis subcarpetas y el `README.md` renderizado arriba.

**Tenés que ver (medido):** la cuenta de robot hace `PUT` → **201** y
`DELETE` → **403**. Probar sólo lo permitido no prueba nada; el detalle está en
[`docs/13-documental.md`](docs/13-documental.md).

---

## Punto 13 — Automatización con n8n

**Qué prueba:** que los tres flujos están activos y que corrieron de verdad.

Abrí **http://127.0.0.1:5678** → *Workflows*, y después *Executions*.

**Tenés que ver (medido):** los **tres flujos en `Active`**, y en ejecuciones
**los tres errores de F03** (#13, #14, #15) antes de que quedara andando. Ese
historial con errores vale más que uno prolijo: es la depuración real.

> La interfaz **no pedía ninguna credencial** hasta que se creó la cuenta de
> propietario. Es el hallazgo 15 de [`docs/09-seguridad.md`](docs/09-seguridad.md).

---

## Punto 14 — Seguridad

**Qué prueba:** que el limitador de login corta, y que D-01 sigue abierto.

```bash
for i in $(seq 1 11); do
  printf "intento %2s -> " "$i"
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"noexiste@restoya.com.ar","password":"malaclave"}'
done
```

**Tenés que ver (a comprobar):** diez respuestas de error de credenciales y el
**intento 11 en `429`**.

```bash
curl -s -o /dev/null -w "GET /api/roles sin token -> %{http_code}\n" http://127.0.0.1:8080/api/roles
```

**Tenés que ver (a comprobar):** **`200`**. Eso es **D-01**: diecinueve
endpoints sin ninguna autenticación, documentado y **no corregido a propósito**.
Si da `200`, el hallazgo sigue vigente y **hay que bajar el túnel después de la
presentación**.

---

## Punto 15 — Documentación

```bash
ls docs/*.md | wc -l && ls docs/capturas/*.png | wc -l
```

**Tenés que ver (medido):** **18** documentos y **19** capturas.

El índice de cuál de los 16 obligatorios está en qué archivo es
[`docs/README.md`](docs/README.md).

---

## Al terminar

```bash
cd infra/compose && docker compose --profile tunel down
```

**Bajá el túnel.** Mientras esté arriba, los diecinueve endpoints de D-01 son
alcanzables desde Internet.
