# Infraestructura

Todo lo que no es código de la aplicación: contenedores, base de datos,
monitoreo y automatización. Cada carpeta tiene dueño.

| Carpeta | Qué va adentro | Frente |
|---|---|---|
| `compose/` | `docker-compose.yml` y los `.env.example` de cada servicio | 1 y 3 |
| `postgres/` | Script del dataset, migraciones, índices, configuración de replicación, backups | 1 y 2 |
| `monitoreo/` | Prometheus, Grafana, exportadores, reglas de alerta | 4 |
| `n8n/` | Flujos exportados en JSON y su documentación | 5 |

## Lo que nunca va acá

- Archivos `.env` con valores reales. Sólo `.env.example` con valores de mentira.
- Volcados de la base (`*.sql`, `*.dump`). El `.gitignore` los bloquea, salvo los
  scripts de esquema y migración que viven en `postgres/`.
- Copias de seguridad. Van al volumen de Docker y a Nextcloud.

## Puertos tomados en la notebook

Al armar el `docker-compose.yml`, tener en cuenta que estos ya están en uso por
los contenedores de los TPs anteriores:

| Puerto | Quién lo usa |
|---|---|
| 5432 | `n8n_postgres` |
| 5678 | `n8n` |
| 80 | `nginx_frontend` |
| 6333 | `n8n_qdrant` |

La base de este proyecto está publicada en **5433** para no chocar con la de n8n.
