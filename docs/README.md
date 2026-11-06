# Documentación técnica

Los dieciséis ítems obligatorios del punto 15 de la consigna. Cada uno es un
archivo en esta carpeta; la columna *Frente* dice quién lo escribe.

| # | Documento | Archivo | Frente |
|---|---|---|---|
| 1 | Descripción de la aplicación | `01-descripcion.md` | Todos |
| 2 | Arquitectura general | `02-arquitectura.md` | Todos |
| 3 | Inventario tecnológico | `03-inventario.md` | Todos |
| 4 | Manual de instalación | `04-instalacion.md` | 3 |
| 5 | Configuración Docker | `05-docker.md` | 1 y 3 |
| 6 | Procedimiento de migración y carga de datos | `06-carga-datos.md` | 1 |
| 7 | Informe de optimización SQL | `07-optimizacion-sql.md` | 2 |
| 8 | Configuración y pruebas de replicación | `08-replicacion.md` | 2 |
| 9 | Configuración CI/CD | `09-cicd.md` | 3 |
| 10 | Procedimiento de publicación en Internet | `10-publicacion.md` | 4 |
| 11 | Manual de monitoreo | `11-monitoreo.md` | 4 |
| 12 | Gestión de incidencias | `12-incidencias.md` | 5 |
| 13 | Flujos de n8n | `13-n8n.md` | 5 |
| 14 | Informe de seguridad | `14-seguridad.md` | Coordina uno, aporta cada frente |
| 15 | Procedimiento de backup y restauración | `15-backup.md` | 1 |
| 16 | Limitaciones conocidas y mejoras futuras | `16-limitaciones.md` | Todos |

## Cómo escribirlos

La consigna avisa dos veces que no alcanza con afirmar que algo funciona: hay
que **demostrarlo y justificar las decisiones**. Cada documento tiene que
responder tres preguntas:

1. Qué se configuró y con qué valores.
2. Por qué se eligió eso y no otra cosa.
3. Cómo se comprobó que funciona, con la medición o la salida del comando.

Una captura de pantalla sola no prueba nada. Un `EXPLAIN ANALYZE` antes y
después, sí.

## Dónde va la copia definitiva

El punto 12 pide centralizar la documentación en **Nextcloud**. Estos archivos
son la fuente de verdad y se versionan acá; a Nextcloud se suben los entregables
cerrados de cada sprint.
