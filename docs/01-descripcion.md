# Descripción de la aplicación

Entregable del punto 15.1. Cubre el **punto 1** de la consigna (épica E1 del
backlog): descripción, actores, modelo de datos, funcionalidades y diagnóstico
técnico.

Todo lo que dice este documento sale de **leer el código que está en este
repositorio**, no de la memoria de cuando se cursó la materia donde se escribió
la aplicación. Cada afirmación lleva el archivo y la línea, para que se pueda
contrastar.

---

## 1 · Qué es RestoYa

Un sistema de gestión para un restaurante con servicio en salón. No es un
sitio de delivery: el centro del modelo es la **mesa**, no el domicilio.

El recorrido que la aplicación resuelve, de punta a punta:

1. El cliente se sienta y **escanea el QR de la mesa** (`/qr/:idMesa` en el
   frente). No inicia sesión: ve el menú y arma su pedido.
2. El pedido entra con `POST /api/pedidos` y queda asociado a esa mesa.
3. **Cocina** ve las comandas y marca los ítems a medida que salen.
4. El **mozo** ve el mapa de mesas, su estado y los pedidos listos para
   entregar.
5. El **cajero** cobra, con la caja abierta del turno, y puede emitir el
   comprobante en PDF o Excel.
6. El **gerente** ve el tablero de ventas, administra el menú, los usuarios y
   los roles, y tiene el historial de accesos.

La aplicación venía de la cátedra **Programación y Servicios Web** (2º
cuatrimestre). Este trabajo no le agrega funcionalidad de negocio: la toma
como está y la lleva a un entorno reproducible, medido, replicado, monitoreado
y publicado. Esa distinción importa para la defensa, porque **casi todos los
hallazgos de este documento son de la aplicación heredada**, no de lo que se
construyó acá.

### De dónde viene el código

`backend/` y `frontend/` se importaron con `git subtree` desde los dos
repositorios originales, así que **el historial completo de los dos está en
este repositorio**. No son submódulos: se editan como carpetas normales y los
commits nuevos quedan acá.

---

## 2 · Los cuatro actores

Los roles no están escritos en el código del frente ni en una constante: están
**en la base**, en `roles` y `roles_funciones`, y los crea el *seed*
(`backend/config/seed.js:59-75`). Eso significa que se pueden cambiar sin
recompilar, y también que **el permiso real es el que está en la base, no el
que dice el menú**.

| Rol | `tipo` | Funciones que tiene asignadas |
|---|---|---|
| **Gerente** | `ADMIN` | las ocho |
| **Mozo** | `STAFF` | `ver_mesas`, `crear_pedido`, `ver_pedidos_listos` |
| **Cajero** | `STAFF` | `ver_pedidos_listos`, `cobrar_pedido` |
| **Cocina** | `STAFF` | `ver_items_cocina`, `cambiar_estado_item` |

Y hay un quinto actor que no tiene rol ni cuenta: el **cliente en la mesa**.
No se autentica. Puede ver el menú y crear un pedido, y nada más. Eso es una
decisión del diseño original y está bien: pedirle que se registre para pedir
una gaseosa sería peor producto.

### Las ocho funciones

`backend/config/seed.js:47-55`:

| Función | Para qué |
|---|---|
| `ver_mesas` | Ver el mapa de mesas |
| `crear_pedido` | Crear pedidos nuevos |
| `ver_pedidos_listos` | Ver los pedidos para entregar |
| `cobrar_pedido` | Cobrar pedidos y abrir caja |
| `gestionar_usuarios` | Crear o modificar usuarios y roles |
| `ver_items_cocina` | Ver los ítems pendientes de cocinar |
| `cambiar_estado_item` | Marcar ítems como listos |
| `gestionar_menu` | Agregar, editar o eliminar productos del menú |

### Dos mecanismos de autorización, no uno

Esto es importante y es fácil de pasar por alto leyendo rápido: el backend
tiene **dos** formas de autorizar, y conviven.

- `verificarRol('Gerente', 'Mozo')` compara el **nombre del rol**.
- `verificarPermiso('gestionar_usuarios')` compara la **función asignada**.

