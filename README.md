# TP Integrador HIA 2026 — Grupo 12

Práctica Integradora Final de **Herramientas Informáticas Avanzadas**, Analista
Programador Universitario, Facultad de Ingeniería — UNJu.

La aplicación es **RestoYa**, un sistema de restaurante y delivery desarrollado
previamente para la cátedra Programación y Servicios Web. Este repositorio la
toma como punto de partida y agrega todo lo que pide la consigna:
contenedores, optimización de base de datos, replicación, CI/CD, publicación,
monitoreo, gestión de incidencias, automatización y seguridad.

## Qué hay acá

```
backend/     API REST en Node.js + Express + Sequelize (PostgreSQL)
frontend/    SPA en Angular 21
infra/       Docker, base de datos, monitoreo y automatización
docs/        Documentación técnica obligatoria (los 16 ítems del punto 15)
```

`backend/` y `frontend/` se importaron con `git subtree` desde los repositorios
originales, así que **el historial de commits de los dos está completo** en este
repositorio. No son submódulos: se editan como carpetas normales.

## Cómo levantarlo hoy

> **El manual de instalación completo está en [`INSTALACION.md`](INSTALACION.md)**:
> requisitos, qué poner en el `.env`, cómo levantar los siete perfiles, cómo
> preparar cada herramienta, cómo comprobar que quedó bien y qué hacer cuando
> algo no arranca. Lo de acá abajo es el atajo.

```bash
cd infra/compose
cp .env.example .env     # completar las claves

# Alertmanager monta este archivo (lleva el secreto que comparte con el
# webhook de n8n del punto 13) y esta en el .gitignore, asi que en un clon
# nuevo NO existe. Hay que crearlo antes: si no, Docker monta un archivo que
# no esta y crea una CARPETA con ese nombre, y Alertmanager no arranca. Lo
# llena despues infra/automatizacion/preparar-n8n.sh.
touch ../prometheus/.token-alertas

docker compose --profile app --profile monitoreo up -d --build
```

> El `touch` de ahí arriba no es un detalle: es la incidencia **INC-17**, un
> supuesto sobre el entorno que funcionaba en la máquina donde se escribió y no
> en un clon limpio. Por eso está escrito acá y no sólo en la cabeza de alguien.

| Dónde | Qué |
|---|---|
| http://127.0.0.1:8080 | La aplicación (nginx sirve el frente y hace de *proxy* de `/api`) |
| http://127.0.0.1:5050 | pgAdmin |
| http://127.0.0.1:3001 | Grafana |
| http://127.0.0.1:9090 | Prometheus |
| http://127.0.0.1:9093 | Alertmanager |

Las herramientas de los puntos 11, 12 y 13 tienen cada una su perfil, porque
no hacen falta para programar y levantarlas todas junta son trece contenedores
mas:

