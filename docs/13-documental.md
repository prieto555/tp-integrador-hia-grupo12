# Gestión documental con Nextcloud (punto 12)

> Qué hay acá: la estructura de carpetas y por qué es esa, la matriz de
> permisos, qué se guarda y qué **no**, y cuál es la relación entre Nextcloud
> y el repositorio.

---

## 1. La pregunta que hay que contestar primero

Si el repositorio ya tiene toda la documentación del proyecto, **¿para qué
Nextcloud?**

Porque no hacen lo mismo:

| | Repositorio (GitHub) | Nextcloud |
|---|---|---|
| Para qué sirve | Versionar **texto** | Compartir **archivos** |
| Quién entra | Quien tenga cuenta de GitHub y permiso | Cualquiera del equipo, con una cuenta propia |
| Qué guarda bien | Markdown, código, configuración | PDF, capturas, planillas, *dumps*, grabaciones |
| Qué guarda mal | Un PDF de 8 MB, una captura por cada corrida | Nada que necesite historial línea por línea |
| Permisos | Por repositorio | Por carpeta |

**La regla del proyecto, para que no haya dos verdades:**

> El repositorio es la **fuente** de todo lo que es texto. Nextcloud es la
> **copia para leer, comentar y compartir**, más el lugar donde viven los
> archivos que no entran bien en Git. **Si divergen, manda el repositorio.**

Eso está escrito acá a propósito: sin una regla así, a la semana nadie sabe
cuál de las dos copias es la buena.

---

## 2. Cómo está montado

```
┌─ red restoya_documental ───────────────────────────────┐
│                                                        │
│  ┌──────────────┐   ┌──────────────────┐               │
│  │ restoya_     │──►│ restoya_         │               │
│  │ nextcloud    │   │ nextcloud_db     │               │
│  │ 30-apache    │   │ PostgreSQL 16    │               │
│  │ :80          │   └──────────────────┘               │
│  │              │   ┌──────────────────┐               │
│  │              │──►│ restoya_         │               │
│  │              │   │ nextcloud_redis  │               │
│  └──────┬───────┘   └──────────────────┘               │
└─────────┼──────────────────────────────────────────────┘
    127.0.0.1:8081
```

```bash
cd infra/compose && docker compose --profile documental up -d
./infra/documental/preparar-nextcloud.sh
```

**Redis no es decorativo.** Sin él, Nextcloud hace el bloqueo de archivos
sobre la base de datos, y con dos personas subiendo a la vez aparece
`file is locked` sin motivo aparente. Es el problema más reportado de
Nextcloud en Docker y se arregla con un contenedor de 40 MB.

**Base propia**, por la misma razón que Mantis: la herramienta donde se guarda
la documentación del proyecto no debería caerse junto con la base del
proyecto.

**`NEXTCLOUD_TRUSTED_DOMAINS`**: sin esto Nextcloud responde
*«Access through untrusted domain»* y no sirve ni la pantalla de inicio. Es la
primera piedra con la que tropieza todo el mundo.

---

## 3. Estructura de carpetas (entregable: estructura documental)

```
RestoYa/
├── 01-Gestion/
│   ├── Actas/                      reuniones de seguimiento
│   └── Sprints/                    planificación y cierre de cada sprint
├── 02-Arquitectura/
│   └── Diagramas/                  diagramas de arquitectura y de red
├── 03-Configuraciones/
│   ├── Docker/                     compose, Dockerfiles, procedimientos
│   └── Monitoreo/                  Prometheus, Grafana, alertas
├── 04-Informes/
│   ├── Optimizacion/               punto 5
│   ├── Replicacion/                punto 6
│   ├── Seguridad/                  punto 14
│   └── Rendimiento/                ← acá escribe n8n, semanalmente
├── 05-Evidencias/
│   ├── Backups/                    salidas de copia y restauración
│   └── CICD/                       corridas del pipeline
└── 06-Entrega/                     lo que se presenta
```

La numeración **ordena las carpetas por el momento del proyecto en el que se
usan**, que es como la gente las busca. Sin numerar, el orden es alfabético y
`Arquitectura` queda antes que `Gestion` por una razón que no le importa a
nadie.

`04-Informes/Rendimiento` existe porque **ahí escribe el flujo F03 de n8n**
todos los lunes. Es la única carpeta a la que un proceso automático tiene
permiso de escritura, y por eso está separada.

---

## 4. Matriz de permisos (entregable)

Nextcloud suma permisos: 1 leer, 2 actualizar, 4 crear, 8 borrar, 16 volver a
compartir.

