# Defensa oral — guion y preguntas

El punto 15 tiene dos mitades. La documentación técnica obligatoria —los
dieciséis documentos— está en [`README.md`](README.md). **Esta es la otra
mitad**, y es la que decide la nota, porque la nota es individual.

---

## 1 · Qué dice la consigna, textual

Vale leerlo entero antes de preparar nada, porque cada frase cambia cómo hay
que ensayar:

> Cada equipo dispondrá de aproximadamente **20 minutos**.
>
> La calificación mínima de aprobación será **7 (siete)**.
>
> La nota individual considerará la calidad de los aportes, las evidencias, la
> comprensión de la arquitectura, las respuestas a preguntas técnicas y la
> capacidad para explicar decisiones y resolver problemas.
>
> **No será suficiente mostrar capturas de pantalla o afirmar que una
> herramienta funciona.** Se deberá demostrar su funcionamiento y justificar las
> configuraciones realizadas.
>
> La calificación **será individual**, aun cuando el proyecto se desarrolle en
> equipo. Para aprobar, cada estudiante deberá obtener una nota igual o
> superior a 7 (siete).
>
> **La cátedra podrá tomar un examen individual**, teórico y/o práctico, cuando
> lo considere necesario, a fin de verificar la participación efectiva de cada
> estudiante.
>
> **Cada integrante deberá acreditar el dominio** de los componentes
> implementados, las herramientas utilizadas y los procedimientos de
> configuración, integración, despliegue, optimización y seguridad aplicados.

Tres consecuencias prácticas:

1. **Veinte minutos entre cinco.** Son tres minutos y medio por cabeza. No
   alcanza para contar todo: hay que elegir.
2. **«Acreditar el dominio» no dice «de su parte».** Dice de los componentes
   implementados. Cada uno tiene que poder contestar de un frente que no tocó.
3. **«No será suficiente mostrar capturas».** La demostración en vivo no es un
   adorno: es el requisito. Por eso §6.

---

## 2 · Los cinco frentes

El reparto es **decisión del grupo** (tarjeta E2-07). Esta es la propuesta, y
está armada para que las piezas que se tocan entre sí queden en la misma
cabeza.

| Frente | Puntos | Documentos | El número que lo resume |
|---|---|---|---|
| **1 · Base de datos** | 4, 5 | [`05-docker.md`](05-docker.md), [`06-carga-datos.md`](06-carga-datos.md), [`07-optimizacion-sql.md`](07-optimizacion-sql.md) | Pantalla de cocina **1204,8 ms → 0,9 ms** |
| **2 · Clúster y replicación** | 6 | [`10-cluster.md`](10-cluster.md) | Promoción en **1 s**, `replay_lag` **3,1 ms**, 0 bytes atrás |
| **3 · Aplicación, contenedores y CI/CD** | 1, 7, 8 | [`01-descripcion.md`](01-descripcion.md), [`02-arquitectura.md`](02-arquitectura.md), [`03-inventario.md`](03-inventario.md), [`11-cicd.md`](11-cicd.md) | **Cuatro fallos reales** del pipeline antes del verde |
| **4 · Publicación y monitoreo** | 9, 10 | [`15-publicacion.md`](15-publicacion.md), [`08-monitoreo.md`](08-monitoreo.md) | `CF-RAY … **EZE**`, y la alerta de `pending` a `firing` en **90 s** |
| **5 · Procesos, incidencias, n8n y seguridad** | 2, 3, 11, 12, 13, 14 | [`scrum/seguimiento.md`](scrum/seguimiento.md), [`12-incidencias.md`](12-incidencias.md), [`13-documental.md`](13-documental.md), [`14-automatizacion.md`](14-automatizacion.md), [`09-seguridad.md`](09-seguridad.md) | **17 problemas** al correr n8n, **5 sin ningún error** |

> **El frente 5 es el más grande y el más fácil de contar**, porque son
> herramientas y procesos, no mediciones. El 1 y el 2 son los más técnicos.
> Conviene que el frente 5 lo tome quien menos cómodo esté con SQL, no al revés.

