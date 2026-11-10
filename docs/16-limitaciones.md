# Limitaciones conocidas y mejoras futuras

> Documento 16 del punto 15. Junta en un solo lugar lo que **no** resuelve este
> trabajo. Cada informe tiene su propia sección de limitaciones; acá están
> todas, ordenadas por lo que más duele.
>
> Esto no es una lista de disculpas. Es la parte del trabajo que permite decir
> con precisión hasta dónde llega lo que se hizo, que es lo que distingue un
> sistema entendido de uno que anda por casualidad.

---

## 1. Lo que hay que saber antes de cualquier otra cosa

### 1.1 Todo corre en una sola máquina

Dos nodos de PostgreSQL, las copias de seguridad, el monitoreo y las tres
herramientas auxiliares viven en la misma notebook, en el mismo disco.

Eso protege contra que se caiga un proceso o se corrompa un archivo de datos.
**No protege contra que se rompa el disco, se incendie el edificio o alguien
se lleve la máquina.**

Una réplica en el mismo equipo es *alta disponibilidad de proceso*, no
*recuperación ante desastres*. Lo mismo vale para las copias del punto 4: una
copia en el mismo disco que el original no es una copia, es un archivo más.

**Mejora**: una copia fuera de la máquina. Es la de mejor relación entre
esfuerzo y riesgo evitado de toda esta lista.

### 1.2 No hay *failover* automático

Es la limitación central del punto 6 y está explicada en
[`10-cluster.md`](10-cluster.md). La detección existe —Prometheus avisa a los
90 s— pero la promoción es manual, y después de promover **nada impide el
cerebro dividido** salvo que nadie levante el nodo viejo. Eso es un
procedimiento, no un control.

**Mejora**: Patroni + etcd + HAProxy. El grupo ya lo hizo en el TP de Clúster
de esta misma materia, con *failover* medido en 5 segundos.

### 1.3 La aplicación no está publicada en Internet (punto 9)

Necesita una cuenta de Cloudflare o Tailscale que todavía no existe. La
consigna pide que esté accesible **durante la demostración final**, así que es
lo más urgente de la lista por fecha, aunque no por riesgo.

---

## 2. Seguridad

Del informe [`09-seguridad.md`](09-seguridad.md):

| Limitación | Por qué importa |
|---|---|
| **No hay doble factor ni revocación de sesiones.** Un JWT robado sirve hasta que vence | Es el agujero más grande que queda en la aplicación |
| **El limitador de peticiones guarda el estado en memoria.** Se reinicia con el proceso y se multiplica por cada réplica del backend | Un reinicio borra el conteo de intentos de login |
| **Las imágenes no están firmadas.** Nada impide que alguien publique una imagen con el mismo nombre | Cadena de suministro |
| **Dos vulnerabilidades sin parche publicado**: `brotli` en Alpine y la biblioteca estándar de Go en la imagen de `postgres` | No se pueden arreglar; hay que revisarlas cada tanto |
| **Nextcloud y Mantis van por HTTP** | Aceptable mientras sólo escuchen en `127.0.0.1`. **En cuanto se publique el túnel del punto 9, tienen que ir por HTTPS**: hoy las contraseñas viajan en claro |
| **La contraseña de replicación queda en `postgresql.auto.conf`**, dentro del volumen | Es como funciona `pg_basebackup -R`. Importa si ese volumen se copia a otro lado |

---

## 3. Base de datos

| Limitación | Dónde |
|---|---|
| **La réplica no descarga escrituras**, sólo lecturas. Si el cuello de botella fueran las escrituras, esto no ayudaría: haría falta particionar | [`10-cluster.md`](10-cluster.md) |
| **La ranura de replicación puede llenar el disco** si la réplica queda caída mucho tiempo. Se vigila en Grafana; no hay corte automático | [`10-cluster.md`](10-cluster.md) |
| **Las vistas materializadas se refrescan a mano.** No hay un trabajo programado que las actualice | [`07-optimizacion-sql.md`](07-optimizacion-sql.md) |
| **Los datos son sintéticos.** Las distribuciones son plausibles, no reales: un conjunto real tendría sesgos (horarios pico, productos que casi no se venden) que cambiarían algunos planes de ejecución | [`06-carga-datos.md`](06-carga-datos.md) |

---

## 4. Monitoreo

Del informe [`08-monitoreo.md`](08-monitoreo.md):

- **cAdvisor no enumera los contenedores uno por uno.** Este Docker Desktop usa
  el almacén de imágenes de containerd y cAdvisor busca la capa de escritura
  donde el almacén clásico la pone. Las dos salidas son cambiar la
  configuración de Docker Desktop **de la máquina de alguien**, no del
  proyecto. Mitigado con el agregado `id="/docker"` y las métricas propias del
  backend. Es la incidencia **INC-15**, y sigue abierta a propósito.
