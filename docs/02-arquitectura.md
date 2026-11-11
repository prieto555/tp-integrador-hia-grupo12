# Arquitectura general

Entregable del punto 15.2. Cubre la tarea E1-04 del backlog, cuyo criterio de
aceptación es explícito: el diagrama tiene que **mostrar qué se contenedoriza y
qué queda afuera**.

Todo lo que está acá sale de `infra/compose/docker-compose.yml`, con el número
de línea para contrastarlo.

---

## 1 · De un vistazo

**Veintitrés servicios, cuatro redes, once volúmenes.** No corren todos juntos:
cada herramienta tiene su perfil de Compose y se levanta sólo cuando se la
necesita.

```
                          INTERNET
                              │
                              │ HTTPS (certificado de Cloudflare)
                              ▼
                     ┌────────────────────┐
                     │  Red de Cloudflare │
                     └────────┬───────────┘
                              │ túnel cifrado, saliente
┌─ LA MÁQUINA ────────────────┼──────────────────────────────────────────────┐
│                             ▼                                              │
│                   ┌──────────────────┐   perfil: tunel                     │
│                   │   cloudflared    │                                     │
│                   └────────┬─────────┘                                     │
│  ╔═══ red interna ═════════▼══════════════════════════════════════════════╗ │
│  ║                ┌──────────────────┐   perfil: app                      ║ │
│  ║   :8080 ──────▶│ frontend (nginx) │  sirve la SPA + proxy de /api/      ║ │
│  ║                └────────┬─────────┘                                    ║ │
│  ║                         │ http://backend:3000  (sin puerto publicado)   ║ │
│  ║                         ▼                                              ║ │
│  ║                ┌──────────────────┐   perfil: app                      ║ │
│  ║                │ backend (Node)   │  Express + Sequelize                ║ │
│  ║                └───┬──────────┬───┘                                    ║ │
│  ║         escrituras │          │ lecturas del tablero histórico         ║ │
│  ║                    ▼          ▼                                        ║ │
│  ║         ┌────────────────┐  ┌──────────────────┐  perfil: replica      ║ │
│  ║  :5433─▶│ db (primario)  │─▶│ db-replica       │◀─:5434                ║ │
│  ║         │ PostgreSQL 16  │  │ streaming async  │                       ║ │
│  ║         └───┬────────┬───┘  └────────┬─────────┘                       ║ │
│  ║             │        │               │                                 ║ │
│  ║      :5050  │        │ pg_dump       │                                 ║ │
│  ║   ┌─────────▼──┐  ┌──▼───────┐       │                                 ║ │
│  ║   │  pgadmin   │  │  backup  │       │                                 ║ │
│  ║   └────────────┘  └──────────┘       │                                 ║ │
│  ║                                      │                                 ║ │
│  ║  ─── perfil: monitoreo ──────────────┼──────────────────────────────    ║ │
│  ║   postgres-exporter ◀────────────────┘                                 ║ │
│  ║   postgres-exporter-replica · node-exporter · cadvisor                 ║ │
│  ║           │                                                            ║ │
│  ║           ▼                                                            ║ │
│  ║   ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐        ║ │
│  ║   │ prometheus   │───▶│ alertmanager │───▶│ receptor-alertas  │        ║ │
│  ║   │    :9090     │    │    :9093     │    │  (nginx, registro)│        ║ │
│  ║   └──────┬───────┘    └──────┬───────┘    └───────────────────┘        ║ │
│  ║          ▼                   │                                        ║ │
│  ║   ┌──────────────┐           │ webhook con Bearer                     ║ │
│  ║   │ grafana :3001│           │                                        ║ │
│  ║   └──────────────┘           │                                        ║ │
│  ╚══════════════════════════════╪════════════════════════════════════════╝ │
│                                 │                                          │
│  ╔═ red automatizacion ═════════▼════════════════════════════════════════╗ │
│  ║   ┌──────────────┐   ┌──────────┐         perfil: automatizacion      ║ │
│  ║   │  n8n  :5678  │──▶│  n8n-db  │                                     ║ │
│  ║   └──┬────────┬──┘   └──────────┘                                     ║ │
│  ╚══════╪════════╪═══════════════════════════════════════════════════════╝ │
│         │        │   n8n es el ÚNICO que cruza de red                      │
│  ╔══════▼════╗  ╔▼═══════════════╗                                         │
│  ║ incidenc. ║  ║  documental    ║                                         │
│  ║ mantis    ║  ║  nextcloud     ║   perfiles: incidencias / documental    │
│  ║  :8089    ║  ║   :8081        ║                                         │
│  ║ mantis-db ║  ║  nextcloud-db  ║                                         │
│  ║ mailpit   ║  ║  nextcloud-redis║                                        │
│  ║  :8025    ║  ╚════════════════╝                                         │
│  ╚═══════════╝                                                             │
└────────────────────────────────────────────────────────────────────────────┘

  Todos los puertos de la izquierda están publicados en 127.0.0.1, NO en
  0.0.0.0. Desde otra máquina de la LAN no se ve ninguno.
```

