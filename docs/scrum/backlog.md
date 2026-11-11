# Product Backlog

Entregable del punto 2. Cada fila es una tarjeta del tablero: el **ID** es el
que va en el mensaje de commit (`feat(infra): ... (E4-02)`) para cumplir
"commits descriptivos y vinculados con las tareas".

**Prioridad:** Alta = sin esto no hay defensa · Media = resta nota si falta ·
Baja = deseable.
**Estimación:** puntos de historia (1 = un rato, 2 = media jornada,
3 = una jornada, 5 = dos jornadas, 8 = más de dos).

El backlog no es sólo funcionalidad: incluye infraestructura, pruebas,
seguridad, documentación y despliegue, como pide la consigna.

---

## E1 · Diagnóstico de la aplicación — punto 1 ✅

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E1-01 | Descripción, roles y modelo de datos | Alta | 2 | Documento con las 10 entidades y los 4 roles con sus permisos | Todos |
| E1-02 | Lista de funcionalidades por actor | Alta | 1 | Sale de las rutas reales, no de suposiciones | Todos |
| E1-03 | Inventario tecnológico con versiones exactas | Alta | 2 | Versiones de `npm ls`, no rangos de `package.json` | Todos |
| E1-04 | Diagrama de arquitectura | Alta | 2 | Muestra qué se contenariza y qué queda afuera | Todos |
| E1-05 | Diagnóstico técnico y plan de mejoras | Alta | 3 | Cada hallazgo con riesgo, acción y responsable | Todos |

## E2 · Gestión del proyecto — punto 2

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E2-01 | Crear el tablero y las listas | Alta | 1 | Listas: Backlog, Sprint actual, En curso, En revisión, Hecho | 5 |
| E2-02 | Cargar el backlog completo | Alta | 2 | Las ~45 tarjetas de este documento, con etiquetas de prioridad | 5 |
| E2-03 | Asignar responsables | Alta | 1 | Toda tarjeta tiene un miembro; ninguna queda huérfana | 5 |
| E2-04 | Definir los sprints | Alta | 1 | Fechas de inicio y fin, y qué entra en cada uno | 5 |
| E2-05 | Registrar las reuniones de seguimiento | Alta | 2 | Una nota por reunión con avances, impedimentos y decisiones | 5 |
| E2-06 | Documentar cambios de alcance | Media | 1 | Qué se sacó del alcance y por qué | 5 |

## E3 · Control de versiones — punto 3 🟡

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E3-01 | Monorepo con el historial de los dos repos | Alta | 3 | `git log` muestra los 154 commits previos | — ✅ |
| E3-02 | Estrategia de ramas y plantilla de PR | Alta | 2 | `main`, `develop`, `feature/*`, `fix/*` documentadas | — ✅ |
| E3-03 | Proteger `main` | Alta | 1 | Un push directo es rechazado con GH013 | — ✅ |
| E3-04 | Agregar a los integrantes como colaboradores | Alta | 1 | Los cinco pueden pushear a `feature/*` | 5 |
| E3-05 | Primer PR revisado y mergeado | Alta | 1 | Un PR con aprobación de otro integrante | Todos |
| E3-06 | Resolver y registrar un conflicto real | Media | 2 | Captura del conflicto y de cómo se resolvió | Todos |

## E4 · Base de datos contenerizada — punto 4 🟡

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E4-01 | Compose con Postgres, volumen y red interna | Alta | 3 | `docker compose up` deja la base sana | 1 ✅ |
| E4-02 | pgAdmin dockerizado | Alta | 1 | Se conecta a la base por la red interna | 1 ✅ |
| E4-03 | Servicio de backups con verificación y rotación | Alta | 3 | Bitácora con copias verificadas por `pg_restore -l` | 1 ✅ |
| E4-04 | Volcar el esquema a SQL | Alta | 1 | `schema.sql` versionado | 1 ✅ |
| E4-05 | Sacar `sequelize.sync({ alter: true })` | Alta | 5 | El backend arranca sin tocar el esquema | 1 |
| E4-06 | Migraciones versionadas | Alta | 5 | Una base vacía se arma corriendo las migraciones | 1 |
| E4-07 | Generador del dataset de 6.000.000 por tabla | Alta | 5 | 5 tablas con ≥6M filas, claves foráneas íntegras | 1 |
| E4-08 | Documentar la carga | Alta | 2 | Filas por tabla, tamaño, método, tiempo de carga | 1 |
| E4-09 | Probar restauración sobre base vacía | Alta | 2 | Se restaura una copia y los conteos coinciden | 1 |
| E4-10 | Evidencia de persistencia | Alta | 1 | Se recrean los contenedores y los datos siguen | 1 ✅ |