El segundo es el bueno: es el que respeta la tabla `roles_funciones` y permite
cambiar permisos sin tocar código. El primero vuelve a atar el código al
nombre del rol, y si mañana alguien crea un rol "Encargado" con las mismas
funciones que Gerente, **no entra a ninguna ruta que use `verificarRol`**.

Hoy sólo `usuario.route.js` usa `verificarPermiso`; el resto usa
`verificarRol`. Está anotado como hallazgo D-04 más abajo. No se corrigió:
unificar los dos mecanismos cambia el comportamiento de 27 rutas y no es
alcance de este trabajo.

---

## 3 · Funcionalidades, sacadas de las rutas reales

La lista no sale de lo que la aplicación parece hacer, sino de los catorce
grupos de rutas que `backend/index.js` **efectivamente monta** (líneas 121-156).
Son **54 endpoints**.

| Grupo | Endpoints | Quién entra |
|---|---|---|
| `/api/auth` | 2 | público (es el login) |
| `/api/usuarios` | 5 | token + `gestionar_usuarios` |
| `/api/mesas` | 7 | 2 GET públicos (QR) + 5 para Mozo/Gerente/Cajero |
| `/api/productos` | 5 | 2 GET públicos (menú) + 3 sólo Gerente |
| `/api/pedidos` | 6 | 1 POST público (el cliente pide) + 5 con token |
| `/api/cocina` | 2 | **nadie: no tiene autenticación** |
| `/api/pagos` | 5 | **nadie: no tiene autenticación** |
| `/api/historial` | 1 | token + Gerente |
| `/api/caja` | 4 | token + Cajero/Gerente |
| `/api/roles` | 5 | **nadie: no tiene autenticación** |
| `/api/funciones` | 5 | **nadie: no tiene autenticación** |
| `/api/reportes` | 2 | **nadie: no tiene autenticación** |
| `/api/dashboard` | 4 | token + Gerente |
| `/api/chatbot` | 1 | público, con límite de 10/min |

El reparto, entonces:

- **8 endpoints públicos a propósito** (login, Google, los dos GET de mesas,
  los dos GET de productos, `POST /api/pedidos`, el chatbot).
- **27 endpoints con token y rol o permiso.**
- **19 endpoints sin ningún control.** Ése es el hallazgo D-01, el más grave
  de este documento.

### El frente

La SPA de Angular declara **19 rutas** (`frontend/src/app/app.routes.ts`).
Diez están detrás de `authGuard` + `roleGuard`:

| Ruta | Rol que exige el guard |
|---|---|
| `/usuario`, `/usuario-form`, `/usuario-form/:id` | Gerente |
| `/admin/productos`, `/admin/historial` | Gerente |
| `/mesa` | Mozo, Gerente |
| `/caja` | Cajero, Gerente |
| `/cocina` | Cocina, Gerente |
| `/dashboard` | Gerente |

> **El guard del frente no es seguridad.** Es comodidad: evita mostrar una
> pantalla que va a fallar. Cualquiera puede llamar a la API con `curl` sin
> pasar por Angular, y de hecho es así como se detectó D-01. La autorización
> de verdad está —o no está— en el backend.

---

## 4 · El modelo de datos

**Doce tablas**: diez entidades y dos tablas de unión. El esquema versionado
está en `infra/postgres/schema.sql`, que es la fuente de verdad desde que se
apagó `sequelize.sync({ alter: true })` (ver el punto 6).

| Tabla | Clave primaria | Qué guarda |
|---|---|---|
| `usuarios` | `usuarioId` | las cuentas del personal |
| `roles` | `rolId` | Gerente, Cajero, Mozo, Cocina |
| `funciones` | `funcionId` | los ocho permisos |
| `usuario_roles` | (`rolId`, `usuarioId`) | unión: qué rol tiene cada usuario |
| `roles_funciones` | (`funcionId`, `rolId`) | unión: qué puede hacer cada rol |
| `mesas` | `idMesa` | las mesas físicas y su estado |
| `productos` | `idProducto` | el menú |
| `pedidos` | `idPedido` | la comanda, atada a mesa y usuario |
| `detalle_pedidos` | `idDetalle` | los ítems de cada pedido |
| `cajas` | `idCaja` | la apertura y cierre de caja por turno |
| `pagos` | `idPago` | el cobro, atado al pedido y a la caja |
| `historial_accesos` | `idHistorial` | quién entró, cuándo y desde qué IP |

