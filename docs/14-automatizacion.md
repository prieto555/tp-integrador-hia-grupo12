# Automatización de procesos con n8n (punto 13)

> Qué hay acá: los tres flujos, qué dispara cada uno, cómo se validan los
> datos y se manejan los errores, **qué decidimos que la automatización no
> puede hacer**, y el análisis de riesgos.

---

## 1. La decisión que atraviesa todo el punto

**Ningún flujo reinicia, apaga, borra ni modifica nada.**

Los tres leen, escriben en otro lado (una incidencia, un archivo, un correo) y
nada más. Es deliberado, y la consigna lo pide en dos lugares distintos:
*«controlar las acciones automáticas que puedan interrumpir servicios»* y
*«solicitar aprobación humana antes de ejecutar acciones críticas»*.

El razonamiento, en una línea:

> Una automatización que reinicia servicios, con un disparador que entra por la
> red, es un apagado remoto esperando que alguien lo encuentre.

El flujo F01 recibe un `POST` de Alertmanager. Si ese flujo reiniciara el
backend «para recuperarlo», entonces cualquiera que llegue al puerto y mande
un JSON con la forma correcta puede reiniciar el backend cuando quiera. Y el
atacante no necesita adivinar nada: el formato de Alertmanager está
documentado.

Por eso los flujos **avisan y registran**. Decidir y actuar queda en manos de
una persona.

---

## 2. Cómo está montado

```
┌─ red restoya_automatizacion ─┐
│  ┌──────────┐  ┌──────────┐  │
│  │ restoya_ │─►│ restoya_ │  │
│  │ n8n      │  │ n8n_db   │  │
│  │ 1.70.1   │  │ PG 16    │  │
│  └────┬─────┘  └──────────┘  │
└───────┼──────────────────────┘
        │  n8n está además en:
        ├──► restoya_interna        (Prometheus, el volumen de copias)
        ├──► restoya_incidencias    (Mantis)
        └──► restoya_documental     (Nextcloud)
```

```bash
cd infra/compose && docker compose --profile automatizacion up -d
```

n8n es **el servicio con más alcance del proyecto**: está en cuatro redes. Por
eso es el que más importa tener cerrado.

| Control | Cómo |
|---|---|
| Interfaz de administración protegida | `N8N_BASIC_AUTH_ACTIVE=true`, usuario y clave desde el `.env` |
| No se publica afuera | `127.0.0.1:5678` |
| Credenciales cifradas | `N8N_ENCRYPTION_KEY`, desde el `.env` |
| Persistencia | PostgreSQL propio, no SQLite en un volumen |
| No manda telemetría | `N8N_DIAGNOSTICS_ENABLED=false` |

> **Sobre `N8N_ENCRYPTION_KEY`.** Con esa clave n8n cifra las credenciales que
> guarda. Si cambia o se pierde, **las credenciales existentes dejan de poder
> descifrarse** y hay que volver a cargarlas todas. Por eso está en el `.env`
> y no se genera al vuelo en cada arranque, que es el error típico.

### Las credenciales no están en los flujos

Los archivos JSON de los flujos **se pueden subir al repositorio** porque no
tienen ningún secreto: referencian credenciales por nombre
(`CRED_MANTIS_API`, `CRED_SMTP_MAILPIT`, `CRED_NEXTCLOUD_BOT`,
`CRED_WEBHOOK_ALERTAS`) y los valores viven cifrados dentro de n8n, cargados a
mano una sola vez desde su interfaz.

Es la diferencia entre poder versionar la automatización y no poder.

---

## 3. Los tres flujos

### F01 — De la alerta a la incidencia

[`01-alertas-a-incidencias.json`](../infra/automatizacion/flujos/01-alertas-a-incidencias.json)

```
Alertmanager ──POST──► n8n ──► validar ──► ¿crítica y activa?
                                                │
                                   sí ──────────┴──────── no → responder 200
                                   │
                            ¿ya hay una abierta?
                              │              │
                             no             sí
                              │              │
                    crear incidencia    agregar nota
                              │              │
                        avisar por correo    │
                              └──────┬───────┘
                                 responder 200
```

