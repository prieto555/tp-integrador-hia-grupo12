# Manual de instalación

**Documento 4 de los dieciséis** que pide el punto 15.

De un clon limpio a los veintitrés contenedores andando. El
[`README.md`](README.md) cuenta qué es el proyecto; esto cuenta **cómo se
levanta**, paso por paso, sin dar nada por sabido.

> **Verificado el 11/11/2026** sobre `develop`: 23 de 23 contenedores
> corriendo, los diez servicios respondiendo 200 y la aplicación alcanzable
> desde Internet. Los números medidos están en §8.

---

## 1 · Lo que hace falta antes de empezar

| Qué | Para qué | Cómo se comprueba |
|---|---|---|
| **Docker Desktop** con el motor Linux (WSL2 en Windows) | Todo corre en contenedores | `docker version` dice *Server: Docker Desktop* |
| **Docker Compose v2** | Viene con Docker Desktop | `docker compose version` |
| **Git** | Clonar | `git --version` |
| **Node.js 20 o superior** | Sólo para `cargar-incidencias.js` del punto 11 | `node --version` |
| **Bash** | Los scripts de preparación son `.sh`. En Windows, Git Bash | `bash --version` |
| **`cloudflared`** | **Sólo** si se va a publicar en Internet (punto 9) | `cloudflared --version` |

**Espacio y memoria.** La base con el conjunto de prueba completo son **unos
5 GB** en disco, y los veintitrés contenedores juntos piden alrededor de **6 GB
de RAM**. Con menos levanta igual, pero conviene no correr los cuatro perfiles
de herramientas a la vez.

**Todo queda en `127.0.0.1`.** Ningún puerto sale a la red local. A Internet
sale **sólo** lo que esté en el *ingress* del túnel, y sólo si se levanta el
perfil `tunel` a propósito: hoy son la aplicación y cuatro herramientas
(n8n, Mantis, Nextcloud y Grafana). La lista exacta, con el motivo de cada
una y de las cinco que quedan afuera, está en
[`infra/tunel/config.plantilla.yml`](infra/tunel/config.plantilla.yml).

---

## 2 · Clonar y configurar

```bash
git clone https://github.com/prieto555/tp-integrador-hia-grupo12.git
cd tp-integrador-hia-grupo12
```

La rama por defecto es `develop` y es la que tiene todo.

### 2.1 · El archivo de variables

```bash
cd infra/compose
cp .env.example .env
```

Ahora hay que **completar `.env`**. No tiene valores por defecto a propósito:
las variables obligatorias están declaradas con `${VARIABLE:?}`, así que si
falta una, Compose **falla de entrada y dice cuál**, en vez de levantar a
medias con una clave como `admin`.

Las que hay que poner sí o sí:

| Variable | Qué es |
|---|---|
| `DB_PASSWORD` | Clave del usuario `restoya` de PostgreSQL |
| `JWT_SECRET` | Secreto con el que el backend firma los tokens |
| `ADMIN_PASSWORD` | Clave del usuario administrador de la aplicación |
| `PGADMIN_PASSWORD` | Clave de pgAdmin |
| `GRAFANA_PASSWORD` | Clave de Grafana |
| `REPLICACION_PASSWORD` | Clave del rol de replicación (punto 6) |
| `SWAGGER_PASSWORD` | Clave para ver la documentación de la API |
| `MANTIS_SALT`, `NEXTCLOUD_DB_PASSWORD`, `NEXTCLOUD_ADMIN_PASSWORD`, `N8N_DB_PASSWORD`, `N8N_PASSWORD`, `N8N_ENCRYPTION_KEY` | Las herramientas de los puntos 11, 12 y 13 |

Para generar una clave decente:

```bash
openssl rand -base64 32
```

> **`N8N_ENCRYPTION_KEY` es especial.** Con esa clave n8n cifra las credenciales
> que guarda. Si se pierde o se cambia, **las credenciales guardadas dejan de
> poder descifrarse** y hay que volver a cargarlas todas. Generarla una vez y
> no tocarla.

### 2.2 · El archivo del secreto de alertas

```bash
touch infra/prometheus/.token-alertas
```

**Esto no es opcional y es el tropiezo más común.** Ese archivo lleva el
secreto que comparten Alertmanager y el webhook de n8n, así que está en el
`.gitignore` y **en un clon nuevo no existe**. Docker, al montar un archivo que
no está, **crea una carpeta con ese nombre**, y Alertmanager no arranca nunca.
Lo llena después `preparar-n8n.sh`.

Es la incidencia **INC-17**: un supuesto sobre el entorno que funcionaba en la
máquina donde se escribió y no en un clon limpio.