**Cada uno tiene que saber además una cosa de un frente ajeno**, para §4.

---

## 3 · Guion de 20 minutos

Veinte minutos se van solos. Esto está medido para 19, con un minuto de colchón.

| Min | Quién | Qué |
|---|---|---|
| **0 – 1** | Quien abra | **Qué es RestoYa y qué se hizo con ella.** Una aplicación de gestión de restaurante que ya existía —de Programación y Servicios Web— y que acá se diagnosticó, se contenerizó, se optimizó, se replicó, se publicó y se monitoreó. **Decir el número grande de entrada: 30 millones de filas, 23 contenedores, la app en Internet.** Y decir cómo está repartida la charla |
| **1 – 4** | Frente 1 | **Base de datos.** El conjunto de prueba: 6.000.000 por tabla, cómo se generó y por qué **no es uniforme**. Y la optimización: mostrar **un** `EXPLAIN ANALYZE` antes y después, el de la pantalla de cocina. Cerrar con lo que no se arreglaba con índices: el `heap out of memory` |
| **4 – 7** | Frente 2 | **Clúster.** Primario y réplica, qué rol tiene cada uno. **Decir de entrada que NO hay failover automático** — la consigna lo pide explícitamente. Después la prueba de caída: 0 bytes atrás, promoción en 1 s, 3 s hasta aceptar escrituras, línea de tiempo 1 → 2. Y la aclaración honesta: esos 3 s son el tiempo de la promoción, no de la recuperación |
| **7 – 10** | Frente 3 | **Arquitectura y CI/CD.** El diagrama: cuatro redes, qué está contenerizado y qué no. Después el pipeline, y **contar los cuatro fallos**, que es lo que prueba que corrió de verdad. Cerrar con la decisión: el CI levanta el sistema en vez de correr unitarias, y por qué |
| **10 – 13** | Frente 4 | **Publicación y monitoreo.** Por qué hace falta un túnel (CGNAT: no hay redirección de puertos posible). Qué se publica y qué **no** — nueve servicios quedan afuera a propósito. Después el tablero de Grafana y la alerta probada de punta a punta. Acá **se pasa a la demostración**, así que este frente la encadena |
| **13 – 15** | Frente 4 + 5 | **Demostración en vivo.** Ver §6. Abrir `restoya.liners-panel.com` en el navegador, entrar, mostrar una pantalla con datos. Después Grafana con datos reales, y Mantis con las 17 incidencias |
| **15 – 18** | Frente 5 | **Procesos y seguridad.** Las 17 incidencias con su ciclo completo. Los tres flujos de n8n y **los cinco errores que no daban ningún error**, que es la mejor historia del trabajo. Seguridad: los seis hallazgos corregidos, con `proxy-addr` como ejemplo de dos controles que por separado parecían bien |
| **18 – 19** | Quien cierre | **Qué NO anda.** D-01, los 19 endpoints sin autenticación: encontrado, documentado, **no corregido a propósito**, y por qué. cAdvisor. La falta de unitarias. Cerrar diciendo que está todo en [`16-limitaciones.md`](16-limitaciones.md) |

### Las tres transiciones que siempre se van de tiempo

Ensayar estas tres, no el texto:

1. **Del frente 1 al 2.** Las dos hablan de PostgreSQL y es fácil repetir. El
   corte es claro: el 1 termina en «una sola base, rápida»; el 2 arranca en
   «ahora son dos».
2. **La apertura del navegador.** Es donde se pierde un minuto buscando la
   pestaña. Tener todo abierto de antes (§6).
3. **El cierre.** Hablar de lo que no anda da ganas de explicarse de más. Son
   sesenta segundos: nombrarlo, decir por qué, y terminar.

### Qué dejar afuera si va corto

En este orden: el detalle de Nextcloud, el inventario de versiones, y los
números de la copia de seguridad. Lo que **no** se saca nunca: la demostración
en vivo y el minuto de limitaciones.

---

## 4 · Banco de preguntas

Cuarenta y dos preguntas con la respuesta corta. **La consigna avisa que puede
haber examen individual**, así que la regla del ensayo es: cada uno contesta
cinco de un frente que no es el suyo, sin leer.