## E5 · Optimización de la base — punto 5

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E5-01 | Identificar consultas costosas | Alta | 2 | Top 10 por tiempo total desde `pg_stat_statements` | 2 |
| E5-02 | Planes de ejecución iniciales | Alta | 3 | `EXPLAIN ANALYZE` de las 8 elegidas, guardado | 2 |
| E5-03 | Analizar índices, cardinalidad y selectividad | Alta | 3 | Informe de qué índices hay y cuáles se usan | 2 |
| E5-04 | Detectar recorridos completos y uniones caras | Alta | 2 | Lista de los `Seq Scan` sobre tablas grandes | 2 |
| E5-05 | Revisar consultas no SARGables | Media | 2 | Las que aplican funciones sobre la columna del WHERE | 2 |
| E5-06 | Crear índices justificados | Alta | 5 | Cada índice con su ganancia y su costo en escritura | 2 |
| E5-07 | Optimizar las 8 consultas | Alta | 8 | Medición antes y después sobre los mismos datos | 2 |
| E5-08 | Ajustar parámetros del motor | Media | 3 | Efecto medido, no sólo el valor cambiado | 2 |
| E5-09 | Informe de optimización | Alta | 3 | Decisiones, efectos y lo que no funcionó | 2 |

## E6 · Clúster y replicación — punto 6

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E6-01 | Nodo primario y réplica por streaming | Alta | 5 | La réplica acepta lecturas y rechaza escrituras | 2 |
| E6-02 | Documentar el rol de cada nodo | Alta | 1 | Diagrama de replicación | 2 |
| E6-03 | Verificar que las operaciones se replican | Alta | 2 | Una escritura aparece en la réplica, con su retraso | 2 |
| E6-04 | Conectar la aplicación a la arquitectura | Media | 3 | Decisión documentada sobre lecturas a la réplica | 2 |
| E6-05 | Simular la caída de un nodo | Alta | 3 | Se apaga el primario y se documenta qué pasa | 2 |
| E6-06 | Informe de consistencia y limitaciones | Alta | 2 | Dice con todas las letras si hay o no failover automático | 2 |

## E7 · Contenerización de la aplicación — punto 7

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E7-01 | Dockerfile del backend | Alta | 3 | Multi-etapa, usuario no root, sin `.env` adentro | 3 |
| E7-02 | Dockerfile del frontend | Alta | 3 | `ng build` servido por nginx | 3 |
| E7-03 | Sumar front y back al compose | Alta | 2 | Los tres servicios en la misma red | 3 |
| E7-04 | Sacar la URL del backend a configuración | Alta | 3 | Ningún `localhost` ni Render escrito a mano | 3 |
| E7-05 | Separar desarrollo de despliegue | Alta | 3 | Dos configuraciones, sin editar código para cambiar | 3 |
| E7-06 | Endpoint de salud | Alta | 2 | `/health` verifica también la base | 3 |
| E7-07 | Validar variables de entorno al arranque | Media | 2 | Si falta una, el servidor aborta con mensaje claro | 3 |
| E7-08 | Comprobar la app desde el navegador | Alta | 1 | Captura con todo corriendo en contenedores | 3 |

## E8 · Integración y despliegue continuos — punto 8

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E8-01 | Tests mínimos del backend | Alta | 5 | `npm test` corre y pasa; hoy hace `exit 1` | 3 |
| E8-02 | Workflow de verificación en cada push | Alta | 3 | Instala, verifica y compila | 3 |
| E8-03 | Construcción de imágenes en el pipeline | Alta | 3 | Las dos imágenes se construyen sin intervención | 3 |
| E8-04 | Publicar imágenes en un registro | Media | 2 | Quedan etiquetadas y accesibles | 3 |
| E8-05 | Despliegue automático | Alta | 5 | Un commit llega solo al entorno publicado | 3 |
| E8-06 | Proteger los secretos del pipeline | Alta | 2 | Ninguna credencial en el repositorio | 3 |
| E8-07 | Commit de prueba con evidencia | Alta | 1 | Se ve el cambio en el entorno publicado | 3 |
| E8-08 | Documentar fallos y reversión | Alta | 2 | Se provoca un fallo y se revierte | 3 |

## E9 · Publicación en Internet — punto 9

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E9-01 | Elegir y configurar el túnel | Alta | 3 | La app responde desde fuera de la red | 4 |
| E9-02 | HTTPS y autenticación | Alta | 3 | Sin certificado inválido ni avisos del navegador | 4 |
| E9-03 | Restringir interfaces administrativas | Alta | 3 | pgAdmin, Grafana y Swagger no quedan abiertos | 4 |
| E9-04 | No exponer la base de datos | Alta | 1 | Sólo los puertos necesarios salen a Internet | 4 |
| E9-05 | Verificar desde afuera de la red | Alta | 1 | Celular con datos móviles, no el WiFi de casa | 4 |
| E9-06 | Diagrama de red y análisis de riesgos | Alta | 2 | Qué expone la alternativa elegida y qué no | 4 |