| Grupo / cuenta | Carpeta | Permisos | Valor | Por qué |
|---|---|---|---|---|
| `equipo` (5 personas) | `RestoYa/` | leer, crear, actualizar, borrar | **15** | Trabajan sobre todo el proyecto |
| `equipo` | — | **no** volver a compartir | (excluido) | Ver abajo |
| `automatizacion` (n8n) | `RestoYa/04-Informes/Rendimiento/` | leer, **crear** | **5** | **No puede borrar ni modificar** |
| `lectura` | `RestoYa/` | leer | **1** | Para la defensa: una cuenta que mira y no toca |
| `admin` | todo | todo | 31 | La cuenta de administración |

### Las dos decisiones que importan

**Nadie puede volver a compartir (16 excluido), y los enlaces públicos están
apagados.**

```
occ config:app:set core shareapi_allow_links --value="no"
occ config:app:set core shareapi_enforce_links_password --value="yes"
```

La consigna pide *«verificar el acceso únicamente a los usuarios
autorizados»*. Eso se vuelve imposible si cualquiera del equipo puede generar
un enlace público desde adentro: a partir de ahí el control de acceso no
significa nada y nadie se entera.

**El robot puede crear pero no borrar ni modificar (5, no 15).**

n8n sube un informe por semana. No necesita borrar nada nunca. Si el flujo se
vuelve loco —un disparador mal puesto, un bucle— lo peor que puede hacer es
llenar esa carpeta de archivos. Con permiso de borrado, lo peor que puede
hacer es vaciarla.

**La cuenta del robot es propia, no la del administrador.** Dos razones: si
mañana hay que cortarle el acceso, se desactiva esa cuenta y nada más; y en el
registro de auditoría se ve cuál subida la hizo una persona y cuál un flujo.

### El registro de auditoría

```
occ app:enable admin_audit
```

Es lo que permite responder «quién bajó qué y cuándo», que es la mitad de lo
que sirve tener gestión documental. Sin eso, Nextcloud es una carpeta
compartida con interfaz linda.

---

## 5. Cuentas

Seis: las cinco personas del equipo y `automatizacion` (el robot).

Las contraseñas **se generan al azar en el script y se anexan a
`infra/compose/.env`**, que está en `.gitignore`. No se imprimen en pantalla
ni quedan en el historial de la terminal.

```bash
# en preparar-nextcloud.sh
clave="$(head -c 18 /dev/urandom | base64 | tr -d '/+=')"
OC_PASS="$clave" docker exec -e OC_PASS="$clave" ... php occ user:add --password-from-env ...
```

`--password-from-env` existe justamente para que la contraseña no viaje en la
línea de comandos, donde sería visible en `ps` para cualquier proceso de la
máquina.

### Por qué grupos y no permisos por persona

Cuando entra o sale alguien hay que tocar **una** cosa. Dar permisos por
persona es lo que produce carpetas a las que todavía accede gente que se fue.

---

## 6. Qué NO se guarda acá

La consigna lo pide: *«evitar almacenar secretos sin protección»*.

| Qué | Dónde va | Por qué no en Nextcloud |
|---|---|---|
| `.env` con contraseñas | Sólo en la máquina, en `.gitignore` | Un archivo de texto con las claves de producción, en un servidor web, con seis cuentas que pueden bajarlo |
| Tokens de API (Mantis, GitHub) | `.token-api` local, `.gitignore` | Igual |
| Copias de la base con datos reales | Volumen de copias | Los datos son sintéticos **hoy**; si algún día fueran reales, una copia en Nextcloud es una filtración esperando |
| Claves privadas, certificados | No existen todavía | Igual |

Lo que **sí** va: informes, diagramas, configuraciones **sin secretos**,
evidencias, actas, capturas.

La regla, corta: **si para que algo funcione hace falta ese archivo y una
contraseña, el archivo puede ir; la contraseña no.**

---

## 7. Qué se sube y cómo

El script sube los informes que ya están escritos, por WebDAV:

| Archivo del repositorio | Dónde queda |
|---|---|
| `README.md` | `RestoYa/README.md` |
| `docs/05-docker.md` | `03-Configuraciones/Docker/` |
| `docs/06-carga-datos.md` | `02-Arquitectura/` |
| `docs/07-optimizacion-sql.md` | `04-Informes/Optimizacion/` |
| `docs/08-monitoreo.md` | `03-Configuraciones/Monitoreo/` |
| `docs/09-seguridad.md` | `04-Informes/Seguridad/` |
| `docs/10-cluster.md` | `04-Informes/Replicacion/` |
| `docs/11-cicd.md` | `05-Evidencias/CICD/` |
| `docs/12-incidencias.md`, `13-documental.md`, `14-automatizacion.md` | `01-Gestion/` |

El script es idempotente: volver a correrlo actualiza los archivos y no
duplica carpetas ni cuentas.

---

## 8. La corrida

