# Capturas de pantalla

Diecinueve capturas tomadas el **10 y 11/11/2026**, con el sistema corriendo y la
aplicación publicada. Esta tabla dice **qué prueba cada una**, porque una
captura sin esa frase al lado no prueba nada: es una foto de una pantalla.

> **Cómo se tomaron.** Con Chrome manejado por CDP (*Chrome DevTools
> Protocol*) desde un script, no a mano. Está en el apartado "Cómo se
> reproducen" al final. Importa porque se pueden volver a sacar en un minuto si
> los números cambian, y porque ninguna está retocada.

---

## Punto 9 — la aplicación publicada

| Archivo | Qué prueba |
|---|---|
| [`00-publicada-barra-de-direcciones.png`](00-publicada-barra-de-direcciones.png) | **La más importante del conjunto.** La barra de direcciones dice `restoya.liners-panel.com/home`: la aplicación está en Internet con un nombre propio, no en `localhost` |
| [`01-app-publicada.png`](01-app-publicada.png) | La portada servida a través del túnel |
| [`02-app-publicada-platos.png`](02-app-publicada-platos.png) | `/platos`: el ruteo de Angular funciona a través del túnel, y los productos vienen de la API, o sea que el *proxy* de `/api/` también |

## Punto 4 — cliente de administración de la base

| Archivo | Qué prueba |
|---|---|
| [`60-pgadmin-sin-credenciales.png`](60-pgadmin-sin-credenciales.png) | **Ésta no prueba que algo funcione: prueba un problema.** Es pgAdmin recién abierto, **sin haber escrito una sola credencial**. `GET /` devuelve 302 a `/browser/` y de ahí 200: no hay pantalla de inicio de sesión. Es el hallazgo 17 de [`09-seguridad.md`](../09-seguridad.md) |
| [`61-pgadmin-conectado.png`](61-pgadmin-conectado.png) | El entregable del punto 4: **el cliente de administración funcionando**. El servidor `RestoYa (contenedor)` conectado, `restoyadb` desplegada hasta **`Tables (12)`** —las doce tablas que describe [`01-descripcion.md`](../01-descripcion.md)—, el nodo `Replica Nodes` del punto 6, y el panel con las sesiones, las transacciones por segundo y el *block I/O* en vivo. **Tampoco acá hubo que escribir la clave de la base**: pgAdmin la tiene guardada en su volumen |

## Punto 10 — monitoreo

| Archivo | Qué prueba |
|---|---|
| [`10-prometheus-destinos.png`](10-prometheus-destinos.png) | Los **seis destinos en UP**: backend, cAdvisor, los **dos** PostgreSQL (`nodo="primario"` y `nodo="replica"`), el propio Prometheus y node-exporter. La etiqueta `nodo` es la que permite comparar primario contra réplica en el tablero |
| [`11-prometheus-reglas.png`](11-prometheus-reglas.png) | Las **siete reglas de alerta** en cuatro grupos, todas `INACTIVE`: el sistema está sano y las reglas están cargadas |
| [`12-alertmanager.png`](12-alertmanager.png) | Alertmanager sin alertas activas. Es el estado correcto; la prueba de que **sí** dispara está en [`08-monitoreo.md`](../08-monitoreo.md), con la alerta inyectada de punta a punta |
| [`13-mailpit.png`](13-mailpit.png) | El buzón de prueba, vacío y accesible |
| [`20-grafana-tablero-completo.png`](20-grafana-tablero-completo.png) | **El tablero entero, los 22 paneles con datos reales.** CPU 6,05 %, memoria 29,2 %, base de 4,14 GiB, 100 % de lecturas servidas desde memoria, el panel de **Replicación**, y abajo los paneles de la aplicación con las peticiones que generaron las pruebas del túnel |
| [`21-grafana-detalle.png`](21-grafana-detalle.png) | Las dos primeras filas en grande, para leerlas en la defensa sin agrandar |

## Punto 11 — incidencias

| Archivo | Qué prueba |
|---|---|
| [`30-mantis-incidencias.png`](30-mantis-incidencias.png) | **"Visualizando incidencias 1 - 17 / 17"**: las diecisiete, con su categoría, gravedad y estado. Dieciséis `cerrada` y una `aceptada` (INC-15, la de cAdvisor, abierta a propósito) |
| [`31-mantis-detalle.png`](31-mantis-detalle.png) | INC-06 abierta: la crítica de `proxy-addr` que permitía falsificar `X-Forwarded-For`. Se ve el detalle, las notas y las etiquetas, que es lo que distingue una incidencia cargada de una incidencia documentada |
| [`32-mantis-resumen.png`](32-mantis-resumen.png) | La página de Resumen de Mantis: el reparto por categoría, gravedad y estado, calculado por la herramienta y no por nosotros |