### Frente 1 · Base de datos

1. **¿Cómo generaron los 6 millones de filas y por qué no son datos uniformes?**
   Con `infra/postgres/generar-dataset.sql`. No son uniformes a propósito:
   fechas concentradas en meses recientes, estados con distribución realista,
   70 % LOCAL y 30 % DELIVERY. Con datos planos el planificador no distingue
   selectividad y los `EXPLAIN` serían irreales.

2. **¿Qué índice agregaron que más impacto tuvo y por qué?**
   El de `usuarios.email`. El login pasó de 282,1 ms a 0,09 ms. Y había algo
   peor que la lentitud: la columna **no tenía UNIQUE**, así que existía una
   condición de carrera en el alta de usuarios.

3. **¿Agregaron índices que no sirvieron?**
   Sí, y está documentado. BRIN sobre las fechas **no sirve acá** porque la
   correlación con el orden físico es −0,01: las filas no están ordenadas por
   fecha en disco, que es la única condición bajo la cual BRIN gana.

4. **Bajaron `random_page_cost` a 1,1 porque es SSD. ¿Qué pasó?**
   Se hizo **dos veces más lento**. El planificador cambió el bitmap scan por
   un index scan y pasó de leer 5.661 bloques a 632.029. Se revirtió. Es el
   ejemplo de que una recomendación general no reemplaza una medición.

5. **La consulta de cocina bajó a 0,9 ms y la aplicación se seguía cayendo. ¿Por qué?**
   Porque el problema no era la base. `GET /api/pedidos/cocina` no tenía `LIMIT`
   y Node intentaba materializar 1,33 millones de pedidos en memoria:
   `JavaScript heap out of memory`. Optimizar la consulta no arregla una
   aplicación que pide todo.

6. **¿Qué son las vistas materializadas que crearon y cuál es su costo?**
   Cuatro, para los agregados del tablero. El costo es que **no se actualizan
   solas**: hay que refrescarlas. Programar ese refresco quedó en el backlog
   (E5-11), y está anotado como limitación.

7. **¿Por qué sacaron `sequelize.sync({ alter: true })`?**
   Porque recreaba las 7 claves foráneas **en cada arranque** y había acumulado
   8 constraints UNIQUE duplicadas en `mesas`. Un esquema que cambia solo en
   cada reinicio no es un esquema.

8. **¿Cuánto tarda la copia y cuánto la restauración?**
   466,8 MB en **201 s** la copia, **75 s** la restauración, con los conteos
   exactos verificados de las dos puntas. No se declara una copia buena hasta
   que se restaura.

### Frente 2 · Clúster y replicación

9. **¿Tienen alta disponibilidad?**
   **No.** Tienen replicación, que no es lo mismo. No hay failover automático y
   está dicho en la primera línea de [`10-cluster.md`](10-cluster.md). Si el
   primario cae, alguien tiene que promover la réplica a mano.

10. **¿Qué tipo de replicación y por qué esa?**
    Streaming **asincrónica**. La sincrónica haría que cada escritura espere la
    confirmación de la réplica: más seguridad, peor latencia. Para este sistema
    —pedidos de un restaurante— perder el último pedido en una caída es menos
    grave que agregar latencia a todos.

11. **¿Cuánto mide el retraso y cómo lo saben?**
    `replay_lag` de **3,1 ms** y **0 bytes** atrás, leído de
    `pg_stat_replication` en el primario. Está en el tablero de Grafana con la
    etiqueta `nodo`, que es lo que permite comparar primario contra réplica.

12. **¿Qué pasó en la prueba de caída?**
    0 bytes atrás al momento del corte, promoción en **1 s**, **3 s** del corte
    a tener un nodo aceptando escrituras, línea de tiempo **1 → 2**, y los
    6.000.000 de pedidos y de pagos intactos.

13. **Entonces se recuperan en 3 segundos.**
    No. Esos 3 s son el tiempo de **la promoción**, no de la recuperación. Hay
    que sumarle los 90 s que tarda Prometheus en pasar la alerta a `firing`,
    más lo que tarde una persona en enterarse y decidir. El informe lo aclara
    expresamente.

