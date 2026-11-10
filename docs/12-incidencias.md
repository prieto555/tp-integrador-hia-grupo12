# Gestión de incidencias con MantisBT (punto 11)

> Qué hay acá: cómo está montado Mantis, qué incidencias se cargaron y de
> dónde salieron, cómo se vincula cada una con el código, y qué queda abierto.

---

## 1. Las incidencias son reales

La consigna pide *«al menos 10 incidencias reales o reproducibles del entorno
de prueba, incluyendo al menos una relacionada con rendimiento y otra con
seguridad»*.

Hay **17**, y ninguna está inventada. Todas aparecieron trabajando los puntos
4 a 14 de este mismo trabajo, todas tienen pasos para reproducirlas, y 15 de
las 17 tienen un *commit* que las cierra.

Las dos últimas, **INC-16** e **INC-17**, las encontró el propio *pipeline* del
punto 8 en sus primeras corridas: un bucle de reinicio de pgAdmin que el
entorno de la máquina venía disimulando, y que el proyecto **no se podía
levantar de cero** porque nada creaba el volumen declarado como `external`.
Ninguno de los dos es un error de código: son suposiciones sobre el entorno que
nadie había escrito, y es exactamente para eso que sirve tener integración
continua.

| | Cantidad |
|---|---|
| Total | 17 |
| De seguridad | 6 |
| De rendimiento | 3 |
| Cerradas con corrección verificada | 16 |
| Abiertas | 1 (limitación del entorno, a propósito) |
| Horas registradas | 27,0 |

La lista completa, con descripción, pasos, notas, horas, *commit* y
verificación, vive en
[`infra/incidencias/incidencias.json`](../infra/incidencias/incidencias.json),
que es lo que carga el script. Está en un solo archivo para que la lista no
exista en dos lugares distintos.

### Las tres que más enseñan

**INC-01 — `GET /api/pedidos/cocina` tumbaba el backend entero.**
Sin `LIMIT`, la pantalla de cocina traía 1.330.000 pedidos y el proceso de
Node moría con `JavaScript heap out of memory`. Lo que la hace interesante:
después de poner el índice, la consulta SQL bajó de 1204,8 ms a **0,9 ms** y
**el proceso seguía muriendo**. Un índice acelera encontrar las filas, no
evita traerlas. El problema no era la base.

**INC-06 — dos cosas chicas que suman un camino de ataque.**
`X-Forwarded-For` sin `trust proxy` (INC-05) dejaba sin efecto el límite de
intentos de login. Al arreglarlo, Trivy encontró una vulnerabilidad **crítica**
en `proxy-addr` —la biblioteca que Express usa justamente para eso— que
permite falsificar la dirección. Por separado, dos detalles menores. Juntas:
el límite de intentos de login se podía esquivar cambiando un encabezado. Y el
código del grupo no tenía el fallo: es un ataque a la cadena de suministro, de
los que el punto 14 pide considerar.

**INC-02 — `origin.includes('onrender.com')`.**
Es `String.prototype.includes`, no `Array.prototype.includes`: pregunta si ese
texto aparece **en algún lado** del origen. `onrender.com.sitio-falso.net`
pasaba el control de CORS. Se lee bien, por eso nadie lo vio.

### La que queda abierta, a propósito

**INC-15 — cAdvisor no enumera los contenedores.** Este Docker Desktop usa el
almacén de imágenes de containerd, y cAdvisor busca la capa de escritura donde
el almacén clásico la pone. Las dos salidas son cambiar la configuración de
Docker Desktop **de la máquina de alguien**, no del proyecto. Queda
`acknowledged` con la mitigación documentada, que es lo honesto: cerrarla
diciendo «no se puede» sería esconderla.

---

## 2. Por qué Mantis y no GLPI

La consigna permite los dos. Mantis porque es un **seguidor de errores**, que
es lo que necesita un proyecto de software; GLPI es sobre todo gestión de
activos y mesa de ayuda de sistemas. Además el grupo ya lo había usado en el
TP de Gestión de Incidencias de esta materia, así que la curva de aprendizaje
ya estaba pagada.

### Por qué MariaDB y no el PostgreSQL que ya está

Es deliberado, y es el tipo de decisión que conviene poder defender.

