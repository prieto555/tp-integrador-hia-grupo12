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

### 1.3 La aplicación está publicada, y eso cambia el riesgo (punto 9)

La aplicación está en **https://restoya.liners-panel.com**, por un túnel de
Cloudflare. Lo único publicado es nginx; las nueve herramientas internas no
están en el *ingress* (ver [`15-publicacion.md`](15-publicacion.md) §3).

**Publicar destapó dos problemas que en local no se veían**, los dos
corregidos y medidos: las tres cabeceras de seguridad de nginx no llegaban a
ninguna respuesta de HTML, y el backend veía la IP del contenedor de
`cloudflared` en vez de la del visitante, lo que convertía el límite de
intentos de inicio de sesión en un interruptor para dejar afuera a todo el
mundo. Son los hallazgos 13 y 14 de [`09-seguridad.md`](09-seguridad.md).

**Y lo que sigue siendo una limitación, que es la importante:** mientras
**D-01** esté abierto —19 endpoints sin autenticación, entre ellos
`DELETE /api/roles/:id`—, esos endpoints son alcanzables **desde
Internet**. El túnel tiene que bajarse después de la presentación:

```bash
cd infra/compose && docker compose --profile tunel down
```

Falta además la prueba desde **otra red** (el celular con datos móviles). Todo
lo medido salió de esta máquina pero por Internet —el `CF-RAY` con sufijo
`EZE` lo prueba—, así que no es una prueba local; pero sólo otra red
descarta del todo que el resolutor de DNS de este proveedor esté metiendo mano.

---

## 2. Seguridad

Del informe [`09-seguridad.md`](09-seguridad.md):

| Limitación | Por qué importa |
|---|---|
| **19 endpoints no tienen ninguna autenticación**: los cinco de `/api/pagos`, los cinco de `/api/roles`, los cinco de `/api/funciones`, los dos de `/api/cocina` y los dos de `/api/reportes` | Es lo más grave que queda en pie. `DELETE /api/roles/:id` sin token, con el `CASCADE` de `usuario_roles`, deja el sistema sin nadie que pueda administrarlo. Detalle y evidencia en [`01-descripcion.md`](01-descripcion.md), hallazgo D-01 |
| **No hay doble factor ni revocación de sesiones.** Un JWT robado sirve hasta que vence | Es el agujero más grande de los que sí tienen autenticación |
| **Dos mecanismos de autorización conviviendo**: `verificarRol` compara el nombre del rol, `verificarPermiso` consulta `roles_funciones`. Sólo `usuario.route.js` usa el segundo | Un rol nuevo con los permisos correctos no entra a ninguna ruta que use el primero (hallazgo D-04) |
| **El limitador de peticiones guarda el estado en memoria.** Se reinicia con el proceso y se multiplica por cada réplica del backend | Un reinicio borra el conteo de intentos de login |
| **Si alguna vez hace falta publicar n8n, no hay con qué.** Las tres variables `N8N_BASIC_AUTH_*` y el comentario que aseguraba que la interfaz pedía usuario y clave **ya se borraron** ([PR #7](https://github.com/prieto555/tp-integrador-hia-grupo12/pull/7)), y la cuenta de propietario está dada de alta. Pero lo que hoy protege a n8n es sobre todo que el puerto está en `127.0.0.1` y **fuera del *ingress*** del túnel | Publicarlo exigiría poner algo delante que autentique: las cuentas de usuario de n8n no alcanzan para un servicio que tiene adentro el token de Mantis, la cuenta de robot de Nextcloud, el secreto del webhook y el SMTP (hallazgos 15 y 16) |
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

> **Esta sección se vació casi entera el 10/11.** Las cuatro corridas que
> estaban pendientes se hicieron ese día, y conviene decir qué dejaron, porque
> **ninguna de las cuatro pasó limpia la primera vez**: la de n8n encontró trece
> problemas, cinco de ellos sin dar ningún error. Está contado en
> [`14-automatizacion.md`](14-automatizacion.md), sección 8.

| Qué | Estado |
|---|---|
| Prueba de caída del primario (`simular-caida.sh`) | **Corrida.** 0 bytes de diferencia, promoción en 1 s, línea de tiempo 1 → 2. Los números están en [`10-cluster.md`](10-cluster.md) |
| Las incidencias cargadas en Mantis | **Corrida.** 17 incidencias, 16 cerradas y 1 reconocida, todas con notas y etiquetas ([`12-incidencias.md`](12-incidencias.md)) |
| Nextcloud con su estructura y permisos | **Corrida**, con la matriz de permisos comprobada contra la API (`PUT` → 201, `DELETE` → 403) ([`13-documental.md`](13-documental.md)) |
| Los tres flujos de n8n ejecutados | **Corridos**, y arreglados: los tres estaban mal escritos ([`14-automatizacion.md`](14-automatizacion.md)) |
| Capturas del tablero de Grafana | **Hechas**, los 22 paneles con datos ([`capturas/`](capturas/README.md)) |
| Capturas de Mantis y Nextcloud | **Hechas**: las 17 incidencias, el detalle de una, el resumen, y la estructura documental |
| Capturas de los tres flujos de n8n | **Hechas** el 11/11, después de reclamar la cuenta de propietario: los tres flujos activos, las 21 ejecuciones (con los tres errores de F03) y el lienzo de F01 |
| Captura de pgAdmin | **Hecha** el 11/11, y son dos: el cliente conectado con `restoyadb` desplegada hasta `Tables (12)` —el entregable del punto 4—, y la de que **entra sin pedir ninguna credencial**, que resultó ser el hallazgo 17 |
| `curl` sin token contra los 19 endpoints abiertos (D-01) | **Falta.** La evidencia de hoy es el código; la comprobación en vivo quedó pendiente porque el motor de Docker no estaba levantado cuando se escribió [`01-descripcion.md`](01-descripcion.md) |

**Lo que quedó pendiente es de dos clases**, y hay que distinguirlas en la
defensa: las capturas son material de presentación —los datos ya están
verificados contra las APIs de cada herramienta, que es evidencia más fuerte
que una captura—, mientras que el `curl` de D-01 es una verificación técnica
real que falta.

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
9. **Cerrar D-01**: `verificarToken` más el rol en los cinco archivos de rutas
   que quedaron sin él, y revisar que el frente mande el token en cocina y en
   los reportes de caja. Es de una línea por archivo y de varias pantallas por
   verificar, que es por lo que no se hizo a última hora.
10. **Igualar la versión de Node del CI (22) con la de las imágenes (24)**
    ([`03-inventario.md`](03-inventario.md), §5). Es cambiar un `"22"` por un
    `"24"` en el *workflow*, y evita la clase de error que sólo aparece cuando
    un paquete nativo se compila contra otro ABI.
11. **Fijar las imágenes base por `digest` y actualizarlas con Renovate o
    Dependabot** ([`03-inventario.md`](03-inventario.md), §4). Hoy
    `postgres:16-alpine` puede cambiar de versión sola, sin que nada en el
    repositorio cambie.
12. **Unificar la autorización en `verificarPermiso`** (D-04). Es lo que hace
    que la tabla `roles_funciones` sirva para algo.