Hecha el **10/11/2026** contra Nextcloud **30.0.17**. Lo que quedó, leído de
vuelta por WebDAV y por la API de compartidos, no de lo que el script dijo:

| Qué | Verificado |
|---|---|
| Grupos | `equipo` (5 personas), `automatizacion` (el robot), `lectura` |
| Cuentas | 6, con claves al azar guardadas en el `.env` y nunca impresas |
| Carpetas | **18** bajo `RestoYa/` |
| Documentos subidos | **11** |
| Compartidos | 3, sin duplicados |
| Enlaces públicos | `shareapi_allow_links = no` |
| Auditoría | `admin_audit` habilitada y **escribiendo** |

### La matriz de permisos, comprobada y no declarada

Los permisos de Nextcloud son una suma de bits: 1 leer, 2 modificar, 4 crear,
8 borrar, 16 volver a compartir.

| Compartido con | Permisos | Qué significa |
|---|---|---|
| `equipo` | **15** | leer, crear, modificar y borrar — **sin el 16: no pueden volver a compartir** |
| `automatizacion` | **5** | leer y crear, **nada más** |
| `lectura` | **1** | sólo leer |

El 5 del robot se probó de las dos puntas, entrando como la cuenta
`automatizacion`:

```
PUT    Rendimiento/ZZZ-prueba.md  -> HTTP 201
DELETE Rendimiento/ZZZ-prueba.md  -> HTTP 403
```

Puede dejar su informe y **no puede borrar nada**, que es exactamente lo que se
buscaba: si el flujo de n8n se vuelve loco, el daño que puede hacer es dejar
archivos de más, no llevarse los que había.

### Tres cosas que sólo se vieron al correrlo

1. **La auditoría estaba habilitada y no registraba nada.** `admin_audit`
   escribe sus anotaciones en nivel *info* y el nivel por defecto de Nextcloud
   es *warning*, así que el archivo quedaba en **cero bytes** y todo parecía en
   orden. Hace falta `loglevel = 1`. Se comprobó generando una acción y
   leyendo el archivo: aparecieron los intentos de ingreso y un
   `File with id "180" deleted`. Una medida de seguridad que no se verifica no
   es una medida de seguridad.
2. **La ruta de los compartidos no lleva barra inicial.** La API OCS responde
   **404 «Wrong path, file/folder does not exist»** a `path=/RestoYa` y
   **200** a `path=RestoYa`, con la carpeta existiendo y estando indexada en
   los dos casos. El error no insinúa que el problema sea el formato.
3. **El nombre interno del contenedor tiene que estar en `trusted_domains`.**
   Nextcloud rechaza con **HTTP 400** todo pedido cuya cabecera `Host` no
   figure ahí. Desde el navegador no se nota, porque el `Host` es
   `127.0.0.1`; lo que se rompe es que **otro servicio del grupo le hable por
   su nombre de red**, que es justo lo que hace el flujo F03 del punto 13 para
   subir su informe. Está en el script.

Las tres quedaron resueltas dentro de `preparar-nextcloud.sh`, que se corrió
tres veces: la segunda y la tercera no volvieron a crear carpetas ni a
duplicar compartidos. Los documentos **sí** se vuelven a subir en cada
corrida, a propósito, para que refrescar la documentación sea un comando.

---

## 9. Limitaciones

1. **Faltan las capturas de pantalla.** Nextcloud está levantado, poblado y
   con los permisos verificados (sección 8); lo que no está son las imágenes
   de la interfaz, del diálogo de compartidos y del registro de auditoría.
2. **Va por HTTP, no HTTPS.** Es aceptable mientras sólo escuche en
   `127.0.0.1`. En cuanto se publique por el túnel del punto 9, **tiene que
   ir por HTTPS**: hoy las contraseñas viajan en claro por el bucle local.
3. **No hay copia de seguridad de Nextcloud.** Es el segundo servicio sin
   copia propia, después de Mantis. Si el volumen se pierde, se pierde lo que
   haya ahí que no esté en el repositorio: capturas, actas, los informes que
   genera n8n.
4. **El versionado de archivos de Nextcloud no reemplaza a Git.** Guarda
   versiones anteriores, pero sin mensajes, sin autor claro y sin diferencias
   legibles. Por eso la regla de la sección 1.
5. **La sincronización repositorio → Nextcloud es manual** (correr el
   script). No hay un flujo que la haga sola en cada *merge*. Sería un cuarto
   flujo de n8n razonable, y no se hizo.
6. **El `loglevel = 1` que necesita la auditoría hace verboso el registro
   general.** Nextcloud escribe en `nextcloud.log` todo lo de nivel *info*, no
   sólo lo de la auditoría. En este laboratorio no molesta; en producción
   convendría separar los destinos o rotar ese archivo.