---

## 2 · Qué se contenedoriza y qué no

Ésta es la pregunta del criterio de aceptación, así que va con respuesta
explícita y con el motivo.

### Dentro de contenedores (los 23 servicios)

| Perfil | Servicios | Para qué |
|---|---|---|
| *(ninguno: siempre)* | `db`, `pgadmin`, `backup` | la base, su consola y las copias |
| `app` | `backend`, `frontend` | la aplicación |
| `monitoreo` | `prometheus`, `alertmanager`, `grafana`, `node-exporter`, `cadvisor`, `postgres-exporter`, `receptor-alertas` | punto 10 |
| `replica` | `db-replica`, `postgres-exporter-replica` | punto 6 |
| `incidencias` | `mantis`, `mantis-db`, `mantis-mail` | punto 11 |
| `documental` | `nextcloud`, `nextcloud-db`, `nextcloud-redis` | punto 12 |
| `automatizacion` | `n8n`, `n8n-db` | punto 13 |
| `tunel` | `cloudflared` | punto 9 |

### Afuera de los contenedores, a propósito

| Qué | Por qué queda afuera |
|---|---|
| **El código fuente** | Vive en el repositorio. Los contenedores son el resultado, no el origen: si el código viviera adentro, el contenedor sería la fuente de verdad y no se podría revisar en un *pull request*. |
| **El `.env`** | Nunca entra a una imagen (`backend/Dockerfile`, comentario explícito). Una imagen con secretos adentro es una imagen que no se puede publicar en un registro. Las variables se inyectan al correr. |
| **El certificado de Cloudflare** (`~/.cloudflared/cert.pem`) | Es la llave de la cuenta entera, no de este proyecto. Al contenedor del túnel sólo entra el archivo de credenciales de **ese** túnel. |
| **Las copias de seguridad** | `infra/compose/backups/` es una carpeta de la máquina, montada en los contenedores. Una copia que vive dentro del mismo volumen que la base no es una copia: se borra con ella. |
| **Los datos de PostgreSQL** | En un volumen con nombre (`restoya_pgdata`), declarado `external: true` porque existía antes de este *compose*. Si estuvieran en la capa de escritura del contenedor, `docker compose down` se los llevaría. |
| **El runner de GitHub Actions para el despliegue** | El job de despliegue necesita correr en esta máquina, que está detrás de CGNAT y no es alcanzable desde los runners de GitHub. Por eso es *self-hosted* y no un contenedor. |
| **Docker Desktop y WSL2** | Son el sustrato. No tiene sentido contenedorizar el motor. |

---

## 3 · Las cuatro redes, y por qué no es una sola

`infra/compose/docker-compose.yml:663-679`. Una red por herramienta:

| Red | Quién vive ahí |
|---|---|
| `restoya_interna` | la aplicación, la base, la réplica, el monitoreo, el túnel |
| `restoya_incidencias` | MantisBT, su MariaDB y Mailpit |
| `restoya_documental` | Nextcloud, su PostgreSQL y su Redis |
| `restoya_automatizacion` | n8n y su PostgreSQL |

El motivo está en el comentario del archivo y es el principio de menor
privilegio aplicado a la red: **Mantis no tiene por qué poder hablarle a la
base de la aplicación, ni Nextcloud a Mantis.** En una sola red, cualquier
contenedor comprometido alcanza a los otros veintidós por nombre de DNS, sin
pasar por ningún control.

**n8n es la única excepción, y es deliberada**: está en las cuatro redes
(líneas 618-622), porque su trabajo es justamente cruzar —leer una alerta de
Alertmanager, abrir una incidencia en Mantis, subir un informe a Nextcloud. Es
también el servicio que tiene más credenciales adentro, lo que lo convierte en
el blanco más valioso del sistema. Por eso no se publica en el túnel.

---

## 4 · Tres decisiones de arquitectura que vale la pena defender

### 4.1 · El backend no publica puerto

`backend` no tiene sección `ports:`. Al navegador sólo se le ofrece nginx, en
`127.0.0.1:8080`, y nginx hace de *proxy* de `/api/` por la red interna de
Docker.

Tres consecuencias que se ganan de arriba:

1. **No hay CORS que configurar en despliegue**: el navegador habla con un
   solo origen. El `corsOptions` del backend queda para desarrollo, donde
   Angular corre en `:4200` y la API en `:3000`.
2. **`/metrics` y `/api-docs` no son alcanzables desde el navegador.** nginx
   sólo reenvía `/api/`, así que las dos rutas quedan sólo para Prometheus y
   para quien entre a la red interna (`backend/index.js:71-74` y `158-176`).
3. El backend puede escuchar en todas sus interfaces sin exponer nada, porque
   su única interfaz está dentro de la red de Docker.

### 4.2 · Todo se publica en `127.0.0.1`, no en `0.0.0.0`

Cada `ports:` del archivo lleva el prefijo `127.0.0.1:`. Sin ese prefijo,
Docker abre el puerto en **todas** las interfaces y además **escribe la regla
directamente en la cadena `DOCKER` de iptables, por delante de las reglas del
firewall del sistema**: el puerto queda abierto a la LAN aunque el firewall
diga lo contrario. Es uno de los errores de configuración más frecuentes y más
silenciosos de Docker.

Con el prefijo, pgAdmin, Grafana, Prometheus, Mantis, Nextcloud, n8n y las dos
bases quedan accesibles **sólo desde esta máquina**. Para que otra persona del
grupo entre a Grafana hace falta un túnel SSH o Radmin VPN, que es
exactamente lo que se quiere.

### 4.3 · Dos conexiones a la base, elegidas a mano

`backend/config/database-lectura.js`. La réplica no se usa como "lista de
réplicas de lectura" de Sequelize, que es la opción que viene hecha. El motivo
está en el comentario del archivo: esa lista reparte **todas** las lecturas,
incluidas las que leen algo que se acaba de escribir, y con replicación
asincrónica eso produce el clásico *"cargué el pedido y no aparece"*.

Entonces se elige a mano: a la réplica va **solamente el tablero histórico**,
que lee vistas materializadas —datos que ya son viejos por definición, así que
el retraso de la replicación no agrega ningún error nuevo. Las cifras de hoy
del mismo tablero siguen yendo al primario.

Y si `DB_REPLICA_HOST` no está definida, todo va al primario y la aplicación
funciona igual. Levantar el proyecto sin el perfil `replica` tiene que seguir
andando, y anda.

---

## 5 · El camino de una petición, de punta a punta

Útil para la defensa, porque es la pregunta que más se hace:

```
1. El navegador pide  https://<dominio>/platos
2. Cloudflare termina el TLS y manda la petición por el túnel ya establecido.
   (El conector SALE hacia Cloudflare: no hay ningún puerto abierto en el
   router, y con CGNAT no podría haberlo.)
3. cloudflared la entrega a http://frontend:80 por la red interna de Docker,
   con httpHostHeader puesto en el dominio real.
4. nginx no encuentra el archivo /platos, y por try_files devuelve index.html.
   Angular toma el control y rutea del lado del cliente.
5. Angular pide /api/productos al MISMO origen.
6. nginx hace proxy a http://backend:3000, resolviendo el nombre cada 10 s
   (resolver 127.0.0.11), y pasa X-Forwarded-For.
7. El backend mide la petición (middleware de métricas), aplica el límite
   general de 300/min, y consulta el primario con Sequelize.
8. La respuesta vuelve por el mismo camino.
```

El paso 6 tiene una historia: nginx resuelve un nombre **una sola vez, al
arrancar**, y se queda con esa IP. Cuando el contenedor del backend se recrea
cambia de IP, y nginx le sigue hablando a la vieja: **502 para todo, con el
backend sano**. Pasó de verdad probando el punto 14. El arreglo —`resolver` más
una variable en `proxy_pass`— está comentado en `frontend/nginx.conf:30-45`.

---

## 6 · Las dos formas de desplegar

| Archivo | De dónde salen las imágenes | Cuándo |
|---|---|---|
| `docker-compose.yml` | se construyen en la máquina (`build:`) | desarrollo |
| `+ docker-compose.produccion.yml` | se bajan de `ghcr.io`, etiquetadas con el **SHA del commit** | despliegue |

La superposición de producción no cambia nada más que eso, y el motivo está
escrito en el archivo: lo que corre en producción es **exactamente el mismo
binario que pasó las pruebas**. Reconstruir en la máquina puede dar algo
distinto —otra versión de la imagen base, otra caché— aunque el código sea
idéntico.

No se usa la etiqueta `latest` a propósito: no dice a qué código corresponde,
y hace imposible volver a una versión exacta. Con el SHA, volver atrás es
cambiar una variable y levantar de nuevo. Detalle en
[`11-cicd.md`](11-cicd.md).

---

## 7 · Lo que esta arquitectura NO resuelve

- **Es una sola máquina.** La réplica de PostgreSQL protege del fallo del
  *proceso* de base, no del fallo de la máquina: si se apaga esta notebook, se
  apagan las dos. Una réplica de verdad vive en otro equipo.
- **No hay alta disponibilidad del backend.** Un solo contenedor, y además el
  limitador de peticiones guarda las cuentas en memoria del proceso, así que
  escalarlo a dos réplicas multiplicaría por dos el límite efectivo (ver
  [`09-seguridad.md`](09-seguridad.md)).
- **El failover de la base es manual.** `pg_ctl promote` lo corre una persona.
  No hay testigo ni *fencing*, así que un failover automático acá produciría
  *split-brain*, no disponibilidad. Está argumentado en
  [`10-cluster.md`](10-cluster.md).
- **nginx no termina TLS.** El cifrado lo da Cloudflare. Sin el túnel, la
  aplicación se sirve por HTTP en claro, que está bien en `127.0.0.1` y no
  estaría bien en ningún otro lado.
- **Las redes separan, pero no inspeccionan.** No hay reglas de egreso: un
  contenedor comprometido no alcanza a las otras redes, pero sí sale a
  Internet.

---

## Referencias

- Qué hace la aplicación: [`01-descripcion.md`](01-descripcion.md)
- Versiones exactas de cada imagen: [`03-inventario.md`](03-inventario.md)
- Los Dockerfiles y las copias: [`05-docker.md`](05-docker.md)
- La réplica: [`10-cluster.md`](10-cluster.md)
- El pipeline y el registro: [`11-cicd.md`](11-cicd.md)
