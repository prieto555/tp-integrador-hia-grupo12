# TP Integrador HIA 2026 — Grupo 13

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

Todavía no hay `docker-compose.yml` — es la primera tarea del frente 1. Mientras
tanto, el entorno mínimo para desarrollar:

```bash
docker run -d --name restoya_db \
  -e POSTGRES_DB=restoyadb -e POSTGRES_USER=restoya -e POSTGRES_PASSWORD=cambiar \
  -p 5433:5432 -v restoya_pgdata:/var/lib/postgresql/data postgres:16-alpine
```

```bash
cd backend && cp .env.example .env && npm install && npm start
```

```bash
cd frontend && npm install && npm start
```

El backend queda en `http://localhost:3000` (Swagger en `/api-docs`) y el
frontend en `http://localhost:4200`.

### Dos cosas que hay que arreglar antes de que esto funcione de punta a punta

1. **El frontend apunta a Render, no a tu backend local.** La URL está escrita a
   mano en 13 archivos de `frontend/src/app/`. Sacarla a un archivo de entorno es
   la primera tarea de `feature/3-app-cicd` (y es el punto 7.5 de la consigna:
   separar configuración de desarrollo y de despliegue).
2. **`backend/index.js` arranca con `sequelize.sync({ alter: true })`,** que
   reescribe el esquema en cada arranque. Contra una base compartida le pisa el
   esquema al resto, y con el dataset de 6.000.000 de filas es directamente
   inviable. Pasarlo a migraciones es tarea de `feature/1-base-de-datos`.

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
gh api -X POST repos/prieto555/tp-integrador-hia-grupo13/rulesets --input .github/ruleset-main.json
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

| Integrante | Frente | Rama |
|---|---|---|
|  | 1 · Base de datos | `feature/1-base-de-datos` |
|  | 2 · SQL y replicación | `feature/2-sql-replicacion` |
|  | 3 · App y CI/CD | `feature/3-app-cicd` |
|  | 4 · Túnel y monitoreo | `feature/4-tunel-monitoreo` |
|  | 5 · Procesos y automatización | `feature/5-procesos` |

## Repositorios de origen

- Backend: https://github.com/mauriciozalazar29/proybackendgrupo13
- Frontend: https://github.com/mauriciozalazar29/proyfrontendgrupo13