14. **¿Qué es el cerebro dividido y cómo lo evitan?**
    Que los dos nodos se crean primarios y acepten escrituras distintas. Acá se
    evita porque la promoción es **manual**: no hay nada automático que pueda
    equivocarse. El costo es el tiempo de reacción.

15. **¿Qué permisos tiene el usuario de replicación?**
    El rol `replicador` **no puede leer ni escribir datos**: sólo tiene el
    atributo `REPLICATION`. Es el mínimo necesario.

16. **La aplicación, ¿lee de la réplica?**
    Las cuatro consultas históricas del tablero, sí, con vuelta al primario si
    no responde. **No** se usó la lista `read`/`write` de Sequelize, que reparte
    **todas** las lecturas: con replicación asincrónica eso produce el «cargué
    el pedido y no aparece».

### Frente 3 · Aplicación, contenedores y CI/CD

17. **¿Qué es RestoYa y qué hace?**
    Gestión de restaurante: pedidos en salón y delivery, cocina, caja, pagos,
    usuarios con roles. Cuatro actores según la tabla `roles_funciones`.
    Angular 21 + Node/Express 5 + Sequelize + PostgreSQL 16.

18. **¿Qué quedó sin contenerizar y por qué?**
    Está en [`02-arquitectura.md`](02-arquitectura.md) §2. Lo que depende de la
    máquina o de una cuenta externa. El criterio fue: si no se reproduce en un
    clon limpio, no va al compose.

19. **¿Por qué el backend no publica puerto?**
    Porque no hace falta: nginx hace de proxy de `/api/` por la red interna de
    Docker. Un puerto publicado es superficie de ataque gratis. Por el mismo
    motivo `/metrics` **no es alcanzable desde el navegador**.

20. **¿Por qué el CI no corre pruebas unitarias?**
    Porque se miró qué rompió este proyecto de verdad. De los seis problemas
    reales de los puntos 4 a 14, las unitarias habrían atajado **cero**: todos
    aparecen cuando el sistema se levanta entero. El pipeline levanta el stack
    con `docker compose` y le pega a la API. Y sí, es deuda: está en
    [`16-limitaciones.md`](16-limitaciones.md).

21. **¿El pipeline funcionó a la primera?**
    No, y eso es lo que prueba que corrió. Cuatro fallos reales: el volumen
    `external` que no existe en un entorno limpio; esperar al frente estático en
    vez de a la API; un **falso positivo** de métricas expuestas, porque nginx
    sirve una SPA y cualquier ruta devuelve 200 con el `index.html`; y
    `codigo=$(curl … || echo 000)`, que deja la variable con dos `000` y cortaba
    el bucle en el primer intento.

22. **¿Cómo evitan que una versión rota llegue al entorno publicado?**
    `ci.yml` valida y **no puede publicar** (`contents: read`). `entrega.yml`
    construye, escanea con Trivy **antes** de publicar y sólo corre si el CI
    terminó bien. Y `desplegar.sh` verifica después de levantar y **vuelve atrás
    solo**, porque `docker compose up -d` sale con código 0 aunque el proceso de
    adentro se esté reiniciando en bucle.

23. **Encontraron una inconsistencia en las versiones de Node. ¿Cuál?**
    El CI usa **Node 22** y las imágenes **Node 24**. O sea que lo que valida el
    pipeline no es exactamente lo que corre en producción. Está en
    [`03-inventario.md`](03-inventario.md) y sin corregir.

24. **¿Qué es el problema del CRLF que menciona el informe?**
    `core.autocrlf=true` convierte los `.sh` al clonarlos en Windows, y
    `/bin/sh` lee `set -u\r` y muere. El servicio de copias quedaba
    reiniciándose en bucle. Se agregó un `.gitattributes` forzando LF. Le
    hubiera pasado a cualquiera que clonara en Windows.

### Frente 4 · Publicación y monitoreo