> El filtro por defecto de Mantis **esconde las cerradas**, así que la primera
> captura mostró una sola incidencia. La de acá se tomó con
> `view_all_set.php?type=1&hide_status=-2`, que apaga ese filtro. Vale saberlo
> para la defensa: si alguien abre Mantis en vivo, va a ver una, no diecisiete.

## Punto 12 — gestión documental

| Archivo | Qué prueba |
|---|---|
| [`40-nextcloud-archivos.png`](40-nextcloud-archivos.png) | La carpeta `RestoYa` con sus seis subcarpetas y el `README.md` **renderizado arriba** por Nextcloud. Se ve el tamaño de cada carpeta y que la estructura es la que describe [`13-documental.md`](../13-documental.md) |

## Punto 13 — automatización

| Archivo | Qué prueba |
|---|---|
| [`50-n8n-sin-autenticacion.png`](50-n8n-sin-autenticacion.png) | **Ésta no prueba que algo funcione: prueba un problema.** n8n contestaba con "Set up owner account" a quien entrara, sin pedir ninguna credencial. Es el hallazgo 15 de [`09-seguridad.md`](../09-seguridad.md). Abajo a la derecha se ve además el propio aviso de n8n: *"Critical update available"*. **Se deja a propósito**: es el antes, y la ventana ya se cerró |
| [`51-n8n-flujos.png`](51-n8n-flujos.png) | Los **tres flujos, los tres en `Active`**: F01 de alerta a incidencia, F02 de verificación de copias, F03 de informe a Nextcloud |
| [`52-n8n-ejecuciones.png`](52-n8n-ejecuciones.png) | **La mejor captura del punto 13, y no porque salga todo bien.** Veintiún ejecuciones con su duración, y entre ellas los **tres errores de F03** (#13, #14, #15) antes de que quedara andando. Es el historial real de la depuración que cuenta [`14-automatizacion.md`](../14-automatizacion.md) §8, no una corrida prolija armada para la foto |
| [`53-n8n-flujo-f01.png`](53-n8n-flujo-f01.png) | El lienzo de F01 completo: el *webhook*, la validación, el filtro de críticas, la búsqueda de duplicados, la apertura en Mantis, el aviso al equipo y la respuesta a Alertmanager — con la nota del propio flujo explicando **qué NO hace a propósito** |

---

## No falta ninguna

**n8n.** El 11/11, a pedido del dueño del sistema, se reclamó la cuenta de
propietario con la `N8N_PASSWORD` que ya estaba en el `.env` —no se inventó
ninguna credencial— y salieron las tres capturas que faltaban.

**pgAdmin.** Quedó para el final por un diagnóstico equivocado: el primer
intento falló con *"The CSRF token is missing"* y se anotó que **el formulario
de inicio de sesión** rechazaba el envío automático. Era falso por partida
doble. Ese error venía de pegarle a la API sin el testigo CSRF, que es
protección contra CSRF y **no es autenticación**; y sobre todo **no hay
formulario de inicio de sesión**, porque pgAdmin corre en modo escritorio. O
sea que lo que se había anotado como "no se pudo entrar" era en realidad "se
entra sin nada". De ahí salió el hallazgo 17.

---

## Cómo se reproducen

Las capturas se sacaron con un Chrome controlado por CDP, con un perfil aparte
para no tocar el del usuario:

```bash
chrome --remote-debugging-port=9222 --user-data-dir=<carpeta temporal>
```

y un script que abre una pestaña, espera a que la página termine de cargar,
fotografía y cierra. Dos cosas que costaron y conviene anotar:

1. **Grafana sólo dibuja los paneles que entran en pantalla.** Una captura con
   `captureBeyondViewport` hace la imagen alta pero **no desplaza**, así que
   los paneles nunca se dibujan: la primera versión del tablero salió negra,
   con los títulos de las filas y nada más. La solución fue emular una ventana
   de 1700 × 2150 —el tablero entero entra— y esperar 15 segundos a que los
   paneles consulten a Prometheus.
2. **La barra de direcciones no sale en una captura de CDP**, porque CDP
   fotografía el documento, no el navegador. Para `00-publicada-...` hizo falta
   una captura de la ventana de Windows, con un script aparte que busca la
   ventana por título.

Las claves de Grafana, Mantis y Nextcloud **no pasaron por la conversación**:
un script las lee del `.env` y las manda directo al campo del formulario. Lo
único que imprime es "ENTRÓ" o "NO ENTRÓ".