**Disparador:** `POST /webhook/alerta`, con una cabecera secreta.
**Componentes que integra:** Prometheus/Alertmanager → MantisBT → Mailpit.

| Decisión | Por qué |
|---|---|
| Sólo las `critical` abren incidencia | Un sistema que abre *ticket* por cada aviso entrena al equipo a ignorar los *tickets* |
| Se busca si ya hay una abierta, por «huella» (`alerta\|servicio`) | Una caída de media hora dispara la alerta muchas veces. Sin esto, 40 incidencias por el mismo problema |
| Si Mantis no responde, **se abre igual** | Entre una incidencia duplicada y una caída sin registrar, el duplicado es el error barato |
| Siempre se responde 200 a Alertmanager | Si no, reintenta, y el problema se multiplica |

### F02 — ¿La copia sirve?

[`02-verificacion-de-copias.json`](../infra/automatizacion/flujos/02-verificacion-de-copias.json)

**Disparador:** todos los días a las 3:30, media hora después de la copia.
**Componentes que integra:** el servicio de copias (volumen **de sólo
lectura**) → MantisBT → Mailpit.

Tres comprobaciones, porque cada una detecta un fallo distinto:

| Qué se mira | Qué fallo detecta |
|---|---|
| Que haya una de las últimas 26 h | El servicio de copias dejó de correr y nadie se enteró. **Es el fallo más común y el más silencioso** |
| Que pese más de 100 KB | `pg_dump` falló y escribió el error **dentro** del archivo |
| `gzip -t` | El archivo se truncó: pesa bien, tiene buena fecha, y no se puede restaurar |

Si algo falla, abre una incidencia con severidad `block` y prioridad
`immediate`, y manda un correo. El texto de la incidencia dice por qué:

> «Mientras esto no se arregle, el proyecto NO TIENE COPIA ÚTIL. Es la
> incidencia más urgente que puede abrir este sistema: todo lo demás se vuelve
> a hacer, los datos no.»

**El volumen se monta de sólo lectura.** Una automatización que puede borrar
copias es una automatización que algún día las borra. Verificar no necesita
escribir.

> **Lo que esto NO prueba:** que la restauración funcione. Eso sólo lo prueba
> restaurar. La restauración real está medida en el punto 4 (75 s, con los
> conteos exactos) y se corre a mano.

### F03 — Informe semanal a Nextcloud

[`03-informe-de-rendimiento.json`](../infra/automatizacion/flujos/03-informe-de-rendimiento.json)

**Disparador:** lunes a las 8.
**Componentes que integra:** Prometheus → Nextcloud (WebDAV) → Mailpit.

Tres consultas distintas, en paralelo, porque cada una responde una pregunta
diferente y promediarlas no significaría nada:

1. Estado actual (`up`, replicación, montículo de V8)
2. Percentil 95 de latencia por ruta, últimos 7 días
3. Peticiones y errores 5xx por ruta, últimos 7 días

Con eso arma un informe en Markdown y lo sube a
`RestoYa/04-Informes/Rendimiento/informe-rendimiento-AAAA-MM-DD.md`.

#### Por qué el análisis no usa un modelo de IA

La consigna sugiere *«un componente Python o un modelo de IA analiza
anomalías»*. Se implementó el análisis como un componente determinístico
dentro de n8n, y **no** con un modelo. Las razones, en orden:

1. **El informe se archiva y se usa como evidencia.** Con los mismos datos
   tiene que dar el mismo resultado. Un modelo no garantiza eso.
2. **Significaría mandar las métricas del proyecto a un servicio de un
   tercero**, semana tras semana, sin necesidad.
3. **Los umbrales ya existen y están justificados** en las reglas de alerta
   del punto 10. Reemplazarlos por «lo que le parezca al modelo» sería perder
   información, no ganarla.