### Las once claves foráneas

Todas con `ON UPDATE CASCADE ON DELETE SET NULL`, salvo las dos tablas de
unión, que van con `ON DELETE CASCADE` (`infra/postgres/schema.sql:703-783`):

```
detalle_pedidos.idPedido    -> pedidos.idPedido
detalle_pedidos.idProducto  -> productos.idProducto
pedidos.idMesa              -> mesas.idMesa
pedidos.usuarioId           -> usuarios.usuarioId
pagos.idPedido              -> pedidos.idPedido
pagos.idCaja                -> cajas.idCaja
historial_accesos.usuarioId -> usuarios.usuarioId
usuario_roles.rolId         -> roles.rolId          (CASCADE)
usuario_roles.usuarioId     -> usuarios.usuarioId   (CASCADE)
roles_funciones.rolId       -> roles.rolId          (CASCADE)
roles_funciones.funcionId   -> funciones.funcionId  (CASCADE)
```

`ON DELETE SET NULL` en `pagos.idPedido` merece un comentario, porque es una
decisión del diseño heredado y no es gratuita: borrar un pedido **no** borra
su pago, lo deja huérfano. Contablemente eso puede estar bien (el cobro
existió), pero deja un pago que ya no se puede explicar. Está anotado como
D-05.

### El volumen con el que se trabaja

La aplicación en su estado original tenía datos de demostración: cuatro
productos y un usuario. Con eso no se puede medir nada, así que el punto 4
genera un conjunto de prueba de **30 millones de filas** —seis millones de
pedidos, seis millones de pagos y los detalles correspondientes— con SQL puro
dentro del motor, no por el driver. El procedimiento está en
[`06-carga-datos.md`](06-carga-datos.md).

Ese volumen es el que hace que las mediciones del punto 5 (optimización) y del
punto 6 (replicación) signifiquen algo. Sobre cuatro filas, cualquier consulta
tarda cero.

---

## 5 · Diagnóstico técnico (E1-05)

La consigna pide que el diagnóstico tenga, por hallazgo, **el riesgo y la
acción**. Acá están, ordenados por gravedad. Los que están corregidos
remiten al documento donde está la corrección medida.

| # | Hallazgo | Riesgo | Acción | Estado |
|---|---|---|---|---|
| D-01 | 19 endpoints sin autenticación, entre ellos `DELETE /api/roles/:id` y los cinco de `/api/pagos` | **Crítico** | Agregar `verificarToken` + rol a los cinco archivos de rutas, y revisar que el frente mande el token | **Abierto** |
| D-02 | `sequelize.sync({ alter: true })` en cada arranque | Alto | Esquema versionado en `schema.sql`, `DB_SYNC=none` por defecto | **Corregido** (punto 6) |
| D-03 | CORS filtrando por subcadena, Swagger abierto, login con 100 intentos/15 min, chatbot sin límite | Alto | Seis correcciones | **Corregido** ([`09-seguridad.md`](09-seguridad.md)) |
| D-04 | Dos mecanismos de autorización conviviendo (`verificarRol` vs `verificarPermiso`) | Medio | Unificar en `verificarPermiso` | **Abierto** |
| D-05 | `ON DELETE SET NULL` deja pagos huérfanos | Medio | Decidir entre `RESTRICT` o baja lógica del pedido | **Abierto** |
| D-06 | `detallePedido.route.js` existe con 4 endpoints y **nunca se monta** | Bajo | Borrar el archivo o montarlo | **Abierto** |
| D-07 | Sin un solo test automatizado en el backend (`npm test` sale con error 1) | Alto | Falta | **Abierto** |
| D-08 | Consultas del tablero sin índices para el volumen real | Alto | Índices y reescrituras medidas | **Corregido** (punto 5) |
| D-09 | Un solo nodo de base: cae y no hay servicio | Alto | Réplica en streaming y prueba de caída | **Corregido** (punto 6) |
| D-10 | Nada medía nada: sin métricas ni alertas | Alto | Prometheus, Grafana, Alertmanager | **Corregido** (punto 10) |