### 2.3 · Si clonás en Windows

El repositorio trae un `.gitattributes` que fuerza LF. Si tu Git ya estaba
configurado con `core.autocrlf=true` **antes** de clonar, revisá que los `.sh`
no hayan quedado con CRLF: `/bin/sh` lee `set -u\r`, no lo entiende, y el
contenedor se reinicia en bucle sin decir por qué.

---

## 3 · Levantar

Los servicios están repartidos en **siete perfiles**:

```
app   replica   monitoreo   incidencias   documental   automatizacion   tunel
```

> ⚠️ **Si escribís un perfil que no existe, Compose no avisa.** No levanta nada
> de ese perfil y sigue como si nada. Un `--profile procesos` —que no existe—
> deja Mantis, Nextcloud y n8n abajo sin un solo mensaje de error.

### 3.1 · Sólo la aplicación (lo mínimo para verla andar)

```bash
cd infra/compose
docker compose --profile app up -d --build
```

Levanta PostgreSQL, el backend, el frontend, pgAdmin y el servicio de copias.
La primera vez tarda: construye las dos imágenes.

Cuando termine: **http://127.0.0.1:8080**

### 3.2 · El laboratorio completo

```bash
cd infra/compose
docker compose \
  --profile app --profile replica \
  --profile monitoreo \
  --profile incidencias --profile documental --profile automatizacion \
  --profile tunel \
  up -d
```

Son **23 contenedores**. Sacá `--profile tunel` si no vas a publicar.

| Dónde | Qué | Perfil |
|---|---|---|
| http://127.0.0.1:8080 | La aplicación | `app` |
| http://127.0.0.1:5050 | pgAdmin | `app` |
| `127.0.0.1:5433` | PostgreSQL primario | `app` |
| `127.0.0.1:5434` | PostgreSQL réplica | `replica` |
| http://127.0.0.1:3001 | Grafana | `monitoreo` |
| http://127.0.0.1:9090 | Prometheus | `monitoreo` |
| http://127.0.0.1:9093 | Alertmanager | `monitoreo` |
| http://127.0.0.1:8089 | MantisBT | `incidencias` |
| http://127.0.0.1:8025 | Mailpit (buzón de prueba) | `incidencias` |
| http://127.0.0.1:8081 | Nextcloud | `documental` |
| http://127.0.0.1:5678 | n8n | `automatizacion` |

**El backend no publica ningún puerto.** Sólo lo alcanza nginx por la red
interna de Docker, y nginx hace de *proxy* de `/api/`. Por eso `/metrics` no es
alcanzable desde el navegador.

---

## 4 · Cargar los datos

El esquema se crea solo la primera vez. El conjunto de prueba **no**: son
6.000.000 de filas por tabla y hay que pedirlo.

```bash
docker exec -i restoya_db psql -U restoya -d restoyadb < infra/postgres/generar-dataset.sql
```

Tarda. Después, los índices y las vistas del punto 5:

```bash
docker exec -i restoya_db psql -U restoya -d restoyadb < infra/postgres/optimizacion/indices.sql
docker exec -i restoya_db psql -U restoya -d restoyadb < infra/postgres/optimizacion/vistas-materializadas.sql
```

Para comprobar que quedó:

```bash
docker exec restoya_db psql -U restoya -d restoyadb -c "SELECT count(*) FROM pedidos;"
```

Tienen que ser **6.000.000**. El procedimiento completo está en
[`docs/06-carga-datos.md`](docs/06-carga-datos.md).

---

## 5 · Preparar cada herramienta

Cada una se prepara **una sola vez** y los scripts son idempotentes: correrlos
de nuevo no duplica nada.

### 5.1 · La réplica (punto 6)

```bash
./infra/postgres/iniciar-replica.sh
```

Clona el primario y arranca el *streaming*. Comprobar:

```bash
docker exec restoya_db psql -U restoya -d restoyadb -c \
  "SELECT application_name, state, replay_lag FROM pg_stat_replication;"
```

Tiene que decir `streaming`. Detalle en [`docs/10-cluster.md`](docs/10-cluster.md).

### 5.2 · Mantis (punto 11)

```bash
./infra/incidencias/preparar-mantis.sh
node infra/incidencias/cargar-incidencias.js
```

El primero configura categorías, prioridades y cuentas, y emite el *token* de
API en `infra/incidencias/.token-api`. El segundo carga las 17 incidencias.

> Al abrir Mantis vas a ver **una sola incidencia**. No es un error: el filtro
> por defecto esconde las cerradas. Para ver las 17:
> `view_all_set.php?type=1&hide_status=-2`