Los umbrales que usa son los mismos del punto 10:

| Qué | Umbral | Por qué ese |
|---|---|---|
| Latencia p95 | 1000 ms | Después del punto 5 ninguna consulta pasa de 1,4 ms; un segundo de p95 es espera, no base de datos |
| Errores 5xx | 5% | Por debajo son fallos sueltos; por encima es algo roto |
| Montículo de V8 | 80% **del techo** | Medido contra `heap_size_limit` y no contra el reservado: ese error nos tuvo una alerta sonando sin motivo (INC-13) |

**F03 no abre incidencia.** Un hallazgo semanal es algo para mirar; si
corresponde, se abre a mano. Lo que sí abre incidencia sola es F01, que
reacciona a una alerta crítica en el momento.

---

## 4. Validación de datos (actividad 5)

El punto más expuesto es F01: un *webhook* es una puerta abierta.

```js
if (!Array.isArray(cuerpo.alerts) || cuerpo.alerts.length === 0)
  throw new Error('No viene el arreglo "alerts".');
if (!['firing', 'resolved'].includes(cuerpo.status))
  throw new Error(`Estado desconocido: ${cuerpo.status}`);

const limpiar = (t) => String(t ?? '')
  .replace(/[\u0000-\u001f]/g, ' ')   // caracteres de control
  .slice(0, 500)
  .trim();
```

| Control | Contra qué |
|---|---|
| Cabecera secreta en el *webhook* | Que cualquiera abra incidencias falsas |
| Comprobar que tenga forma de notificación de Alertmanager | Que entre cualquier JSON |
| Recortar a 500 caracteres | Que una alerta con un campo enorme llene la base de Mantis |
| Sacar los caracteres de control | Que se inyecten saltos de línea y escapes en el texto de la incidencia |
| `JSON.stringify` para armar el cuerpo | Inyección en el JSON que se le manda a Mantis |

Si la validación falla, **se lanza un error y la ejecución queda marcada como
fallida** en el historial de n8n. No se sigue con datos a medias.

---

## 5. Manejo de errores (actividad 8)

| Nodo | Qué hace si falla | Por qué |
|---|---|---|
| Consultas a Prometheus | 3 reintentos cada 3 s, después sigue | El informe dice «datos que no se pudieron leer» en vez de inventar un número |
| Buscar incidencias abiertas | 3 reintentos, después sigue | Se abre la incidencia igual: duplicar es mejor que perder |
| Crear incidencia en Mantis | 3 reintentos cada 5 s, después **falla** | Si no se puede registrar, la ejecución tiene que verse en rojo |
| Enviar correo | Sigue | La incidencia ya quedó abierta; no se deshace nada |
| Subir a Nextcloud | 3 reintentos cada 5 s, después falla | Es el producto del flujo F03 |

Los tres flujos tienen `saveDataErrorExecution: all`, así que el historial de
n8n guarda **qué datos había** cuando algo falló. Sin eso, un fallo de hace
tres días es imposible de diagnosticar.

### Prueba de qué pasa cuando una tarea falla

La consigna pide probarlo. El procedimiento:

```bash
# F01 con Mantis apagado: la incidencia no se abre, el correo sí sale,
# y la ejecución queda en rojo con el cuerpo de la alerta guardado.
docker stop restoya_mantis
curl -X POST http://127.0.0.1:5678/webhook/alerta -H "X-Alerta-Token: <el de la credencial>" \
  -H 'Content-Type: application/json' \
  -d '{"status":"firing","alerts":[{"labels":{"alertname":"Prueba","severity":"critical","job":"backend"},"annotations":{"summary":"prueba de fallo"}}]}'
docker start restoya_mantis

# F02 con una copia corrupta: tiene que abrir incidencia por "EL ARCHIVO ESTA CORRUPTO"
head -c 1000000 /dev/urandom > infra/compose/backups/restoyadb-corrupta.sql.gz

# F01 sin la cabecera: tiene que devolver 401 y no ejecutar nada
curl -i -X POST http://127.0.0.1:5678/webhook/alerta -d '{}'
```