### D-01, en detalle

Es el hallazgo nuevo de este documento y el más grave, así que va con la
evidencia completa. Cinco archivos de rutas **no importan el middleware de
autenticación**, ni una sola vez:

| Archivo | Endpoints | Lo peor que hay ahí |
|---|---|---|
| `backend/src/routes/pago.route.js:5-9` | 5 | `POST /` registra un pago; `DELETE /:id` lo borra |
| `backend/src/routes/rol.route.js:7-11` | 5 | `DELETE /:id` borra un rol, y `usuario_roles` está en `CASCADE` |
| `backend/src/routes/funcion.route.js:7-11` | 5 | `PUT /:id` reescribe un permiso del sistema |
| `backend/src/routes/cocina.route.js:6-9` | 2 | `PATCH /estado/:idPedido` cambia el estado de cualquier pedido |
| `backend/src/routes/reporte.route.js:5-6` | 2 | el PDF y el Excel del cierre de caja, por `idCaja` |

Para comparar: `caja.route.js` —el mismo dominio, la plata— **sí** tiene
`router.use(verificarToken)` y `router.use(verificarRol('Cajero', 'Gerente'))`
en las líneas 7 y 8. Así que no es un criterio de diseño: son cinco archivos
que quedaron afuera.

La combinación que más preocupa es `DELETE /api/roles/:id` con el `CASCADE` de
`usuario_roles`: borrar el rol Gerente sin autenticarse deja al sistema **sin
nadie que pueda administrarlo**, y la cuenta de administrador sigue existiendo
pero sin rol.

> **Por qué no se corrigió acá.** Agregar `verificarToken` a esas 19 rutas es
> de una línea por archivo, pero cambia el comportamiento de pantallas del
> frente que hoy funcionan sin mandar token —cocina y caja llaman a
> `/api/cocina` y `/api/reportes`— y habría que verificar cada una. Hacerlo a
> última hora, sin tests y con la entrega encima, es cómo se rompen las
> demostraciones. Queda documentado con el riesgo y el arreglo, que es lo que
> la consigna pide del diagnóstico, y anotado en
> [`16-limitaciones.md`](16-limitaciones.md).

**Falta la comprobación en vivo.** El `curl` sin token contra
`127.0.0.1:8080/api/roles` quedó pendiente: cuando se escribió esta sección el
motor de Docker no estaba levantado. La evidencia de hoy es el código, que se
puede leer en los archivos y líneas de la tabla. La verificación contra el
stack corriendo es un `curl` de treinta segundos y está anotada como pendiente.

---

## 6 · Qué NO resuelve esta aplicación

Para que el informe no se lea como un folleto:

- **No hay multi-restaurante.** Toda la base es de un local. No hay columna
  que separe sucursales, así que dos locales son dos instalaciones.
- **No hay stock.** `productos` no tiene cantidad disponible: se puede pedir
  algo que no hay.
- **La integración con Mercado Pago está a medias.** `pago.route.js:7` expone
  `POST /webhook`, pero el webhook no valida firma y además es uno de los
  endpoints sin autenticación de D-01.
- **El chatbot depende de un servicio externo** (Gemini) y de una clave de
  pago. Sin esa clave, la pantalla existe y no responde.
- **No hay impresión fiscal ni factura electrónica.** Los reportes son un PDF
  y un Excel, no un comprobante válido ante AFIP.
- **No hay pruebas automatizadas** (D-07). Todo lo que se verificó en este
  trabajo se verificó a mano o con scripts de infraestructura, no con una
  suite que se pueda volver a correr en el CI.

---

## Referencias

- Arquitectura y qué se contenedoriza: [`02-arquitectura.md`](02-arquitectura.md)
- Versiones exactas de todo: [`03-inventario.md`](03-inventario.md)
- Las correcciones de seguridad: [`09-seguridad.md`](09-seguridad.md)
- El conjunto de datos de prueba: [`06-carga-datos.md`](06-carga-datos.md)
- Lo que falta, todo junto: [`16-limitaciones.md`](16-limitaciones.md)
