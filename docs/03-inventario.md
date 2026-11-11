# Inventario tecnológico

Entregable del punto 15.3. Cubre la tarea E1-03 del backlog, cuyo criterio de
aceptación es literal: **versiones de `npm ls`, no rangos de `package.json`**.

El motivo de esa exigencia: `"express": "^5.2.1"` no es una versión, es una
familia. Dentro de ese `^` entran todas las 5.x futuras. Dos personas que
instalen el mismo `package.json` con una semana de diferencia pueden terminar
con dependencias distintas, y entonces "en mi máquina anda" deja de ser una
broma y pasa a ser una descripción correcta del problema.

Las columnas de este documento, entonces, son dos: **lo que el `package.json`
pide** y **lo que realmente está instalado**. La segunda es la que vale.

> **De dónde salen estos números.** Las versiones exactas se leyeron del
> `package-lock.json` (lockfileVersion 3) de cada proyecto, que es la misma
> fuente de verdad que usa `npm ci` —el comando que corre en los Dockerfiles y
> en el CI— y no del árbol `node_modules` de esta máquina, que podría estar
> desactualizado respecto del *lock*. Los dos *locks* están versionados en el
> repositorio.

---

## 1 · El entorno de la máquina

Medido el 2026-11-10, en la notebook donde se hizo el trabajo.

| Herramienta | Versión | Cómo se midió |
|---|---|---|
| Windows | 11 Pro, 10.0.26300 | — |
| Docker Engine | **29.7.2** (build `a7dcaa6`) | `docker --version` |
| Docker Compose | **5.5.1** | `docker compose version --short` |
| Node.js (host) | **24.19.0** | `node --version` |
| npm | **11.17.0** | `npm --version` |
| Git | **2.55.0.windows.3** | `git --version` |

El resto del entorno de la máquina (hipervisor, VBS, WSL2) está en el
`CLAUDE.md` del proyecto de la carrera y no se repite acá.

---

## 2 · Backend — Node.js + Express

`backend/package.json`. **20 paquetes directos**: 19 de producción y 1 de
desarrollo.

| Paquete | Pide | **Instalado** | Para qué |
|---|---|---|---|
| `express` | `^5.2.1` | **5.2.1** | el servidor HTTP |
| `sequelize` | `^6.37.8` | **6.37.8** | ORM |
| `pg` | `^8.22.0` | **8.22.0** | driver de PostgreSQL |
| `pg-hstore` | `^2.3.4` | **2.3.4** | serializa `hstore` para Sequelize |
| `jsonwebtoken` | `^9.0.3` | **9.0.3** | firma y verifica los *tokens* |
| `bcryptjs` | `^3.0.3` | **3.0.3** | hash de contraseñas |
| `helmet` | `^8.2.0` | **8.2.0** | cabeceras de seguridad |
| `cors` | `^2.8.6` | **2.8.6** | control de origen cruzado |
| `express-rate-limit` | `^8.5.2` | **8.5.2** | los tres limitadores |
| `express-validator` | `^7.3.2` | **7.3.2** | validación de entrada |
| `dotenv` | `^17.4.2` | **17.4.2** | lee el `.env` |
| `prom-client` | `^15.1.3` | **15.1.3** | métricas para Prometheus (punto 10) |
| `swagger-jsdoc` | `^6.3.0` | **6.3.0** | genera el OpenAPI desde los comentarios |
| `swagger-ui-express` | `^5.0.1` | **5.0.1** | sirve `/api-docs` |
| `google-auth-library` | `^10.9.0` | **10.9.0** | login con Google |
| `mercadopago` | `^3.2.0` | **3.2.0** | cobros |
| `nodemailer` | `^10.4.0` | **10.4.0** | correos |
| `exceljs` | `^4.4.0` | **4.4.0** | reporte de caja en Excel |
| `pdfkit` | `^0.19.1` | **0.19.1** | reporte de caja en PDF |
| `nodemon` *(dev)* | `^3.1.14` | **3.1.14** | recarga en desarrollo |

Hay dos paquetes cuya presencia conviene anotar porque **no son del alcance de
este trabajo y traen dependencias de afuera**: `mercadopago` y
`google-auth-library` hablan con servicios de terceros, y `swagger-ui-express`
arrastra `@scarf/scarf`, que avisa a su propio servidor al instalarse. Eso
último está documentado en [`09-seguridad.md`](09-seguridad.md) como hallazgo
10.

---

## 3 · Frontend — Angular

`frontend/package.json`. **21 paquetes directos**: 13 de producción y 8 de
desarrollo.

Acá la diferencia entre lo que se pide y lo que está instalado **sí aparece**,
que es justamente de lo que avisa el criterio de aceptación:

