# Configuración Docker

Entregable del punto 15.5. Cubre los puntos 4 y 7 de la consigna.

## Los cinco servicios

Todos en la red interna `restoya_interna`, definidos en
`infra/compose/docker-compose.yml`.

| Servicio | Imagen | Puerto en el host | Perfil |
|---|---|---|---|
| `db` | `postgres:16-alpine` | `127.0.0.1:5433` | siempre |
| `pgadmin` | `dpage/pgadmin4:9.8` | `127.0.0.1:5050` | siempre |
| `backup` | `postgres:16-alpine` | ninguno | siempre |
| `backend` | construida acá | **ninguno** | `app` |
| `frontend` | construida acá | `127.0.0.1:8080` | `app` |

## Dos perfiles, dos formas de trabajar

```bash
docker compose up -d
```

Levanta sólo el stack de datos. El backend y el frontend se corren fuera del
contenedor, con recarga en caliente. Es el modo para programar.

```bash
docker compose --profile app up -d --build
```

Levanta todo adentro, como va a correr en la demostración. Es el modo para
probar que el despliegue funciona de verdad.

La separación responde al punto 7.5, "separar las configuraciones de
desarrollo y despliegue": no hay que editar ningún archivo para pasar de una a
otra.

## Decisiones de red

**Ningún servicio escucha en `0.0.0.0`.** Todos los puertos publicados están
atados a `127.0.0.1`. Con el valor habitual, la base escucharía en todas las
interfaces de la máquina: la WiFi de casa y cualquier túnel que se abra
después. Esto resuelve de antemano el punto 9.5.

**El backend no publica ningún puerto.** Sólo lo alcanza nginx, por la red
interna. Desde afuera de Docker la API no existe: no hay forma de saltearse el
*proxy*.

**nginx hace de proxy de `/api`.** El navegador habla con un solo origen, el
del frontend. Dos consecuencias: en producción no hay CORS que configurar, y
la imagen del frontend no lleva ninguna dirección adentro, así que la misma
imagen sirve en cualquier entorno.

## Decisiones de las imágenes

Las dos son **multi-etapa**. La de compilación trae el compilador y las
dependencias de desarrollo; la final sólo lo necesario para correr.

En el frontend la diferencia es grande: Node desaparece de la imagen final y
queda sólo nginx con los archivos estáticos, de más de un gigabyte a unas
decenas de megas. Y lo que no está en la imagen no se puede explotar.

**El backend corre como usuario `node`, no como root.** La imagen oficial ya
trae ese usuario. Correr como root dentro de un contenedor es innecesario y es
de lo primero que marca cualquier escaneo de seguridad.

**`npm ci`, no `npm install`.** `ci` respeta el `package-lock.json` exacto;
`install` puede traer versiones distintas a las que se probaron, que es
justamente lo que el inventario tecnológico del punto 1 intenta fijar.

**`dumb-init` como PID 1 en el backend.** Node no reenvía `SIGTERM` a sus
hijos: sin esto, cada `docker compose down` espera diez segundos y mata el
proceso a la fuerza.

**Ningún `.env` entra en las imágenes.** Están excluidos por `.dockerignore` y
las variables se inyectan al correr. Una imagen con secretos adentro es una
imagen que no se puede publicar en un registro, y el punto 8 pide publicarlas.

**`healthcheck` en los tres servicios que lo admiten.** `depends_on` con
`condition: service_healthy` hace que el backend espere a que PostgreSQL
acepte conexiones de verdad, no sólo a que el contenedor exista.

## Persistencia

| Volumen | Qué guarda |
|---|---|
| `restoya_pgdata` | Los datos de PostgreSQL |
| `restoya_pgadmin_data` | La configuración de pgAdmin |
| `./backups` (montaje) | Las copias y su bitácora |

El volumen de la base se declara **`external`**: existía antes que el compose,
creado a mano, y declararlo externo hizo que compose lo adoptara en vez de
crear uno vacío. De ahí sale la evidencia del punto 4.8.

```bash
docker compose down
docker compose up -d
docker exec restoya_db psql -U restoya -d restoyadb -c "select count(*) from pedidos;"
```

Seis millones, después de destruir y recrear los contenedores.

## Puertos ocupados en la notebook

Al elegir los puertos hubo que esquivar los contenedores de TPs anteriores:

| Puerto | Quién lo usa |
|---|---|
| 5432 | `n8n_postgres` |
| 5678 | `n8n` |
| 80 | `nginx_frontend` |
| 6333 | `n8n_qdrant` |

Por eso la base está en **5433** y el frontend en **8080**.

## Lo que falta

- **El backend todavía corre `sequelize.sync({ alter: true })` al arrancar.**
  Contenerizarlo no arregla eso; al contrario, con varias réplicas sería peor.
  Es la tarea E4-05.
- **No hay límites de CPU ni memoria** por servicio.
- **Las imágenes no están publicadas en un registro**: se construyen en la
  máquina. Eso es parte del punto 8.