25. **¿Por qué un túnel y no abrir un puerto en el router?**
    Porque el ISP usa **CGNAT y NAT simétrico**: no hay redirección de puertos
    posible. No es una preferencia, es la única opción.

26. **¿Cómo prueban que de verdad sale a Internet y no es un atajo local?**
    Por la cabecera `CF-RAY`, que termina en **`EZE`**: la petición pasó por el
    datacenter de Cloudflare en Ezeiza. Más el certificado de Let's Encrypt
    para `liners-panel.com`.

27. **¿Qué servicios publicaron?**
    **Sólo nginx.** Los otros nueve —base, pgAdmin, Grafana, Prometheus,
    Alertmanager, Mantis, Nextcloud, n8n, Mailpit— **no están en el ingress del
    túnel**, y los que publican puerto lo hacen en `127.0.0.1`. La consigna pide
    exponer sólo lo necesario y no publicar la base.

28. **`/metrics` y `/api-docs` desde afuera, ¿qué devuelven?**
    El `index.html` de la SPA, 16.695 bytes, los mismos que `/`. **No están
    protegidos: están fuera del camino**, que es distinto y conviene decirlo
    así. Swagger además pide usuario y contraseña.

29. **Publicar rompió un control de seguridad. ¿Cuál?**
    El limitador de intentos de login. **cloudflared no manda
    `X-Forwarded-For`, manda `CF-Connecting-IP`**, así que el backend veía la IP
    del contenedor en todas las peticiones. El limitador cuenta por IP: diez
    intentos fallidos de cualquiera **dejaban afuera a todo el mundo quince
    minutos**. El control que el punto 14 bajó de 100 a 10 para frenar fuerza
    bruta se convertía, al publicar, en una forma de apagar el login desde
    afuera sin autenticarse. Se arregló con un `map` en nginx y se verificó en
    `historial_accesos`: `172.24.0.17` → `181.177.197.253`.

30. **¿Qué mide el tablero de Grafana?**
    22 paneles: CPU, memoria, disco, red, estado y reinicios de contenedores,
    disponibilidad de la aplicación, métricas de la base, conexiones activas y
    **estado de replicación** con la etiqueta `nodo`.

31. **¿Probaron que las alertas disparan?**
    Sí, de punta a punta. Se paró el backend: pasó a `pending` a los **32 s**, a
    `firing` a los **90 s**, llegó al receptor con el JSON completo, y al
    levantarlo llegó el aviso de resuelto.

32. **Una regla estaba mal escrita. ¿Cuál?**
    La de memoria. `usado/total` da 0,92 con el sistema **ocioso**, porque V8
    mantiene el montículo reservado casi lleno: habría sonado siempre. Se
    arregló publicando `nodejs_heap_size_limit_bytes` y midiendo contra el
    techo. Son 2240 MB, y el proceso murió a los 2 GB en el punto 5.

### Frente 5 · Procesos, incidencias, n8n y seguridad

33. **¿Cuántas incidencias cargaron y de qué tipo?**
    17 en Mantis: 16 cerradas y 1 aceptada a propósito, 6 de seguridad, las 17
    con notas y etiquetas, 27,0 h registradas. La consigna pide al menos 10, con
    una de rendimiento y una de seguridad.

34. **¿Son incidencias reales o inventadas?**
    Reales, todas. Cada una salió de algo que rompió durante el trabajo y tiene
    el commit que la cerró. Se verificaron leyendo la API de Mantis de vuelta.

35. **¿Qué hacen los tres flujos de n8n?**
    F01: Prometheus detecta una anomalía → n8n abre incidencia en Mantis → avisa.
    F02: verifica la copia de seguridad y registra el estado. F03: recopila
    métricas, arma un informe y lo sube a Nextcloud.

36. **¿Cómo probaron F01?**
    Inyectando la alerta **en Alertmanager**, no en el webhook: así se prueba el
    camino completo. Abre la incidencia, **no duplica** si la alerta se repite, y
    da 403 sin el secreto.