| Paquete | Pide | **Instalado** | ¿Coincide? |
|---|---|---|---|
| `@angular/core` | `^21.2.26` | **21.2.26** | sí |
| `@angular/common` | `^21.2.26` | **21.2.26** | sí |
| `@angular/compiler` | `^21.2.26` | **21.2.26** | sí |
| `@angular/forms` | `^21.2.26` | **21.2.26** | sí |
| `@angular/platform-browser` | `^21.2.26` | **21.2.26** | sí |
| `@angular/router` | `^21.2.26` | **21.2.26** | sí |
| `@angular/cdk` | `^21.2.0` | **21.2.14** | **no: 14 parches más** |
| `rxjs` | `~7.8.0` | **7.8.2** | **no** |
| `zone.js` | `^0.16.2` | **0.16.2** | sí |
| `bootstrap` | `^5.3.8` | **5.3.8** | sí |
| `chart.js` | `^4.5.1` | **4.5.1** | sí |
| `ng2-charts` | `^10.0.0` | **10.0.0** | sí |
| `sweetalert2` | `^11.26.25` | **11.26.25** | sí |
| `@abacritt/angularx-social-login` | `^2.6.0` | **2.6.0** | sí |
| `tslib` | `^2.3.0` | **2.8.1** | **no: cinco menores más** |

Y en desarrollo:

| Paquete | Pide | **Instalado** |
|---|---|---|
| `@angular/cli` | `^21.2.29` | **21.2.29** |
| `@angular/build` | `^21.2.29` | **21.2.29** |
| `@angular/compiler-cli` | `^21.2.26` | **21.2.26** |
| `typescript` | `~5.9.2` | **5.9.3** |
| `vitest` | `^4.0.8` | **4.1.12** |
| `jsdom` | `^28.0.0` | **28.1.0** |
| `prettier` | `^3.8.1` | **3.8.4** |

Siete de veintiún paquetes tienen instalada una versión distinta de la que el
`package.json` nombra. Ninguna rompe nada hoy, y eso es exactamente lo
incómodo del asunto: **no se nota hasta que se nota**. Lo que protege acá es el
`package-lock.json` versionado más `npm ci` en lugar de `npm install`, que es
lo que hacen los dos Dockerfiles y el CI.

> `vitest` y `jsdom` están instalados y configurados, pero **no hay tests
> escritos** más allá del `app.spec.ts` que genera el CLI. Figura como hallazgo
> D-07 en [`01-descripcion.md`](01-descripcion.md).

---

## 4 · Imágenes de contenedor

`infra/compose/docker-compose.yml`. **Catorce imágenes distintas** para
veintitrés servicios (PostgreSQL 16 se usa cinco veces: la base, la réplica, el
contenedor de copias, y las bases de Nextcloud y n8n).

| Servicio | Imagen | Fijada a |
|---|---|---|
| `db`, `db-replica`, `backup`, `nextcloud-db`, `n8n-db` | `postgres:16-alpine` | **sólo la mayor** |
| `pgadmin` | `dpage/pgadmin4:9.8` | menor |
| `frontend` (runtime) | `nginx:1.29-alpine` | **sólo menor** |
| `receptor-alertas` | `nginx:1.29-alpine` | **sólo menor** |
| `backend` / `frontend` (build) | `node:24-alpine` | **sólo la mayor** |
| `prometheus` | `prom/prometheus:v3.1.0` | parche |
| `alertmanager` | `prom/alertmanager:v0.27.0` | parche |
| `node-exporter` | `prom/node-exporter:v1.8.2` | parche |
| `cadvisor` | `gcr.io/cadvisor/cadvisor:v0.49.1` | parche |
| `postgres-exporter` (×2) | `prometheuscommunity/postgres-exporter:v0.16.0` | parche |
| `grafana` | `grafana/grafana:11.4.0` | parche |
| `mantis-db` | `mariadb:11.4` | **sólo menor** |
| `mantis` | `xlrl/mantisbt:2.28.4` | parche |
| `mantis-mail` | `axllent/mailpit:v1.21` | menor |
| `nextcloud-redis` | `redis:7-alpine` | **sólo la mayor** |
| `nextcloud` | `nextcloud:30-apache` | **sólo la mayor** |
| `n8n` | `n8nio/n8n:1.70.1` | parche |
| `cloudflared` | `cloudflare/cloudflared:2026.10.7` | parche |

### Lo que esta tabla deja a la vista

Hay **dos criterios distintos** conviviendo, y conviene decirlo antes de que lo
pregunten:

- Las imágenes que se eligieron para los puntos de este trabajo (monitoreo,
  Mantis, n8n, el túnel) están fijadas al **parche**: `v3.1.0`, `1.70.1`,
  `2.28.4`. Dos personas que levanten el proyecto bajan el mismo *byte*.
- Las imágenes que venían de antes o son de base (`postgres:16-alpine`,
  `node:24-alpine`, `redis:7-alpine`, `nextcloud:30-apache`, `mariadb:11.4`)
  están fijadas a la mayor o a la menor. Eso significa que **un `docker compose
  pull` dentro de un mes puede traer otra versión del motor de base de datos**
  sin que nada en el repositorio cambie.