> Mantis es la herramienta donde se anotan los problemas **de** la aplicación.
> Si compartiera el motor con la aplicación, un problema de ese motor se
> llevaría puesto el lugar donde hay que anotarlo.

Motor propio, volumen propio, red propia (`restoya_incidencias`). Mantis no
puede hablarle a la base de la aplicación ni al revés.

---

## 3. Cómo está montado

```
┌─ red restoya_incidencias ──────────────────────────────┐
│                                                        │
│  ┌──────────────┐   ┌───────────────┐   ┌───────────┐  │
│  │ restoya_     │   │ restoya_      │   │ restoya_  │  │
│  │ mantis       │──►│ mantis_db     │   │ mantis_   │  │
│  │ MantisBT     │   │ MariaDB 11.4  │   │ mail      │  │
│  │ 2.28.4       │   │               │   │ Mailpit   │  │
│  │ :80          │   │ :3306         │◄──┤ :1025 SMTP│  │
│  └──────┬───────┘   └───────────────┘   └─────┬─────┘  │
│         │                                     │        │
└─────────┼─────────────────────────────────────┼────────┘
   127.0.0.1:8089                        127.0.0.1:8025
     (interfaz)                        (buzón, sólo web)
```

```bash
cd infra/compose && docker compose --profile incidencias up -d
```

Tres cosas de seguridad que vale la pena señalar:

1. **Los dos puertos salen sólo a `127.0.0.1`.** Desde otra máquina de la red
   no se llega.
2. **El puerto 1025 (SMTP) de Mailpit no se publica.** Sólo la interfaz web
   del buzón. Un SMTP abierto al *host* es un relé de correo esperando que
   alguien lo encuentre.
3. **El `config_inc.php` sale del repositorio** y la contraseña de la base
   **no está adentro**: sale de `MANTIS_DB_PASSWORD`, que vive en el `.env`,
   fuera de Git.

### Por qué Mailpit

Mantis manda correo: altas de usuario, cambios de estado, asignaciones. Con un
SMTP real, cada prueba mandaría correos a casillas reales. Mailpit los recibe
todos y **no manda ninguno afuera**, que es exactamente lo que corresponde en
un entorno de laboratorio.

### Configuración que no es la de fábrica

| Ajuste | Valor | Por qué |
|---|---|---|
| `$g_allow_signup` | `OFF` | Alta libre sin verificación es una invitación al spam, y rompe la trazabilidad |
| `$g_allow_anonymous_login` | `OFF` | Si cualquiera puede reportar sin identificarse, no se sabe a quién volver a preguntar |
| `$g_file_upload_method` | `DATABASE` | La copia de Mantis es una sola cosa y no «la base más una carpeta que alguien se tiene que acordar» |
| `$g_time_tracking_enabled` | `ON` | Hace falta para poder decir cuánto costó cada incidencia |
| `$g_update_readonly_bug_threshold` | `UPDATER` | Una incidencia resuelta queda de sólo lectura, pero quien verifica tiene que poder dejar su nota antes del cierre |
| `$g_reauthentication` | `ON` | Pedir la contraseña de nuevo para emitir un token de API es lo correcto |
| `$g_bug_report_page_fields` | recortado | Se saca del formulario de alta lo que decide el equipo —prioridad, asignación, fecha prevista— y no quien reporta |

---

## 4. Categorías, prioridades y responsables (actividad 2)

### Categorías

Siete, una por frente técnico del proyecto: `Backend`, `Frontend`,
`Base de datos`, `Infraestructura y Docker`, `Seguridad`, `Monitoreo`,
`CI/CD`. Coinciden con las ramas del repositorio a propósito: así la categoría
de la incidencia dice sola en qué rama se arregla.

### Severidad y prioridad

No son lo mismo y se usan distinto:

- **Severidad** = cuánto daño hace. La fija quien reporta.
- **Prioridad** = en qué orden se arregla. La fija el equipo.

| Severidad | Cuándo |
|---|---|
| `block` | El sistema no se puede usar (INC-01: el backend se caía) |
| `crash` | Se cae un proceso o hay una vulnerabilidad crítica (INC-06) |
| `major` | Funciona mal o hay un agujero de seguridad explotable |
| `minor` | Molesta pero hay forma de seguir |

| Prioridad | Cuándo |
|---|---|
| `immediate` | Se arregla ahora: el sistema está caído o hay algo explotable sin autenticación |
| `urgent` | Esta semana |
| `high` | Antes de la entrega |
| `normal` | Cuando se pueda |