37. **La mejor pregunta del trabajo: ¿qué errores no daban ningún error?**
    Cinco. El peor: **F01 leía las etiquetas de Prometheus en inglés** y las
    reglas de este proyecto están en castellano, así que con una alerta real la
    severidad caía al valor por defecto y el filtro la descartaba. **No habría
    abierto una sola incidencia y no habría fallado nunca.** Los otros: F02
    buscaba `*.sql.gz` cuando las copias son `*.dump`; `Convert to File` con
    `toBinary` subía basura binaria sin avisar; una frase que F01 escribía era
    falsa; y sin un `id` fijo cada importación creaba flujos nuevos.

38. **¿Está protegida la interfaz de n8n?**
    **No, y es el hallazgo 15.** `N8N_BASIC_AUTH_*` no existe en n8n 1.x: esas
    tres variables se leen y se ignoran, y el comentario del `compose` que dice
    que pide usuario y clave **es falso**. Lo único que lo contiene es que el
    puerto está en `127.0.0.1` y fuera del túnel. Se creó la cuenta de
    propietario, que cierra la ventana, pero la causa —el comentario y las
    variables muertas— se corrige aparte.

39. **¿Qué encontró el escaneo de vulnerabilidades?**
    `npm audit` + Trivy. Backend 1 crítica / 6 altas → **0/0**. Frontend 4 altas
    → **0**. Imagen del backend 1 crítica / 33 altas → **0/6**. Lo que queda no
    tiene parche publicado. **No se usó Docker Scout** porque exige iniciar
    sesión en Docker Hub.

40. **¿Cuál era la vulnerabilidad crítica?**
    `proxy-addr`: permitía falsificar `X-Forwarded-For` y **esquivar justamente
    el limitador de login** que se acababa de ajustar en ese mismo commit. Dos
    controles que por separado parecían bien, juntos no servían.

41. **¿Cómo controlan los permisos en Nextcloud?**
    Matriz de permisos probada **de las dos puntas**: la cuenta del robot hace
    `PUT` → 201 y `DELETE` → **403**. Enlaces públicos apagados. Probar sólo que
    lo permitido funciona no prueba nada.

42. **¿Dónde están documentados los impedimentos y los cambios de alcance?**
    En [`scrum/seguimiento.md`](scrum/seguimiento.md): siete impedimentos de
    proceso y seis cambios de alcance, cada uno con su razón y su evidencia.

---

## 5 · Las ocho que más duelen

Son las que apuntan a lo que **no** anda. Separan a quien hizo el trabajo de
quien lo leyó. Hay que contestarlas sin ponerse a la defensiva: están todas
documentadas, y eso es lo que se defiende.

1. **«Hay diecinueve endpoints sin ninguna autenticación. ¿Lo sabían?»**
   Sí: es **D-01**, lo encontró el diagnóstico del punto 1 y está en
   [`09-seguridad.md`](09-seguridad.md) como hallazgo 12. Cinco archivos de
   rutas no importan el middleware mientras `caja.route.js` sí lo tiene. El peor
   es `DELETE /api/roles/:id` con el `CASCADE` de `usuario_roles`: deja el
   sistema sin nadie que pueda administrarlo.

2. **«¿Y por qué no lo arreglaron?»**
   Porque son cinco líneas que cambian pantallas que hoy funcionan sin token, y
   **no hay pruebas** para verificar que no se rompe nada. A cuatro días de la
   defensa, sin red, romper la aplicación es peor que documentar el agujero. Es
   el cambio de alcance C-03. **Y el túnel se baja después de la presentación
   justamente por esto.**

3. **«Mostrame que la aplicación anda, no la captura.»**
   Para eso está §6. Hay que tenerlo abierto de antes.

4. **«¿Quién hizo qué?»**
   La respuesta honesta: hasta el 10/11 el trabajo técnico lo llevó un
   integrante, el reparto de frentes se hizo después, y está dicho en
   [`scrum/seguimiento.md`](scrum/seguimiento.md) §6 y §7. Inventar un reparto
   anterior se cae con `git log`, que tiene un solo autor.

5. **«¿Revisaron los pull requests?»**
   No con aprobación de otro integrante. Es el impedimento I-04. Los PR #1 y #2
   se mergearon sin revisión. Está escrito en el registro, no escondido.

