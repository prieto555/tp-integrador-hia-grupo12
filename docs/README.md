# Documentación técnica

El punto 15 de la consigna pide **dieciséis documentos**. Los dieciséis están escritos, y esta
tabla dice **dónde está cada uno**, porque no hay una correspondencia de uno a
uno: los archivos están numerados por **punto de la consigna**, no por número
de documento, y algunos documentos se cubren dentro de otro.

> **Antes se planificó al revés** (un archivo por documento: `08-replicacion.md`,
> `09-cicd.md`, `13-n8n.md`…). Se cambió al numerar por punto, que es como se
> fueron cerrando, y es lo que hace que el informe de un punto se lea entero.
> Esta tabla es el puente entre las dos numeraciones.

| # | Documento que pide el punto 15 | Dónde está | Estado |
|---|---|---|---|
| 1 | Descripción de la aplicación | [`01-descripcion.md`](01-descripcion.md) | Hecho |
| 2 | Arquitectura general | [`02-arquitectura.md`](02-arquitectura.md) | Hecho |
| 3 | Inventario tecnológico | [`03-inventario.md`](03-inventario.md) | Hecho |
| 4 | Manual de instalación | [`../README.md`](../README.md) + [`../COMO-CORRER.md`](../COMO-CORRER.md) | Hecho |
| 5 | Configuración Docker | [`05-docker.md`](05-docker.md) | Hecho |
| 6 | Procedimiento de migración y carga de datos | [`06-carga-datos.md`](06-carga-datos.md) | Hecho |
| 7 | Informe de optimización SQL | [`07-optimizacion-sql.md`](07-optimizacion-sql.md) | Hecho |
| 8 | Configuración y pruebas de replicación | [`10-cluster.md`](10-cluster.md) | Hecho, con la prueba de caída corrida y medida |
| 9 | Configuración CI/CD | [`11-cicd.md`](11-cicd.md) | Hecho |
| 10 | Procedimiento de publicación en Internet | [`15-publicacion.md`](15-publicacion.md) | Hecho; la aplicación está publicada y probada por Internet |
| 11 | Manual de monitoreo | [`08-monitoreo.md`](08-monitoreo.md) | Hecho |
| 12 | Gestión de incidencias | [`12-incidencias.md`](12-incidencias.md) | Hecho; 17 incidencias cargadas y verificadas por API. Faltan capturas |
| 13 | Flujos de n8n | [`14-automatizacion.md`](14-automatizacion.md) | Hecho; los tres flujos corridos, y arreglados. Faltan capturas |
| 14 | Informe de seguridad | [`09-seguridad.md`](09-seguridad.md) | Hecho |
| 15 | Procedimiento de backup y restauración | [`05-docker.md`](05-docker.md), sección de copias | Hecho |
| 16 | Limitaciones conocidas y mejoras futuras | [`16-limitaciones.md`](16-limitaciones.md) | Hecho |

Además, fuera de la lista de los dieciséis:

| Documento | Para qué |
|---|---|
| [`13-documental.md`](13-documental.md) | Punto 12 — gestión documental con Nextcloud |
| [`capturas/`](capturas/README.md) | Las catorce capturas de pantalla, con **qué prueba cada una** |

## Qué punto cubre cada archivo

| Archivo | Punto |
|---|---|
| `01-descripcion.md` | 1 — descripción, actores, modelo de datos y diagnóstico |
| `02-arquitectura.md` | 1 — arquitectura y qué se contenedoriza |
| `03-inventario.md` | 1 — inventario tecnológico con versiones exactas |
| `05-docker.md` | 4 — contenerización de la base y los servicios auxiliares |
| `06-carga-datos.md` | 4 — conjunto de datos de prueba |
| `07-optimizacion-sql.md` | 5 — optimización y análisis |
| `08-monitoreo.md` | 10 — Prometheus y Grafana |
| `09-seguridad.md` | 14 — seguridad informática |
| `10-cluster.md` | 6 — clúster y replicación |
| `11-cicd.md` | 8 — integración y despliegue continuos |
| `12-incidencias.md` | 11 — gestión de incidencias |
| `13-documental.md` | 12 — gestión documental |
| `14-automatizacion.md` | 13 — automatización con n8n |

## Cómo se escriben

La consigna avisa dos veces que no alcanza con afirmar que algo funciona: hay
que **demostrarlo y justificar las decisiones**. Cada documento responde tres
preguntas:

1. Qué se configuró y con qué valores.
2. **Por qué eso y no otra cosa**, incluidas las opciones que se descartaron.
3. Cómo se comprobó que funciona, con la medición o la salida del comando.

Una captura de pantalla sola no prueba nada. Un `EXPLAIN ANALYZE` antes y
después, sí.

Y una cuarta, que es la que distingue un informe de un folleto: **qué NO
resuelve esto**. Todos los informes de esta carpeta terminan con una sección
de limitaciones, y ahí está lo que no anda, lo que no se probó, y lo que se
dejó afuera a propósito.

## Dónde va la copia definitiva

El punto 12 pide centralizar la documentación en **Nextcloud**.

> Estos archivos son la **fuente**. Nextcloud es la **copia para leer y
> compartir**. Si divergen, manda el repositorio.

La sube `infra/documental/preparar-nextcloud.sh`. Ver
[`13-documental.md`](13-documental.md).