---

## 6. Análisis de riesgos de las automatizaciones (entregable)

| Riesgo | Qué tan grave | Qué lo contiene |
|---|---|---|
| Alguien llega al *webhook* y abre incidencias falsas | Medio: ruido, no daño | Cabecera secreta; n8n no sale de `127.0.0.1`; sólo las `critical` abren |
| **Un flujo interrumpe un servicio** | **Sería el peor** | **Ningún flujo puede: no reinician, no apagan, no borran** (sección 1) |
| El robot borra documentación de Nextcloud | Medio | La cuenta `automatizacion` tiene permiso de **crear**, no de borrar ni modificar (punto 12) |
| El robot borra copias de seguridad | Sería grave | El volumen se monta de **sólo lectura** |
| Se filtra la clave de cifrado de n8n | Alto: todas las credenciales guardadas | Vive sólo en el `.env`, fuera de Git |
| Un bucle de alertas llena la base de Mantis | Bajo | Se busca si ya hay una abierta antes de crear |
| Una alerta con campos enormes | Bajo | Recorte a 500 caracteres |
| n8n queda caído y nadie se entera | **Medio, y no está resuelto** | Ver limitaciones |

### La pregunta incómoda: ¿quién vigila al que vigila?

Si n8n se cae, F02 deja de verificar las copias y **nadie se entera**, porque
el que avisaba era justamente n8n. Es el mismo problema que tuvimos en el
punto 10, cuando el aviso de Alertmanager no salía (405) pero la alerta se
veía, así que todo «parecía» andar.

La salida correcta es que **Prometheus vigile a n8n**, no al revés: un
destino más en `prometheus.yml` y una regla de alerta. **No está hecho**, y
está en las limitaciones.

---

## 7. Cómo se cargan los flujos

Desde la interfaz de n8n (`http://127.0.0.1:5678`), *Import from File*, uno
por uno. Antes hay que crear las cuatro credenciales:

| Credencial | Tipo | Qué lleva |
|---|---|---|
| `CRED_WEBHOOK_ALERTAS` | Header Auth | La cabecera y el valor secreto que Alertmanager tiene que mandar |
| `CRED_MANTIS_API` | Header Auth | `Authorization` + el token de API de Mantis |
| `CRED_SMTP_MAILPIT` | SMTP | `mantis-mail:1025`, sin usuario ni clave |
| `CRED_NEXTCLOUD_BOT` | Basic Auth | La cuenta `automatizacion` y su contraseña de aplicación |

Y en `alertmanager.yml`, agregar el *webhook* de n8n con su cabecera.

> **Por qué a mano y no por script.** n8n tiene API para importar flujos, pero
> para crear credenciales hace falta que ya exista una credencial de API, que
> hay que crear a mano igual. Automatizar el 80% y dejar el 20% sin
> documentar sería peor que documentar el 100%.

---

## 8. La corrida, y lo que la corrida encontró

Hecha el **10/11/2026**. Vale la pena empezar por el resultado incómodo:

> **Ninguno de los tres flujos funcionaba como estaba escrito.** Los tres eran
> JSON válido, los tres se importaron sin protestar, y los tres fallaban: dos
> con un error y uno —el peor— *silenciosamente*, haciendo lo que no
> correspondía. Trece problemas distintos, y ni uno aparecía leyendo el JSON.

### Lo que quedó andando, y cómo se comprobó