## E10 · Monitoreo — punto 10

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E10-01 | Prometheus y Grafana en Docker | Alta | 3 | Ambos en la red interna del proyecto | 4 |
| E10-02 | Exportadores de SO, Docker y base | Alta | 3 | `node_exporter`, cAdvisor y `postgres_exporter` | 4 |
| E10-03 | Dashboard con las métricas obligatorias | Alta | 5 | CPU, memoria, disco, red, contenedores, app y base | 4 |
| E10-04 | Métricas de replicación en el dashboard | Media | 2 | Estado y retraso de la réplica | 4 |
| E10-05 | Umbrales y alertas | Alta | 3 | Al menos tres reglas con su justificación | 4 |
| E10-06 | Prueba real de alerta | Alta | 2 | Se provoca la condición y la alerta salta | 4 |

## E11 · Gestión de incidencias — punto 11

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E11-01 | Desplegar Mantis o GLPI | Alta | 3 | Accesible y con la base persistida | 5 |
| E11-02 | Definir categorías, prioridades y responsables | Alta | 1 | Configurado antes de cargar incidencias | 5 |
| E11-03 | Cargar las 12 incidencias del diagnóstico | Alta | 3 | Con pasos de reproducción; ya incluyen 2 de seguridad y 1 de rendimiento | 5 |
| E11-04 | Vincular incidencias con commits | Alta | 2 | Cada una apunta al commit que la corrige | Todos |
| E11-05 | Cerrar incidencias con evidencia | Alta | 3 | Verificación de que la corrección funciona | Todos |

## E12 · Gestión documental — punto 12

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E12-01 | Desplegar Nextcloud | Media | 3 | Accesible y con almacenamiento persistente | 5 |
| E12-02 | Estructura de carpetas | Media | 1 | Una por punto de la consigna | 5 |
| E12-03 | Matriz de permisos | Media | 2 | Quién lee y quién escribe en cada carpeta | 5 |
| E12-04 | Subir los entregables cerrados | Media | 2 | Versionados, sin secretos | 5 |

## E13 · Automatización con n8n — punto 13

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E13-01 | Desplegar n8n con persistencia | Media | 2 | Los flujos sobreviven al reinicio | 5 |
| E13-02 | Flujo 1: alerta → incidencia → aviso | Media | 5 | Prometheus dispara y aparece la incidencia sola | 5 |
| E13-03 | Flujo 2: verificación de backups | Media | 3 | Avisa cuando una copia falla | 5 |
| E13-04 | Flujo 3: informe de rendimiento con IA | Media | 5 | Queda guardado en Nextcloud | 5 |
| E13-05 | Validación y manejo de errores en los flujos | Media | 3 | Se prueba qué pasa cuando una tarea falla | 5 |
| E13-06 | Autenticar webhooks y proteger credenciales | Alta | 2 | Ningún secreto escrito dentro del flujo | 5 |

## E14 · Seguridad — punto 14

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E14-01 | Corregir el filtro de CORS | Alta | 2 | Lista blanca exacta; `includes` no alcanza | 3 |
| E14-02 | Restringir Swagger en producción | Alta | 2 | No accesible sin autenticación | 3 |
| E14-03 | Bajar el límite de intentos de login | Alta | 1 | Valor razonable y README alineado | 3 |
| E14-04 | Matriz de amenazas | Alta | 3 | Cubre ransomware, DDoS, robo de credenciales, inyección y cadena de suministro | Todos |
| E14-05 | Escaneo de vulnerabilidades | Alta | 3 | `npm audit` y escaneo de imágenes, con resultados | Todos |
| E14-06 | Corregir lo que encuentre el escaneo | Alta | 5 | Antes y después del escaneo | Todos |
| E14-07 | Procedimiento de respuesta ante incidentes | Media | 2 | Qué se hace si pasa, paso a paso | Todos |

## E15 · Documentación final y defensa — punto 15

| ID | Tarea | Pri | Est | Criterio de aceptación | Frente |
|---|---|---|---|---|---|
| E15-01 | Completar los 16 documentos obligatorios | Alta | 8 | Cada uno dice qué, por qué y cómo se comprobó | Todos |
| E15-02 | Limitaciones conocidas y mejoras futuras | Alta | 2 | Honesto sobre lo que no se llegó a hacer | Todos |
| E15-03 | Ensayar la presentación | Alta | 3 | 20 minutos cronometrados, 4 por integrante | Todos |
| E15-04 | Ensayar preguntas cruzadas | Alta | 2 | Cada uno responde por un frente que no es el suyo | Todos |