### Responsables

**Todas las incidencias están reportadas y resueltas por `gprieto`.** No es un
descuido: es quien hizo el trabajo hasta ahora. Poner los nombres de los
compañeros en trabajo que no hicieron sería inventar un historial, y el
historial es justamente lo que este punto pide mostrar.

Las cinco cuentas del equipo **sí** están creadas, porque el equipo es ese.
Cuando el grupo reparta los cinco frentes, lo que siga abierto se reasigna.

---

## 5. Vincular la incidencia con el código (actividad 5)

Cada incidencia lleva en «información adicional» tres cosas:

```
--- Vinculo con el codigo (punto 11, actividad 5) ---
Commit que la cierra: 44bb050
Archivos tocados: backend/src/controllers/pedido.controller.js

--- Verificacion (actividad 7) ---
Con el limite puesto, la misma pantalla responde en 0,9 ms y el proceso
se queda en 41 MB. Se repitio la navegacion 10 veces seguidas sin que el
contenedor se reinicie.
```

El vínculo es por SHA del *commit* y no por número de incidencia en el mensaje
del *commit*, porque los *commits* se escribieron antes de que Mantis
existiera. Es la dirección que se podía: del *ticket* al código.

> **Para la próxima.** Lo correcto a futuro es al revés: abrir la incidencia
> primero y que el mensaje del *commit* la cite. Eso hace que GitHub y Mantis
> se enlacen solos. Queda dicho porque es una mejora real, no porque haya que
> poner algo.

---

## 6. El ciclo de vida se recorre de verdad

El script **no** crea las incidencias ya cerradas. Las crea nuevas y después
las mueve:

```
nueva  →  asignada  →  resuelta (fixed)  →  cerrada
```

Crearlas cerradas dejaría el historial vacío, y el historial es lo que la
consigna pide evidenciar («evidencias de asignación y seguimiento», «historial
de resolución»). Cada paso queda con su fecha y su autor.

---

## 7. Cómo se carga

Dos pasos, los dos repetibles:

```bash
./infra/incidencias/preparar-mantis.sh
```

Crea el esquema si la base está vacía, el proyecto, las siete categorías, las
cinco cuentas y emite un token de API. Además **cambia la contraseña por
defecto** (`administrator`/`root`): la genera al azar y la guarda en
`infra/compose/.env`, sin imprimirla.

Sobre el esquema: **la imagen no instala nada.** Trae MantisBT y Apache, y el
esquema lo crea `admin/install.php`, que es un formulario web. Y el
*entrypoint* de la imagen **esconde la carpeta `admin/`** salvo que
`MANTIS_ENABLE_ADMIN` valga 1 — lo cual está bien y no se cambió, porque esa
carpeta trae el instalador y las herramientas de mantenimiento: publicada,
cualquiera que llegue al puerto puede reinstalar la base encima. Así que el
procedimiento es encender esa carpeta, instalar, y volver a apagarla, y eso es
lo que hace el script. Sin ese paso, Mantis devuelve **HTTP 500 en todas sus
páginas**, con el error `SQL Statement failed on preparation: SELECT * FROM
mantis_user_table`, que no dice en ningún lado que falta instalar.

```bash
node infra/incidencias/cargar-incidencias.js
```

Carga las 17 con sus notas, sus horas y sus cambios de estado. Con `--seco`
muestra qué haría sin escribir nada; con `--solo INC-07` carga una sola.

### La corrida

Hecha el **10/11/2026**. Lo que quedó en la instancia, leído de vuelta por la
API REST (`GET /api/rest/issues?project_id=1`) y no de lo que el script dijo
que hizo:

| Qué | Verificado |
|---|---|
| Incidencias | **17** |
| Estado | 16 `closed`, 1 `acknowledged` |
| Por categoría | 6 Seguridad, 4 Infraestructura y Docker, 3 Monitoreo, 2 Backend, 2 Base de datos |
| Por severidad | 1 `block`, 1 `crash`, 11 `major`, 4 `minor` |
| Con al menos una nota | 17 de 17 |
| Con etiquetas | 17 de 17 |

La segunda corrida reconoció las 17 como ya cargadas y no duplicó ninguna, que
es la prueba de que el script es idempotente de verdad y no de palabra.