| Flujo | Cómo se probó | Resultado |
|---|---|---|
| **F01** | Alerta inyectada en **Alertmanager** (`POST /api/v2/alerts`), no en n8n | Alertmanager la repartió al registro **y** a n8n; n8n abrió la incidencia en Mantis con las etiquetas `automatica, monitoreo` y mandó el correo |
| **F01 (duplicados)** | La misma alerta tres veces | La primera abre; las siguientes **agregan una nota** y no abren otra |
| **F01 (seguridad)** | `POST` sin la cabecera y con el secreto equivocado | **403** en los dos casos |
| **F02** | Calendario puesto a cada minuto durante la prueba | Encontró `restoyadb-20261110-151635.dump`, **466,8 MB**, de hace **0,7 h**, 8 copias guardadas; verificó la cabecera; mandó `[OK]`; **no** abrió incidencia |
| **F03** | Igual | Subió `informe-rendimiento-2026-11-10.md` a Nextcloud y mandó `[ATENCION] 1 hallazgo(s)` |

El hallazgo de F03 no es de adorno: detectó que **`/api/chatbot/` tarda 1150 ms
en el percentil 95**, contra un umbral de 1000 ms. Y su tabla de servicios
muestra los **dos** exportadores de PostgreSQL arriba, que es la comprobación
del E10-04 del punto 6 vista desde otro lado.

### Los trece problemas

Agrupados por lo que enseñan.

**Lo que el repositorio no podía saber del entorno (4):**

1. El campo `active` es `NOT NULL` en la base de n8n. Sin él, el importador
   corta con `null value in column "active"`. Los flujos lo llevan en
   `false`: activarlos es decisión de quien los revisa.
2. Sin un `id` fijo en el JSON, **cada importación crea un flujo nuevo**. Dos
   corridas dejaron seis flujos donde tenían que haber tres. Ahora los ids son
   `restoya-f01-alertas` y compañía, y reimportar sobreescribe.
3. El `/copias` que F02 revisa **no estaba montado** en el contenedor de n8n.
   Sin ese montaje el flujo no ve ninguna copia y abre **una incidencia falsa
   cada noche**: el peor resultado posible para una alerta automática, porque
   enseña a ignorarla.
4. `NEXTCLOUD_USUARIO_BOT` no existía en el contenedor, así que la ruta de
   subida de F03 quedaba cortada (`.../files//RestoYa/...`).

**Supuestos míos sobre otros componentes (5):**

5. **El más grave.** F01 leía las etiquetas de Prometheus en inglés
   (`severity`, `summary`, `description`), y las reglas de este proyecto están
   en castellano (`severidad: critica`, `resumen`, `detalle`, `por_que_*`). Con
   una alerta real la severidad caía al valor por defecto y el filtro de
   críticas la descartaba: **el flujo no habría abierto una sola incidencia, y
   no habría dado ningún error**. Ahora acepta los dos juegos de nombres, los
   de acá primero.
6. F02 buscaba `*.sql.gz` y verificaba con `gzip -t`. Las copias son `*.dump`:
   `backup.sh` usa `pg_dump -Fc`. Mismo efecto que el punto 3: incidencia
   falsa cada noche.
7. `ls --time-style` **no existe en BusyBox**, que es el `ls` de la imagen de
   n8n: el comando imprimía la *ayuda* de `ls` y el flujo se quedaba sin datos.
   Se cambió por un bucle con `stat`, que además da la fecha en segundos desde
   la época y no hay que interpretar texto.
8. Nextcloud rechaza con **HTTP 400** («Access through untrusted domain») todo
   pedido cuya cabecera `Host` no esté en `trusted_domains`. Desde el
   navegador no se nota, porque ahí el `Host` es `127.0.0.1`; lo que se rompe
   es que otro servicio del grupo le hable **por su nombre de red**, que es
   justo lo que hace F03.
9. Un recurso compartido con un grupo **se monta en la raíz del destinatario
   con el nombre de la carpeta**, no con su ruta original. Para la cuenta
   `automatizacion`, la carpeta es `/Rendimiento`, y la ruta larga
   `/RestoYa/04-Informes/Rendimiento` devuelve 404.

**Errores de diseño del flujo (2):**