Fijar `postgres:16-alpine` al parche haría el entorno completamente
reproducible, y tiene un costo: deja de recibir los parches de seguridad del
sistema base de Alpine, que es justamente lo que obligó a subir nginx de 1.27 a
1.29 en el punto 14 (3 vulnerabilidades críticas y 64 altas, ninguna del código
del proyecto). La forma correcta de tener las dos cosas es **fijar por digest y
actualizar con Renovate o Dependabot**, que avisa y abre el *pull request*. No
está hecho, y queda anotado acá y en [`16-limitaciones.md`](16-limitaciones.md).

---

## 5 · Una inconsistencia real: Node 22 en el CI, Node 24 en las imágenes

Vale la pena que figure en el inventario, porque es exactamente el tipo de cosa
que un inventario sirve para encontrar:

| Dónde | Versión de Node |
|---|---|
| `backend/Dockerfile` (deps y runtime) | **24**-alpine |
| `frontend/Dockerfile` (build) | **24**-alpine |
| `.github/workflows/ci.yml` (`setup-node`) | **22** |
| Esta máquina | **24.19.0** |

Es decir: **el CI instala las dependencias y corre las comprobaciones con una
versión mayor de Node distinta de la que después corre en el contenedor.** No
rompió nada hasta hoy, y puede romper: `npm ci` resuelve dependencias
opcionales por plataforma y versión, y los paquetes nativos se compilan contra
el ABI del Node que los instala.

El arreglo es cambiar un `"22"` por `"24"` en el *workflow*. No se hizo en este
documento a propósito: toca el CI, que **acaba de volver a verde** con el PR que
agrega las variables de los perfiles nuevos, y mezclar dos cambios en el mismo
*pull request* es cómo se pierde la trazabilidad de cuál rompió qué. Queda como
tarjeta.

---

## 6 · Acciones de GitHub usadas en el pipeline

`.github/workflows/`. Todas fijadas a la mayor, que es la práctica que
recomienda GitHub (reciben parches de seguridad sin cambiar la interfaz):

| Acción | Versión |
|---|---|
| `actions/checkout` | `v4` |
| `actions/setup-node` | `v4` |
| `actions/upload-artifact` | `v4` |
| `docker/setup-buildx-action` | `v3` |
| `docker/login-action` | `v3` |
| `docker/build-push-action` | `v6` |
| `aquasecurity/trivy-action` | `0.28.0` |

`trivy-action` es la única fijada al parche, y a propósito: es la que decide si
el pipeline falla por vulnerabilidades. Que cambie de criterio sola, sin que
nadie lo pida, convertiría un pipeline verde en rojo —o peor, uno rojo en
verde— sin ningún cambio en el código.

---

## 7 · Registro de imágenes

Las imágenes del backend y del frontend se publican en **GitHub Container
Registry**:

```
ghcr.io/prieto555/tp-integrador-hia-grupo12/backend:<SHA del commit>
ghcr.io/prieto555/tp-integrador-hia-grupo12/frontend:<SHA del commit>
```

Etiquetadas con el SHA, nunca con `latest`. El porqué está en
[`02-arquitectura.md`](02-arquitectura.md), sección 6.

> **Todavía no hay ninguna imagen publicada.** El *job* que publica depende de
> que el CI pase, y el CI estuvo en rojo hasta el *pull request* que agrega las
> variables de los perfiles nuevos. Está anotado en
> [`16-limitaciones.md`](16-limitaciones.md).

---

## 8 · Qué queda afuera de este inventario

- **Las dependencias transitivas.** Son miles, y el que las fija es el
  `package-lock.json`, no una tabla escrita a mano que se desactualiza en el
  primer `npm install`. Lo que importa de ellas —las vulnerabilidades— está en
  [`09-seguridad.md`](09-seguridad.md), con el `npm audit` corrido y su salida.
- **Los digests de las imágenes.** Es el único identificador verdaderamente
  exacto (`postgres@sha256:…`), y el que haría el entorno reproducible de
  verdad. No están porque hoy las etiquetas son flotantes, y anotar un digest
  que la etiqueta puede dejar de apuntar sería peor que no anotarlo.
- **Las versiones de los paquetes del sistema dentro de las imágenes**
  (OpenSSL, zlib, glibc/musl). Las fija la imagen base. El escaneo de Trivy del
  punto 14 es el que las audita.

---

## Referencias

- Qué hace cada cosa: [`01-descripcion.md`](01-descripcion.md)
- Cómo se conectan: [`02-arquitectura.md`](02-arquitectura.md)
- Los Dockerfiles, etapa por etapa: [`05-docker.md`](05-docker.md)
- `npm audit` y Trivy, con salida: [`09-seguridad.md`](09-seguridad.md)
- El pipeline: [`11-cicd.md`](11-cicd.md)