| Perfil | Qué levanta | Dónde queda |
|---|---|---|
| `--profile replica` | Réplica de PostgreSQL + su exportador (punto 6) | `127.0.0.1:5434` |
| `--profile incidencias` | MantisBT + MariaDB + Mailpit (punto 11) | [:8089](http://127.0.0.1:8089) y el buzón en [:8025](http://127.0.0.1:8025) |
| `--profile documental` | Nextcloud + PostgreSQL + Redis (punto 12) | [:8081](http://127.0.0.1:8081) |
| `--profile automatizacion` | n8n + PostgreSQL (punto 13) | [:5678](http://127.0.0.1:5678) |

Cada una se prepara una sola vez:

```bash
./infra/incidencias/preparar-mantis.sh && node infra/incidencias/cargar-incidencias.js
```

```bash
./infra/documental/preparar-nextcloud.sh
```

Los flujos de n8n se importan a mano desde su interfaz; está explicado en
[`docs/14-automatizacion.md`](docs/14-automatizacion.md).

**Todos los puertos salen sólo a `127.0.0.1`.** Desde otra máquina de la red
no se llega a ninguno.

Los perfiles son independientes: `up -d` solo levanta la base, pgAdmin y las
copias; `--profile app` agrega la aplicación; `--profile monitoreo` agrega
Prometheus, Grafana y los exportadores.

**El backend no publica ningún puerto.** Sólo lo alcanza nginx por la red
interna. Si querés pegarle directo, es desde adentro de la red de Docker.

Para programar con recarga en caliente, se levanta sólo el stack de datos
(`docker compose up -d`, sin `--profile app`) y el backend y el frontend se
corren fuera del contenedor:

```bash
cd backend && cp .env.example .env && npm install && npm start
```

```bash
cd frontend && npm install && npm start
```

No hace falta editar nada para pasar de un modo al otro: la URL de la API sale
de `src/environments/`, y Angular reemplaza el archivo al compilar para
despliegue.

### Si clonás en Windows, leé esto

El repositorio trae un `.gitattributes` que fuerza finales de línea LF en todo
lo que se ejecuta dentro de un contenedor. **No lo saques.** Sin él, Git en
Windows baja los `.sh` con CRLF, y el shell del contenedor falla así:

```
/backup.sh: set: line 7: illegal option -
```

El servicio de copias queda reiniciándose en bucle y en Git el archivo se ve
perfecto, porque el destrozo lo hace el *checkout*. Si te pasa, revisá que el
archivo esté en LF antes de buscar en otro lado.

## Ramas

| Rama | Para qué |
|---|---|
| `main` | Versión estable. Protegida: sólo recibe *merges* desde `develop`. |
| `develop` | Integración. De acá sale y vuelve todo el trabajo. |
| `feature/*` | Una por tarea del tablero. |
| `fix/*` | Correcciones. |

Hay una rama abierta por frente de trabajo:

| Rama | Frente | Puntos de la consigna |
|---|---|---|
| `feature/1-base-de-datos` | Base de datos en Docker y dataset | 4 |
| `feature/2-sql-replicacion` | Optimización y replicación | 5 y 6 |
| `feature/3-app-cicd` | App contenerizada y CI/CD | 7 y 8 |
| `feature/4-tunel-monitoreo` | Publicación y monitoreo | 9 y 10 |
| `feature/5-procesos` | Scrum, incidencias, Nextcloud y n8n | 2, 11, 12 y 13 |

Las ramas por frente son el punto de partida, no la unidad de trabajo. Lo
correcto es cortar una rama por **tarea del tablero** desde `develop`:

```bash
git switch develop && git pull
git switch -c feature/compose-postgres
```

Una rama por persona es justamente lo que la consigna no quiere: pide ramas por
propósito, commits vinculados a las tareas y pull requests revisados. Los
repositorios originales tenían una rama por integrante y las siete terminaron
muertas, sin un solo commit propio.

### Flujo de trabajo

1. Cortar `feature/<tarea>` desde `develop`.
2. Commits descriptivos, en formato `tipo: descripción`, mencionando la tarea
   del tablero.
3. Pull request contra `develop`, revisado por **otro integrante**.
4. `develop` se integra a `main` en los cierres de sprint.

Nadie commitea directo a `main`.

## Administración del repositorio

El repositorio es público y `main` está protegida: exige pull request con una
aprobación y bloquea el borrado y el *force push*. La configuración está
versionada en `.github/ruleset-main.json`, así que se puede volver a aplicar con:

```bash
gh api -X POST repos/prieto555/tp-integrador-hia-grupo12/rulesets --input .github/ruleset-main.json
```

Se comprobó intentando un push directo a `main`:

```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Changes must be made through a pull request.
 ! [remote rejected] main -> main (push declined due to repository rule violations)
```

### Lo que falta

**Agregar a los otros cuatro integrantes** como colaboradores con permiso de
escritura, en *Settings → Collaborators*.

Una consecuencia de la regla: nadie puede aprobar su propio pull request. Hasta
que estén todos cargados no hay forma de integrar nada a `main` sin desactivar
el *ruleset* un rato.

## Reglas que no se negocian

- **Ningún secreto al repositorio.** Ni `.env`, ni tokens, ni claves. Las
  plantillas van en `.env.example` con valores de mentira.
- **Ningún volcado de la base.** Los 6.000.000 de registros se generan con el
  script de `infra/postgres/`; no se pasan como archivo. Las copias de seguridad
  van al volumen y a Nextcloud.
- **Ningún dato personal real.** Si se migran datos de producción, se anonimizan
  antes.

## Integrantes

Grupo 12 — Herramientas Informáticas Avanzadas, FI-UNJu, 2026.

| Integrante | LU |
|---|---|
| Aramayo, Gerardo Leonel | 4082 |
| Armella, Julián Enrique | 5435 |
| Cruz, Florencia Agustina | 6810 |
| Pol, Jaime Facundo | 5937 |
| Prieto, Gabriel Arturo | 5486 |

### Reparto de frentes

**Sin asignar todavía.** Se acuerda entre los cinco, no lo decide el
repositorio. Cada uno trabaja en su rama y abre un *pull request* a
`develop`.

| Frente | Rama | Responsable |
|---|---|---|
| 1 · Base de datos | `feature/1-base-de-datos` | *a definir* |
| 2 · SQL y replicación | `feature/2-sql-replicacion` | *a definir* |
| 3 · App y CI/CD | `feature/3-app-cicd` | *a definir* |
| 4 · Túnel y monitoreo | `feature/4-tunel-monitoreo` | *a definir* |
| 5 · Procesos y automatización | `feature/5-procesos` | *a definir* |

> **El repositorio se renombró.** Se había creado como
> `tp-integrador-hia-grupo13`, antes de confirmar el número de grupo, y el
> 10/11 pasó a **`tp-integrador-hia-grupo12`**. Si lo clonaste antes, no
> hace falta que hagas nada: GitHub redirige la dirección vieja. Igual
> conviene actualizar el remoto, porque la redirección no es para siempre:
>
> ```bash
> git remote set-url origin https://github.com/prieto555/tp-integrador-hia-grupo12.git
> ```
>
> Los nombres `proybackendgrupo13` y `proyfrontendgrupo13` **no** se
> cambiaron, y es a propósito: vienen de la aplicación original de
> Programación y Servicios Web, donde el grupo sí era el 13. Tocarlos
> significa cambiar `angular.json`, las rutas de compilación y el
> `Dockerfile`, y no aporta nada a este trabajo.

## Repositorios de origen

- Backend: https://github.com/mauriciozalazar29/proybackendgrupo13
- Frontend: https://github.com/mauriciozalazar29/proyfrontendgrupo13