10. Las tres consultas a Prometheus de F03 salían **en paralelo** del activador
    y entraban al mismo nodo de análisis. En n8n eso hace que el análisis corra
    una vez por rama que llega, y el código lee las otras dos con
    `$('otro nodo')`: la primera vez, las otras todavía no se ejecutaron y n8n
    corta con `Referenced node is unexecuted`. Encadenadas en serie corre una
    sola vez. Son tres consultas de milisegundos: el paralelismo no compraba
    nada y rompía el flujo.
11. En el nodo «Convert to File», la operación `toBinary` significa **«pasar
    una cadena base64 a archivo»**. Con texto plano adentro lo decodifica como
    base64 y **sube basura binaria sin dar error**. La operación correcta se
    llama `toText`; y un nombre de operación inválido (probé `text`) tampoco
    da error: n8n toma otra cosa y sube basura igual. Dos veces el mismo
    aprendizaje: **la ejecución «correcta» no prueba que el resultado esté
    bien**. Hubo que abrir el archivo subido y leerlo.

**Una afirmación falsa en el propio producto (1):**

12. La descripción que F01 escribía en cada incidencia decía *«esta incidencia
    se cierra sola cuando llegue el aviso de resuelto»*. **No es cierto**: el
    primer filtro sólo deja pasar `firing`, así que un `resolved` no hace
    nada. Se comprobó mandando el aviso de resuelto: la incidencia quedó
    `new`/`open`. La frase ahora dice que cerrarla es trabajo de una persona,
    y cerrar en automático quedó como limitación.

**Y uno de integración (1):**

13. El `http_config` de Alertmanager **no permite cabeceras con nombre
    arbitrario**, así que el `X-Alerta-Token` que había pensado no servía.
    Sólo sabe mandar `Authorization`, con su bloque `authorization`. Se pasó a
    `Authorization: Bearer <secreto>`, con el secreto en un archivo
    (`credentials_file`) y no escrito en `alertmanager.yml`, que sí está en el
    repositorio.

### La moraleja, que es la de la consigna

De los trece, **cinco no daban ningún error**: F01 descartando toda alerta
real, F02 sin ver las copias, F03 subiendo basura, la frase falsa, y los
flujos duplicándose. Un flujo que «se ejecutó con éxito» no es un flujo que
funciona. La única forma de saberlo fue inyectar una alerta de verdad y después
**abrir el archivo que quedó del otro lado**.

---

## 9. Limitaciones

1. **Faltan las capturas de pantalla.** Los tres flujos están cargados,
   activos y verificados (sección 8), pero el informe no incluye todavía
   imágenes del lienzo de n8n, de la lista de ejecuciones ni del buzón.
2. **Nadie vigila a n8n** (sección 6). Es la limitación más importante.
3. **F02 no prueba la restauración**, sólo la integridad del archivo.
4. **F03 no usa un modelo de IA.** Es una decisión justificada (sección 3),
   pero la consigna lo sugería y corresponde decir que no se hizo.
5. **Cerrar la incidencia en automático no está hecho.** Cuando Alertmanager
   avisa que la alerta se resolvió, F01 no cierra la incidencia que abrió: hace
   falta una rama que busque la huella y la cierre. Es la mejora más clara que
   queda pendiente.
6. **No hay un cuarto flujo de eventos de seguridad.** La consigna lo
   mencionaba como opcional. El más útil sería sincronizar el repositorio con
   Nextcloud en cada *merge* a `develop`, que hoy es manual.
7. **El archivo del secreto queda con permisos amplios en Windows.** El script
   hace `chmod 600`, pero sobre NTFS desde Git Bash eso no cambia la lista de
   control de acceso: el archivo queda `644`. En Linux el `chmod` sí aplica.
8. **La prueba de F02 y F03 se hizo con el calendario alterado.** Para no
   esperar a las 3:30 ni al lunes, se importó una copia con el calendario
   puesto a cada minuto, se observó la ejecución y después se reimportaron los
   JSON del repositorio, que llevan los horarios reales (`0 30 3 * * *` y
   `0 0 8 * * 1`). Las ejecuciones son reales; el momento en que ocurrieron,
   forzado.