### 5.3 · Nextcloud (punto 12)

```bash
./infra/documental/preparar-nextcloud.sh
```

Crea la estructura de carpetas, la cuenta de robot y la matriz de permisos, y
sube la documentación. Detalle en [`docs/13-documental.md`](docs/13-documental.md).

### 5.4 · n8n (punto 13)

```bash
./infra/automatizacion/preparar-n8n.sh
```

Genera el secreto compartido con Alertmanager —el que va en
`infra/prometheus/.token-alertas`— e importa los tres flujos.

> ⚠️ **Después hay que crear la cuenta de propietario de n8n**, entrando a
> http://127.0.0.1:5678. Hasta que exista, n8n **se la ofrece a cualquiera que
> entre**: no tiene inicio de sesión hasta que alguien la reclama. Es el
> hallazgo 15 de [`docs/09-seguridad.md`](docs/09-seguridad.md). Usá el correo y
> la clave de `N8N_EMAIL` y `N8N_PASSWORD` del `.env`.

Después hay que **reiniciar Alertmanager** para que tome el secreto:

```bash
docker compose --profile monitoreo restart alertmanager
```

### 5.5 · Publicar en Internet (punto 9)

Sólo si hace falta. Requiere una cuenta de Cloudflare **con un dominio
agregado**: sin dominio sólo se puede un túnel rápido, cuya dirección cambia en
cada arranque y no sirve para una entrega.

```bash
cloudflared tunnel login          # abre el navegador, una sola vez
```

Agregá al `.env` los cinco nombres —el de la aplicación y los cuatro de las
herramientas—, todos subdominios **de un solo nivel** de la zona que está en
Cloudflare:

```
DOMINIO_PUBLICO=restoya.midominio.com
ESQUEMA_PUBLICO=https
DOMINIO_N8N=n8n.midominio.com
DOMINIO_MANTIS=mantis.midominio.com
DOMINIO_NUBE=nube.midominio.com
DOMINIO_GRAFANA=grafana.midominio.com
```

Y después:

```bash
./infra/tunel/preparar-tunel.sh
docker compose --profile app --profile tunel up -d
```

El perfil `app` tiene que estar: el túnel sin nginx arriba devuelve 502.

El script es idempotente: si el túnel ya existe, no crea otro, y no toca
ningún otro túnel de la cuenta. Las mismas variables las lee el
`docker-compose.yml` para decirle a cada herramienta cuál es su nombre
público; si se dejan vacías, cada una vuelve a su dirección local y el túnel
no se puede preparar.

**Si Nextcloud no estaba levantado** cuando corriste el script, volvé a
correrlo después: su nombre público hay que escribirlo con `occ` adentro del
contenedor, y es el único paso que no se puede dejar en un archivo.

Procedimiento completo y el por qué de cada decisión en
[`docs/15-publicacion.md`](docs/15-publicacion.md). El paso a paso para
conseguir el dominio desde cero está en [`DOMINIO.md`](DOMINIO.md).

---

## 6 · Comprobar que quedó bien

No alcanza con que los contenedores digan `running`: uno puede estar
reiniciándose en bucle y `docker compose up -d` sale con código 0 igual.

```bash
docker compose ps --format "{{.Name}}\t{{.State}}"
```

Y pegarle a cada servicio:

```bash
for u in http://127.0.0.1:8080/ \
         http://127.0.0.1:8080/api/productos \
         http://127.0.0.1:9090/-/healthy \
         http://127.0.0.1:3001/api/health \
         http://127.0.0.1:9093/-/healthy \
         http://127.0.0.1:8089/login_page.php \
         http://127.0.0.1:8081/status.php \
         http://127.0.0.1:5678/ \
         http://127.0.0.1:5050/browser/ \
         http://127.0.0.1:8025/ ; do
  printf "%-45s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$u")"
done
```

Los diez tienen que dar **200**. Si alguno tarda, dale un minuto: Nextcloud y
Mantis son los más lentos en arrancar.

---

## 7 · Apagar

```bash
cd infra/compose

# Sólo el túnel: deja de ser alcanzable desde Internet
docker compose --profile tunel down

# Todo, conservando los datos
docker compose --profile app --profile replica --profile monitoreo \
  --profile incidencias --profile documental --profile automatizacion \
  --profile tunel down
```

> ⚠️ **`down -v` borra los volúmenes**, o sea la base entera con sus 6.000.000
> de filas, las incidencias de Mantis y los documentos de Nextcloud. Volver a
> cargar el conjunto de prueba tarda. No lo uses salvo que quieras empezar de
> cero.