6. **«El tablero de Grafana muestra cAdvisor sin datos por contenedor.»**
   Cierto. Este Docker Desktop usa el almacén de imágenes de containerd y
   cAdvisor no encuentra la capa de escritura. Se probaron `--docker_only` y
   `--disable_metrics`. Las dos salidas son configuración de la máquina y no se
   hicieron. Queda el agregado de todos los contenedores y el detalle del
   backend por sus propias métricas.

7. **«¿Por qué no hay un solo test unitario?»**
   Porque se eligió la prueba de humo del CI, con el argumento medido de la
   pregunta 20. Es deuda y está anotada. No es que no se haya llegado.

8. **«La imagen de n8n tiene una actualización crítica pendiente.»**
   Sí, el propio n8n lo avisa: 1.70.1 contra 1.121.0. Fijar la versión es
   correcto y es lo que defiende [`03-inventario.md`](03-inventario.md); lo que
   falta es la otra mitad, **algo que avise cuando la versión fijada queda
   vieja** (Renovate o Dependabot). Y Trivy no lo atrapó porque sólo escanea las
   imágenes que construye el pipeline, no las de terceros.

---

## 6 · La demostración en vivo

La consigna dice que mostrar capturas **no alcanza**. Esto es el requisito, no
el adorno, y son dos minutos: no hay margen para que algo arranque en vivo.

### Media hora antes

```bash
docker compose --profile app --profile monitoreo --profile procesos --profile tunel up -d
```

Y después, en este orden:

- [ ] `curl -I https://restoya.liners-panel.com` devuelve **200**.
- [ ] El tablero de Grafana **abierto y cargado**. Grafana sólo dibuja los
      paneles que entran en pantalla: si se abre en el momento, se ve negro.
- [ ] Mantis abierto **con el filtro de cerradas apagado**:
      `view_all_set.php?type=1&hide_status=-2` — si no, muestra 1 incidencia de 17.
- [ ] n8n abierto en la lista de ejecuciones.
- [ ] Una pestaña con el repositorio en GitHub.
- [ ] En un clon limpio hay que crear `infra/prometheus/.token-alertas` **antes**
      de levantar el perfil `monitoreo`: Docker, al montar un archivo que no
      existe, **crea una carpeta** con ese nombre y Alertmanager no arranca.

### El orden de la demostración

1. **Barra de direcciones primero.** `restoya.liners-panel.com` — que se vea
   que no es `localhost`. Es el punto 9 en dos segundos.
2. Entrar y abrir una pantalla con datos reales.
3. **Grafana**, el tablero entero. Señalar el panel de replicación.
4. **Mantis**, «1 - 17 / 17», y abrir INC-06.
5. Si sobra tiempo: n8n, la lista de ejecuciones con los tres errores de F03.

### Si algo no levanta

Las 17 capturas de [`capturas/`](capturas/README.md) son el respaldo, y cada una
dice qué prueba. **Decir que es el respaldo porque algo no levantó** es mejor
que fingir. Pero no es el plan.

---

## 7 · Cuatro cosas que no hay que decir

1. **«Monitoreamos las consultas SQL lentas.»** La consigna lo advierte
   expresamente: no se puede afirmar eso si sólo se observan métricas generales
   de la base. Decir lo que el exportador mide de verdad.
2. **«Tenemos alta disponibilidad.»** Hay replicación. La consigna pide
   demostrar la detección, la promoción y la prevención de pérdida si se afirma
   failover automático, y acá es manual.
3. **«Está todo funcionando.»** No lo está, y el informe lo dice en
   [`16-limitaciones.md`](16-limitaciones.md). Decir «todo anda» y que después
   aparezca D-01 en una pregunta es el peor orden posible.
4. **«Esto lo hizo la IA.»** Tampoco lo contrario. La consigna evalúa la
   capacidad de **explicar decisiones y resolver problemas**: lo que se defiende
   es por qué está hecho así, y eso hay que poder contarlo sin el documento
   delante.