- **No se monitorean consultas SQL individuales.** La consigna avisa
  expresamente que no hay que afirmar eso si sólo se miran métricas generales
  del motor. No lo afirmamos: `pg_stat_statements` está habilitado y se usó
  para el punto 5, pero el exportador publica métricas agregadas.
- **Nadie vigila a n8n.** Si n8n se cae, el flujo que verifica las copias deja
  de correr y **nadie se entera**, porque el que avisaba era n8n. Es el mismo
  problema que tuvimos cuando el aviso de Alertmanager no salía pero la alerta
  se veía. **Mejora**: un destino más en `prometheus.yml` y una regla.

---

## 5. CI/CD

Del informe [`11-cicd.md`](11-cicd.md):

| Limitación | Detalle |
|---|---|
| **El backend no tiene pruebas unitarias.** `npm test` sigue siendo el `exit 1` que viene por defecto | El informe explica por qué se priorizó la prueba de integración; no por qué no harían falta |
| **El *runner* autoalojado hay que registrarlo a mano** | Mientras no esté, el *pipeline* publica las imágenes igual y el despliegue queda en espera |
| **La prueba de humo corre con la base vacía** | No detecta lo que sólo aparece con volumen, como el `heap out of memory` del punto 5 |
| **El escaneo frena sólo por vulnerabilidades con parche** (`ignore-unfixed`) | Las otras están en la sección 2 y hay que revisarlas a mano |
| **El despliegue no corre migraciones de esquema** | Es deliberado: una migración no se deshace volviendo la imagen. Pero significa que un cambio de modelo necesita un paso manual |
| **Las pruebas de Angular no corren en CI** | Son las que genera `ng new` y no comprueban nada del negocio |

---

## 6. Procesos y herramientas

| Limitación | Dónde |
|---|---|
| **Las incidencias están todas a nombre de una persona.** Es quien hizo el trabajo; poner los nombres de los compañeros en trabajo que no hicieron sería inventar un historial | [`12-incidencias.md`](12-incidencias.md) |
| **No hay enlace automático entre Mantis y GitHub.** El vínculo es el SHA escrito en el *ticket*. Lo correcto a futuro es al revés: abrir la incidencia primero y que el *commit* la cite | [`12-incidencias.md`](12-incidencias.md) |
| **Ni Mantis ni Nextcloud tienen copia de seguridad.** El servicio de copias respalda la base de la aplicación y nada más | [`12-incidencias.md`](12-incidencias.md), [`13-documental.md`](13-documental.md) |
| **La sincronización repositorio → Nextcloud es manual.** Sería un cuarto flujo de n8n razonable | [`13-documental.md`](13-documental.md) |
| **F02 no prueba la restauración**, sólo la integridad del archivo. La restauración real está medida en el punto 4 y se corre a mano | [`14-automatizacion.md`](14-automatizacion.md) |
| **Las credenciales de n8n se cargan a mano.** Automatizar el 80% y dejar el 20% sin documentar sería peor que documentar el 100% | [`14-automatizacion.md`](14-automatizacion.md) |

---

## 7. Lo que está escrito y todavía no corrió

Esto no son limitaciones de diseño: es trabajo pendiente, y conviene no
confundirlos.

| Qué | Estado |
|---|---|
| Prueba de caída del primario (`simular-caida.sh`) | El script está escrito y mide cada paso. **Falta correrlo** y pegar los números en [`10-cluster.md`](10-cluster.md) |
| Las 15 incidencias cargadas en Mantis | El contenido, la configuración y los dos scripts están. **Falta levantar Mantis y correrlos** |
| Nextcloud con su estructura y permisos | Igual |
| Los tres flujos de n8n ejecutados | Los JSON están escritos y son válidos. **Faltan las ejecuciones y la prueba de fallo** |
| Capturas del tablero de Grafana | Está aprovisionado desde el repositorio y verificado consulta por consulta; faltan las capturas |

**La causa es una sola**: el motor de Docker de la máquina dejó de arrancar el
10/11. El proceso de Docker Desktop corre, la distro WSL `docker-desktop` queda
en `Stopped` y el *pipe* del motor nunca aparece.

---

## 8. Mejoras futuras, por orden de lo que más suma

1. **Una copia de seguridad fuera de la máquina.** Mejor relación entre
   esfuerzo y riesgo evitado de toda la lista (§1.1).
2. **Doble factor y revocación de sesiones** (§2).
3. **Que Prometheus vigile a n8n** (§4). Son diez líneas.
4. **Patroni + etcd + HAProxy** para *failover* automático de verdad (§1.2).
5. **Pruebas unitarias del backend**, empezando por la lógica de precios y
   estados de pedido, que es donde un error no se ve hasta que alguien paga de
   menos.
6. **Refresco programado de las vistas materializadas** (§3).
7. **Firmar las imágenes** con `cosign` (§2).
8. **Un cuarto flujo de n8n** que sincronice el repositorio con Nextcloud en
   cada *merge* a `develop` (§6).