**Conviene bajar el túnel apenas no se lo necesite.** Mientras esté arriba, la
aplicación es alcanzable desde Internet, y el diagnóstico **D-01** —diecinueve
endpoints sin ninguna autenticación— sigue abierto a propósito. Está explicado
en [`docs/01-descripcion.md`](docs/01-descripcion.md).

---

## 8 · La corrida del 11/11

No es una promesa de que funciona: es lo que se midió levantándolo desde
`develop`.

| Qué | Resultado |
|---|---|
| Contenedores | **23 de 23** corriendo, los siete perfiles |
| Los diez servicios de §6 | **200** los diez |
| Sitio publicado | **200**, con `CF-RAY: …-EZE` — pasó por el datacenter de Cloudflare en Ezeiza, no por un atajo local |
| Cabeceras de seguridad por el túnel | `x-content-type-options` y `x-frame-options` presentes |
| `/metrics` y `/api-docs` desde Internet | **16.695 bytes**, los mismos que `/`: devuelven el `index.html` de la SPA. No están protegidos, están **fuera del camino** |
| Replicación | `streaming`, **0 bytes atrás**, retraso **0** |
| La réplica rechaza escrituras | `ERROR: cannot execute INSERT in a read-only transaction` |
| Filas | `pedidos`, `detalle_pedidos` y `pagos`: **6.000.000** exactos cada una |
| Destinos de Prometheus | **6 de 6 en UP** |

---

## 9 · Lo que sale mal, y qué es

Los que ya pasaron. Están acá para que no cuesten una tarde otra vez.

| Síntoma | Qué es |
|---|---|
| **Alertmanager no arranca** y hay una *carpeta* llamada `.token-alertas` | No se creó el archivo antes de levantar (§2.2). Borrá la carpeta, `touch` el archivo y volvé a levantar |
| **`required variable X is missing a value`** al levantar cualquier perfil | Falta una variable en el `.env`. Compose **interpola el archivo entero** sin mirar los perfiles, así que una variable de Mantis puede hacer fallar el perfil `app`. Completá el `.env` entero |
| **Un contenedor se reinicia en bucle** y no dice nada | Casi siempre CRLF en un `.sh` (§2.3). `docker logs <contenedor>` lo confirma |
| **nginx devuelve 502** después de recrear el backend | Ya está arreglado: nginx resolvía el nombre `backend` una sola vez. Si vuelve a pasar, `docker compose restart frontend` |
| **Mantis muestra una incidencia de 17** | El filtro por defecto esconde las cerradas (§5.2) |
| **Grafana muestra paneles en negro** | Sólo dibuja los que entran en pantalla. Hay que desplazar, o agrandar la ventana |
| **El motor de Docker se cae** y se lleva los 23 contenedores | Pasó tres veces el 11/11. Abrir Docker Desktop y volver a levantar: los datos están en los volúmenes y la réplica **retoma el *streaming* sola**, sin volver a clonar |
| **`ports are not available: … bind: An attempt was made to access a socket in a way forbidden by its access permissions`** | **No es Docker ni el proyecto: Windows se reservó ese puerto.** Hyper-V se queda con rangos dinámicos al arrancar, y después de un reinicio pueden caer encima de un puerto del `.env`. Pasó el 14/11 con el **5433**. Mirá los rangos con `netsh interface ipv4 show excludedportrange protocol=tcp`; si tu puerto cae adentro de uno, cambiá el valor en el `.env` (`DB_PORT_HOST=5533`, por ejemplo) y volvé a levantar. **No hace falta tocar nada más**: adentro de la red de Docker la base sigue en el 5432, así que pgAdmin, el backend y la réplica no se enteran — lo único que cambia es por qué puerto la alcanzás desde Windows. **Volvió a pasar el 16/11, esta vez con el `5050` de pgAdmin** (se movió a `PGADMIN_PORT=5150`), y ahí se vio que la explicación de arriba estaba incompleta: ese puerto **no figuraba** en la lista de rangos excluidos. La causa de fondo es otra: el rango dinámico de Windows arranca en el **1024** en vez del 49152 de fábrica (`netsh int ipv4 show dynamicport tcp`), así que el sistema puede quedarse con cualquier puerto para una conexión saliente cualquiera. Para confirmar que no es culpa de Docker, probá abrirlo con otra cosa: `node -e "require('net').createServer().listen(5050,'127.0.0.1')"`. Si también dice `EACCES`, es Windows. El arreglo permanente, como administrador y reiniciando después: `netsh int ipv4 set dynamicport tcp start=49152 num=16384` |

Si algo no está acá, el informe del punto correspondiente tiene su propia
sección de limitaciones. El índice está en [`docs/README.md`](docs/README.md).
