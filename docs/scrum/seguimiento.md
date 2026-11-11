# Seguimiento del proyecto

El punto 2 de la consigna pide **evidencias de seguimiento**, y lista tres
actividades que no son el backlog ni los sprints:

> 5. Registrar las tareas y sus estados.
> 6. Realizar reuniones breves de seguimiento.
> 7. Documentar impedimentos, cambios de alcance y decisiones.

Este documento es eso. [`backlog.md`](backlog.md) dice **qué hay que hacer** y
[`sprints.md`](sprints.md) dice **cuándo**; acá está **qué pasó de verdad**, con
el commit, el PR o la medición que lo prueba.

> **Por qué se escribe así.** Un registro de seguimiento en el que todo sale
> bien no es un registro de seguimiento: es un folleto. Lo que sigue tiene más
> impedimentos que avances, y está bien que así sea, porque los impedimentos
> son lo que se gestiona.

---

## 1 · Dónde vive cada cosa

| Qué | Dónde | Por qué ahí |
|---|---|---|
| Tareas y sus estados | [Tablero de Trello](https://trello.com/b/ZF8ZDLWA) | Es la herramienta que pide la consigna. Cada tarjeta lleva su ID (`E4-07`) |
| Backlog con criterios de aceptación | [`backlog.md`](backlog.md) | El tablero se lee tarjeta por tarjeta; el archivo se lee entero y entra en un PR |
| Plan de sprints | [`sprints.md`](sprints.md) | Idem |
| **Bitácora, impedimentos y cambios de alcance** | **este archivo** | §2, §3 y §4 |
| Errores encontrados y resueltos | **Mantis**, 17 incidencias → [`../12-incidencias.md`](../12-incidencias.md) | Un impedimento de proceso no es lo mismo que un error del producto. Los errores van a la herramienta de incidencias, que es lo que pide el punto 11 |
| Decisiones técnicas | Cada informe de `docs/`, en su sección «por qué esto y no otra cosa» | Una decisión se entiende al lado de lo que decide, no en una lista aparte |
| Vínculo tarea ↔ código | El ID de la tarjeta en el mensaje del commit | Lo pide el punto 3: «commits descriptivos y vinculados con las tareas» |

**Cadencia acordada:** una revisión de tablero por jornada de trabajo y una
reunión del grupo antes de cada entrega parcial. Ver §6, que aclara hasta
dónde se cumplió.

---

## 2 · Bitácora

Las fechas y los identificadores de commit salen de `git log`; se pueden
verificar uno por uno.

### Jueves 06/11 — arranque

**Avance.** Repositorio creado. El backend y el frontend de RestoYa se traen
con `git subtree` desde el repositorio de Programación y Servicios Web, para
**conservar el historial original** (`c5b0ba6`, `6fa8709`): 150 commits y 10
pull requests de junio y julio de 2026, hechos por el grupo original. Estrategia
de ramas definida y `main` protegida con un *ruleset* (`e7736e0`).

**Impedimento.** Ninguno.

**Decisión.** Un solo repositorio con `git subtree` en vez de tres repositorios
o un copiar y pegar. El copiar y pegar habría borrado el historial, que es
justamente una de las evidencias que pide el punto 3.

**Verificación.** La protección de `main` se comprobó **con un push rechazado
de verdad**, no leyendo la pantalla de configuración (`8e7d775`).

### Domingo 09/11 — base de datos y contenedores

**Avance.** Punto 4 cerrado: PostgreSQL 16.15 contenerizado con volumen,
red interna, pgAdmin y servicio de copias (`692c7d3`). Generador del conjunto
de prueba y carga de los 6.000.000 de filas por tabla (`ec1296a`). Punto 7:
Dockerfiles del backend y del frontend, y la URL del backend sacada de
**13 archivos** a `environment.ts` (`9e88105`). Backlog y plan de sprints
escritos (`a47ec21`).

**Impedimentos.**

1. `enum_pedidos_tipoPedido` tiene mayúsculas y PostgreSQL exige comillas. El
   generador fallaba sin explicar por qué.
2. El bloque que llenaba `detalle_pedidos` usaba `CROSS JOIN LATERAL … OFFSET`,
   que recorre la tabla de productos **una vez por fila**. Con 6 millones de
   filas no terminaba nunca. Reemplazado por `row_number()` con join por módulo.

**Decisión.** Los datos del conjunto de prueba **no son uniformes a propósito**:
fechas concentradas en meses recientes, estados con distribución realista,
70 % LOCAL y 30 % DELIVERY. Con datos planos el planificador no puede
distinguir selectividad y los `EXPLAIN` del punto 5 serían irreales.

**Verificación.** Copia de 466,8 MB en 201 s y restauración en 75 s, con los
conteos exactos de las dos puntas (`64e7610`).

### Lunes 10/11 — el día largo

Nueve puntos avanzaron en una jornada. Está contado en orden.

**Punto 5 — optimización** (`44bb050`). 10 índices, 4 vistas materializadas.
Pantalla de cocina 1204,8 ms → **0,9 ms**; login 282,1 ms → **0,09 ms**.

> **Impedimento, y es el más grande del día:** `GET /api/pedidos/cocina`
> **tumbaba el backend entero** con `JavaScript heap out of memory`, y lo
> seguía tumbando **después** de que la consulta SQL bajara a 0,9 ms. No era un
> problema de la base: la consulta no tenía `LIMIT` y Node intentaba
> materializar 1,33 millones de pedidos. La lección quedó escrita: **optimizar
> la consulta no arregla una aplicación que pide todo.**

> **Decisión que contradice el manual:** bajar `random_page_cost` a 1,1 «porque
> es SSD» hizo la consulta **dos veces más lenta**. El planificador cambió el
> bitmap scan por un index scan y pasó de leer 5.661 bloques a 632.029. Se
> revirtió, y quedó documentado en [`../07-optimizacion-sql.md`](../07-optimizacion-sql.md)
> porque un resultado que contradice lo esperado vale más que uno que lo confirma.

**Punto 10 — monitoreo** (`f82e97d`). Prometheus, Grafana, Alertmanager y tres
exportadores.

> **Impedimento:** la regla de alerta de memoria estaba **mal escrita**.
> `usado/total` da 0,92 con el sistema ocioso, porque V8 mantiene el montículo
> reservado casi lleno. La alerta habría sonado siempre. Se arregló publicando
> `nodejs_heap_size_limit_bytes` y midiendo contra el techo.

**Punto 14 — seguridad** (`cae3fda`). Seis hallazgos corregidos.

> **Impedimento:** el escaneo con Trivy encontró una vulnerabilidad **crítica**
> en `proxy-addr` que permitía falsificar `X-Forwarded-For` y **esquivar
> justamente el limitador de login que se acababa de ajustar** en ese mismo
> commit. Dos controles que por separado parecían bien, juntos no servían.

**Punto 6 — replicación** (`7dcdc1e`, `f173bf2`).

> **Impedimento:** el `pg_hba.conf` del primario estaba editado **dentro del
> volumen**, o sea que el cambio existía en una sola máquina y no en el
> repositorio. Se pasó a montarlo desde el repositorio. Es el mismo tipo de
> problema que la consigna señala cuando pide entornos reproducibles.

**Punto 8 — CI/CD** (`5c89ce5`). Y acá está la parte que más enseña:
**cuatro commits de arreglo seguidos**, cada uno por un fallo real del
pipeline, no por una corrección de estilo.

| Commit | Qué falló |
|---|---|
| `fa0d43c` | El volumen `external` no existe en un entorno limpio |
| `1a09773` | La prueba esperaba al frente estático en vez de a la API |
| `ac8e32b` | Falso positivo de métricas expuestas: nginx sirve una SPA, así que **cualquier** ruta devuelve 200 con el `index.html` |
| `da3014f` | `codigo=$(curl … \|\| echo 000)` deja la variable con dos `000` y el bucle se cortaba en el primer intento |

> **Decisión:** `ci.yml` **no corre pruebas unitarias**. Se miró qué rompió
> este proyecto de verdad y, de los seis problemas reales de los puntos 4 a 14,
> las unitarias habrían atajado **cero**: todos aparecen recién cuando el
> sistema se levanta entero. El pipeline levanta el stack con `docker compose`
> y le pega a la API. El razonamiento está en [`../11-cicd.md`](../11-cicd.md) §2.

**Puntos 11, 12 y 13 — procesos** (`498f8c4`, y la corrida en `007c395`).

> **Impedimento, y el peor del proyecto entero:** al correrlos de verdad
> aparecieron **17 problemas, y cinco no daban ningún error**. El peor: el
> flujo F01 leía las etiquetas de Prometheus **en inglés** y las reglas de este
> proyecto están en castellano, así que con una alerta real la severidad caía al
> valor por defecto y el filtro la descartaba. **No habría abierto una sola
> incidencia, y no habría fallado nunca.** La moraleja está en
> [`../14-automatizacion.md`](../14-automatizacion.md) §8: *una ejecución «con
> éxito» no prueba que el resultado esté bien*. Hubo que abrir el archivo del
> otro lado y leerlo.

**Impedimento del día, transversal:** el **motor de Docker se cayó** y los dos
nodos de PostgreSQL estuvieron cuatro horas apagados. Bloqueó la corrida de los
puntos 11, 12 y 13 hasta que el usuario abrió Docker Desktop a mano.

> **Y dejó un regalo:** al volver, la réplica **retomó el streaming sola, con
> 0 bytes atrás y sin volver a clonar**. Es exactamente lo que compra la ranura
> de replicación, y es evidencia que no se puede fabricar.

**Punto 9 — publicación** (`e416148`, `f95b913`, `44bda71`, `f1b0e02`).
La aplicación quedó en **https://restoya.liners-panel.com**.

> **Tres impedimentos, los tres destapados por publicar:**
> 1. `preparar-tunel.sh` creaba el túnel y después no podía encontrarlo:
>    `cloudflared tunnel list --output json` no pone `deleted_at` en `null` sino
>    la **fecha cero de Go**, que como cadena es un valor verdadero. El script
>    había dejado de ser idempotente **sin avisar**.
> 2. Las tres cabeceras de seguridad de nginx no llegaban a ninguna respuesta de
>    HTML: un `location` con `add_header` propio **no hereda** los del padre.
> 3. El grave: **cloudflared no manda `X-Forwarded-For` sino `CF-Connecting-IP`**.
>    El limitador de login cuenta por IP, así que con todo llegando con la IP del
>    contenedor, **diez intentos fallidos de cualquiera dejaban afuera a todo el
>    mundo quince minutos**. El control que el punto 14 bajó de 100 a 10 para
>    frenar fuerza bruta se convertía, **al publicar**, en una forma de apagar el
>    login desde afuera sin autenticarse.

**Punto 1 — diagnóstico** (`ce9489f`). Escrito último, y encontró lo peor:

> **D-01: diecinueve endpoints sin ninguna autenticación.** Cinco archivos de
> rutas no importan el middleware mientras `caja.route.js` sí lo tiene. El peor
> es `DELETE /api/roles/:id` con el `CASCADE` de `usuario_roles`: deja el
> sistema sin nadie que pueda administrarlo.

### Martes 11/11 — capturas, y dos agujeros más

**Avance.** 17 capturas de pantalla (`a5c0266`, `1407e24`), cada una con la
frase de **qué prueba**. Tablero de Trello puesto al día. Este documento y
[`../17-defensa.md`](../17-defensa.md).

> **Impedimento convertido en hallazgo:** sacar las capturas obligó a entrar a
> cada herramienta, y **n8n no pidió nada**. `N8N_BASIC_AUTH_*` no existe en
> n8n 1.x: esas tres variables se leen y se ignoran, y el comentario del
> `compose` que dice que la interfaz pide usuario y clave **es falso**. Son los
> hallazgos 15 y 16 de [`../09-seguridad.md`](../09-seguridad.md). Un agujero de
> seguridad encontrado sacando una foto.

**Cuatro impedimentos técnicos menores, anotados porque se repiten:**

| Qué pasó | Por qué |
|---|---|
| El tablero de Grafana salió **negro** | Grafana sólo dibuja los paneles que entran en pantalla; `captureBeyondViewport` agranda la imagen pero **no desplaza** |
| Mantis mostró **1** incidencia de 17 | El filtro por defecto esconde las cerradas |
| El inicio de sesión de Mantis daba `cookie_error=1` | Mantis redirige a `localhost` y la cookie se había puesto en `127.0.0.1` |
| pgAdmin rechazó el envío automático | «The CSRF token is missing». Queda para sacar a mano |

**Decisión.** Estaba autorizado inventar datos para completar el trabajo y
**no se inventó ninguno**. Un informe donde el 95 % está medido y el 5 % está
inventado no es un informe confiable en un 95 %: es uno en el que hay que
volver a verificar todo. Queda como decisión 46 del registro de decisiones.

---

## 3 · Impedimentos

Los de proceso. Los del producto son las 17 incidencias de Mantis.

| # | Impedimento | Cuándo | Estado |
|---|---|---|---|
| I-01 | El motor de Docker se cae y arrastra los 23 contenedores | 10/11 y 11/11 | **Recurrente, sin resolver.** Requiere abrir Docker Desktop a mano. Bloquea cualquier corrida |
| I-02 | cAdvisor no enumera los contenedores uno por uno | 10/11 | **Sin resolver.** Docker Desktop usa el almacén de containerd (`Storage Driver: overlayfs`) y cAdvisor no encuentra la capa de escritura. Se probaron `--docker_only` y `--disable_metrics`. Las dos salidas son configuración de la máquina y no se hicieron |
| I-03 | El repositorio se había creado como «grupo13» y el grupo es el **12** | 10/11 | **Resuelto.** Renombrado; la dirección vieja devuelve 301, las siete ramas y el *ruleset* sobrevivieron. ⚠️ El tablero de Trello **todavía dice Grupo 13** |
| I-04 | Ningún PR tiene aprobación de otro integrante | desde el 10/11 | **Sin resolver, y bloquea `main`.** Ver §3.1 |
| I-05 | `infra/prometheus/.token-alertas` está en el `.gitignore`, y Docker, al montar un archivo que no existe, **crea una carpeta** con ese nombre | 10/11 | **Resuelto con un aviso en el README**: en un clon limpio hay que crear el archivo antes de levantar el perfil `monitoreo` |
| I-06 | El CI falla en ramas que no tocaron el CI | 10/11 | **Resuelto en el PR #4.** Compose interpola el archivo **entero** sin mirar los perfiles, así que las variables obligatorias de Mantis, Nextcloud y n8n hacían fallar hasta la validación del perfil `app` |
| I-07 | `ci.yml` existía en **una sola rama** | 10/11 | **Resuelto** al mergear el PR #2. Mientras tanto, los empujes a las otras ramas no disparaban ningún CI: el PR #1 llevaba el compose y el #2 el CI, y **ninguno de los dos validaba al otro** |

### 3.1 · I-04, el que hay que mirar de frente

La definición de terminado del tablero dice «revisado por otro integrante en un
PR». **No se está cumpliendo:**

- Los PR #1 y #2 se mergearon sin revisión.
- Los cuatro PR abiertos llevan una revisión escrita, pero la escribió el autor,
  y GitHub **no deja que el autor se apruebe a sí mismo**.
- El *ruleset* de `main` exige una aprobación, así que `develop` → `main`
  **no se puede mergear** hasta que alguien del grupo apruebe.

Lo destraban dos clics de otra persona: invitar a los cuatro integrantes
(E3-04) y aprobar un PR (E3-05). Queda escrito acá a propósito: es mejor que la
cátedra lo lea en el registro a que lo descubra en la defensa.

---

## 4 · Cambios de alcance

| # | Qué cambió | Por qué | Dónde queda |
|---|---|---|---|
| C-01 | **E4-06, migraciones versionadas** sale del alcance | El esquema se versiona en `schema.sql` más los scripts numerados, que es lo que corre un clon limpio. Una herramienta de migraciones agregaba una dependencia y un estado nuevo —la tabla de aplicadas— para una base que acá se crea de cero cada vez. Lo importante sí se hizo: se **sacó `sequelize.sync({ alter: true })`** del arranque, que recreaba las 7 claves foráneas en cada arranque y había acumulado 8 constraints UNIQUE duplicadas en `mesas` | Backlog, y [`../16-limitaciones.md`](../16-limitaciones.md) |
| C-02 | **E8-01, pruebas unitarias del backend** → prueba de humo del CI | De los seis problemas reales de los puntos 4 a 14, las unitarias habrían atajado **cero**. Sigue siendo deuda: sin unitarias no hay red para los cambios de lógica | [`../11-cicd.md`](../11-cicd.md) §2 |
| C-03 | **D-01, los 19 endpoints sin autenticación, NO se corrigen** | Son cinco líneas, pero cambian pantallas que hoy funcionan sin token y **no hay pruebas** para verificar que no se rompe nada. Corregirlo a cuatro días de la defensa, sin red, es peor que documentarlo | [`../01-descripcion.md`](../01-descripcion.md) y [`../09-seguridad.md`](../09-seguridad.md) hallazgo 12 |
| C-04 | **cAdvisor por contenedor** → sólo el agregado | Limitación de la máquina, no del diseño (I-02). Queda el agregado de todos los contenedores y el detalle del backend por sus propias métricas | [`../08-monitoreo.md`](../08-monitoreo.md) |
| C-05 | **Failover automático**: nunca entró, y se dice | La consigna avisa: *«Si el equipo afirma contar con failover automático, deberá demostrar cómo se detecta la falla…»*. No lo hay. Se documenta la promoción **manual**, medida: 0 bytes atrás, promoción en 1 s, 3 s del corte a tener un nodo aceptando escrituras — y se aclara que esos 3 s son el tiempo de la promoción, no de la recuperación: hay que sumarle los 90 s de Prometheus más lo que tarde una persona | [`../10-cluster.md`](../10-cluster.md), primera línea |
| C-06 | Repositorio renombrado de `grupo13` a **`grupo12`** | El grupo es el 12 (I-03). Cada integrante conviene que corra `git remote set-url origin https://github.com/prieto555/tp-integrador-hia-grupo12.git`, porque la redirección 301 no es para siempre | README |

---

## 5 · Decisiones

Las decisiones técnicas **no se listan acá**: viven al lado de lo que deciden,
en la sección «por qué esto y no otra cosa» de cada informe. Un índice suelto de
decisiones se desactualiza el primer día.

Las cinco que más conviene tener a mano para la defensa, con dónde está la
justificación medida:

| Decisión | Dónde |
|---|---|
| No bajar `random_page_cost` a 1,1 aunque sea SSD — lo hizo **2× más lento** | [`../07-optimizacion-sql.md`](../07-optimizacion-sql.md) |
| No usar la lista `read`/`write` de Sequelize para la réplica: reparte **todas** las lecturas y produce el «cargué el pedido y no aparece» | [`../10-cluster.md`](../10-cluster.md) |
| El CI levanta el sistema en vez de correr unitarias | [`../11-cicd.md`](../11-cicd.md) §2 |
| Publicar **sólo nginx**: los otros nueve servicios quedan fuera del túnel a propósito | [`../15-publicacion.md`](../15-publicacion.md) §3 |
| No corregir D-01 a cuatro días de la defensa | C-03, acá arriba |

---

## 6 · Reuniones de seguimiento

**Cadencia acordada:** una revisión de tablero por jornada de trabajo, y una
reunión del grupo antes de cada entrega parcial.

**Hasta dónde se cumplió, dicho sin vueltas.** El grupo quedó confirmado el
**10/11** —Aramayo, Armella, Cruz, Pol y Prieto— y hasta esa fecha el trabajo
técnico lo llevó **un solo integrante**. Las secciones 2 a 4 de este documento
son, por lo tanto, el **registro de trabajo** de esa etapa: avance, impedimento
y decisión por jornada, que es exactamente lo que una reunión de seguimiento
produce, sin la reunión.

**No se escriben actas de reuniones que no ocurrieron.** Fabricar cinco actas
con nombres y aportes inventados sería la clase de evidencia que esta materia
enseña a no aceptar, y es la primera que se cae ante una pregunta individual.

**A partir del reparto de los cinco frentes** (tarjeta E2-07) cada reunión se
registra acá abajo con esta plantilla:

```
### Reunión N — fecha, duración, quiénes

**Avances desde la anterior** — una línea por frente.
**Impedimentos** — qué bloquea, a quién, y qué se necesita para destrabarlo.
**Decisiones** — qué se decidió y quién queda a cargo.
**Para la próxima** — compromisos con nombre y fecha.
```

Tres preguntas, que son las del *daily* de Scrum adaptadas a un trabajo que se
entrega una sola vez: qué cerré, qué me bloquea, qué necesito de los demás.

---

## 7 · Qué NO prueba este registro

- **No prueba trabajo repartido.** Hasta el 10/11 lo hizo una persona. Lo dice
  §6 y lo confirma `git log`: todos los commits del integrador tienen el mismo
  autor. El reparto de frentes (E2-07) es lo que cambia eso, y todavía no pasó.
- **No prueba revisión entre pares.** Ver I-04.
- **No es exhaustivo.** Están los impedimentos que cambiaron una decisión o
  costaron más de media hora. Los tropiezos de diez minutos no se anotaron, y
  hubo muchos.
- **Las fechas son del `git log`, no de una planilla de horas.** Un commit a las
  05:11 dice cuándo se empujó, no cuántas horas llevó.