### Por qué un script y no a mano

Cada incidencia lleva descripción, pasos, información adicional, una o dos
notas, registro de horas y dos o tres cambios de estado. Son unas **135
operaciones**. A mano: una tarde, erratas garantizadas, y nada repetible si
hay que rehacer el entorno.

El script es idempotente: una incidencia cuyo resumen ya existe no se vuelve a
crear.

### Un detalle feo que conviene decir

Mantis **no tiene API para administrar** usuarios ni proyectos: la API REST
sirve para incidencias y poco más. Para lo demás hay que usar los mismos
formularios web que usaría una persona, arrastrando la cookie de sesión y el
token anti-CSRF de cada página. Es lo que hace `preparar-mantis.sh`. No es
elegante; es preferible a dejar veinticinco pasos manuales sin documentar.

Y para emitir el token de API, Mantis exige reautenticarse, cosa que un script
no puede responder. El script desactiva esa exigencia mientras dura la emisión
y **la vuelve a activar pase lo que pase** (con un `trap`, no con una línea al
final que no corre si algo falla antes). Eso se comprobó: una corrida que falló
en medio de la emisión dejó igual `\$g_reauthentication = ON`.

#### Tres cosas que la primera corrida dejó en claro

Ninguna estaba en la documentación de Mantis, y las tres dan errores que
apuntan a otro lado:

1. **El cambio de contraseña se descarta en silencio si no se manda la actual.**
   El formulario de `account_update.php` tiene un campo `password_current`.
   Sin él, Mantis responde **HTTP 200**, no dice nada, y la contraseña sigue
   siendo la de fábrica. El script lo detectaba tarde: ahora, si no puede
   volver a entrar con la contraseña nueva, prueba la de fábrica y **dice** que
   el formulario descartó el cambio en lugar de un «no se pudo entrar» a secas.
2. **El resumen no puede pasar de 128 caracteres**, porque
   `mantis_bug_table.summary` es `varchar(128)`, y hay que contar el prefijo
   `INC-NN — ` que el cargador agrega adelante. INC-08 llegaba a 132 y fallaba.
   Lo peor no es el límite sino el error: MySQL se queja, Mantis lo convierte en
   `trigger_error(E_USER_ERROR)`, y como eso está en desuso desde PHP 8.4, la
   API devuelve un **500 cuyo mensaje habla de la deprecación de PHP y no de la
   columna**. El cargador ahora mide los 17 resúmenes **antes** de la primera
   llamada y, si alguno no entra, dice cuál y cuántos caracteres sacarle.
3. **El token de API se muestra en un `<div class="well">`**, no en un campo de
   formulario. El script lo buscaba como un `input readonly` y se quedaba sin
   token, y con `set -o pipefail` un `grep` sin coincidencias cortaba el script
   sin mensaje. Los `grep` de los que se extraen valores llevan ahora
   `|| true`, para que el error lo dé la comprobación siguiente y no el `set -e`.

---

## 8. Integración con n8n

El flujo F01 del punto 13 abre incidencias solo a partir de las alertas
críticas de Prometheus, y el F02 abre una si falla la verificación de las
copias. Las dos quedan con la etiqueta `automatica`, para poder distinguir de
un vistazo lo que reportó una persona de lo que reportó un robot.

Está explicado en [`14-automatizacion.md`](14-automatizacion.md).

---

## 9. Limitaciones

1. **Faltan las capturas de pantalla.** Las 17 incidencias están cargadas y
   verificadas por la API (sección 7), pero el informe no incluye todavía
   imágenes del tablero de Mantis, del ciclo de vida de un *ticket* ni del
   buzón de Mailpit. Es trabajo de pantalla, no de configuración.
2. **El registro de horas se carga como nota y no en el campo de tiempo.** La
   API REST de Mantis 2.28 no expone el registro de horas, y tocarlo por
   debajo, directo en la base, sería peor.
3. **Todo está asignado a una sola persona** (sección 4).
4. **No hay enlace automático entre Mantis y GitHub.** El vínculo es el SHA
   escrito en el *ticket* (sección 5).
5. **Mantis no tiene copia de seguridad propia.** El servicio de copias del
   punto 4 respalda la base de la aplicación, no la de Mantis. Para una
   herramienta de laboratorio es aceptable; en producción no lo sería.
