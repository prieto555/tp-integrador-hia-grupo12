# Cómo seguir — pasos para cerrar el trabajo

Este documento **no es un entregable de la consigna**. Es la parte logística:
qué falta, en qué orden, y quién tiene que hacer cada cosa. Está acá adentro y
no en un chat para que no se pierda y para que los cinco vean lo mismo.

Escrito el **11/11/2026**. La presentación es la **semana del 16/11**.

---

## Dónde está todo, hoy

Lo técnico está terminado y en **una sola rama**: `develop`.

| Qué | Dónde | Estado |
|---|---|---|
| Código, infraestructura y documentación | Rama `develop` del [repositorio](https://github.com/prieto555/tp-integrador-hia-grupo12) | **Completo**. Los cinco PR abiertos se mergearon el 11/11 |
| Los 16 documentos obligatorios | `docs/`, índice en [`README.md`](README.md) | **Escritos** |
| Las capturas | [`docs/capturas/`](capturas/README.md) | **19**, cada una con la frase de qué prueba |
| El tablero | [Trello](https://trello.com/b/ZF8ZDLWA) | Al día, pero con **un solo miembro** |
| La aplicación publicada | https://restoya.liners-panel.com | Responde **cuando el stack está levantado** |
| CI | GitHub Actions sobre `develop` | **En verde** |

**Para mirar el trabajo sin levantar nada**, el orden de lectura es:
[`README.md`](README.md) → [`01-descripcion.md`](01-descripcion.md) →
[`02-arquitectura.md`](02-arquitectura.md) → [`capturas/`](capturas/README.md).
Y para la defensa, [`17-defensa.md`](17-defensa.md).

**Para levantarlo**, la puesta en marcha está en el `README.md` de la raíz. Dos
avisos que hacen perder una hora si no se saben:

1. Hay que crear `infra/prometheus/.token-alertas` **antes** de levantar el
   perfil `monitoreo`. Está en el `.gitignore` porque lleva un secreto, y
   Docker, al montar un archivo que no existe, **crea una carpeta** con ese
   nombre y Alertmanager no arranca.
2. Hay que copiar `infra/compose/.env.example` a `.env` y completarlo. Sin eso
   no levanta nada.

---

## Paso 1 · Mergear el PR #8 — 1 clic, lo hace Gabriel

[PR #8](https://github.com/prieto555/tp-integrador-hia-grupo12/pull/8): la
acción de Trivy estaba fijada en `0.28.0`, una versión **que no existe** (se
publican con prefijo `v`). Apareció recién el 11/11, cuando el CI de `develop`
se puso en verde y el flujo de Entrega **se ejecutó por primera vez**.

**Por qué importa:** al mergearlo, Entrega corre entero y **publica por primera
vez las imágenes en ghcr.io**, que es un entregable textual del punto 8
(«Publicar las imágenes en un registro»).

**Cómo:** botón *Merge pull request* en el PR #8.

> Si al correr falla en el paso de Trivy, **no es un error del pipeline: es el
> pipeline funcionando**. Escanea antes de publicar y con `exit-code: 1`, así
> que corta si aparece una CRITICAL o HIGH con parche disponible. En ese caso
> hay que actualizar la dependencia, no bajarle el umbral al escáner.

---

## Paso 2 · Pasar `develop` a `main` — necesita a OTRO integrante

Hoy `main` está **56 commits atrás**. Su *ruleset* exige `pull_request` con una
aprobación, y **GitHub no deja que el autor se apruebe a sí mismo**. Esto es lo
único del trabajo que Gabriel no puede hacer solo.

Los cuatro **ya son colaboradores** del repositorio (`Florrrr`, `FacundoPol`,
`Jul772`, `GerardoXL`), así que no hay que invitar a nadie: alcanza con pedirlo.

1. **Gabriel** abre el PR de `develop` → `main`:
   ```bash
   gh pr create --base main --head develop --title "Entrega final del trabajo integrador" --fill
   ```
   O desde la web: *Pull requests* → *New pull request* → base `main`, compare `develop`.
2. **Cualquiera de los otros cuatro** entra al PR, pestaña *Files changed*,
   botón *Review changes* → **Approve** → *Submit review*.
3. **Gabriel** mergea.

> **Esto no es un trámite.** El punto 3 pide «revisar el código antes de
> integrar cambios» y lo lista como entregable: *«Solicitudes de integración y
> revisiones de código»*. Hoy **ningún PR del proyecto tiene una aprobación
> real** —los cinco que se mergearon el 11/11 llevan una revisión escrita, pero
> la escribió el autor—. Está dicho sin maquillaje en
> [`scrum/seguimiento.md`](scrum/seguimiento.md) como impedimento **I-04**. Una
> sola aprobación de verdad lo cierra.

---

## Paso 3 · El tablero de Trello — 10 minutos, lo hace Gabriel

El [tablero](https://trello.com/b/ZF8ZDLWA) está al día en contenido pero tiene
tres cosas pendientes que son de interfaz y nadie más puede tocar:

1. **Renombrarlo.** Dice «TP Integrador HIA 2026 — Grupo 13» y el grupo es el
   **12**. Clic sobre el nombre, arriba, y escribir
   `TP Integrador HIA 2026 — Grupo 12`.
2. **Corregir la descripción.** Menú *⋯* → *Acerca de este tablero*. Apunta al
   repositorio viejo; la dirección correcta es
   `https://github.com/prieto555/tp-integrador-hia-grupo12`.
3. **Sumar a los cuatro.** Botón *Compartir* → invitar por correo o usuario.
   Hasta que entren, la tarjeta **E2-03 (asignar responsables)** no se puede
   cerrar: no hay a quién asignar.

Una vez que estén adentro, asignar cada tarjeta al dueño de su frente según el
paso 4.

---

## Paso 4 · Repartir los cinco frentes — lo decide el grupo

**Es lo más urgente que queda y no lo puede resolver una persona.** La
calificación es **individual** y la cátedra puede tomar examen individual. Un
frente sin dueño es una nota sin dueño.

| Frente | Puntos | Documentos que tiene que dominar | Dueño |
|---|---|---|---|
| **1 · Base de datos** | 4, 5 | [`05-docker.md`](05-docker.md), [`06-carga-datos.md`](06-carga-datos.md), [`07-optimizacion-sql.md`](07-optimizacion-sql.md) | *(a definir)* |
| **2 · Clúster y replicación** | 6 | [`10-cluster.md`](10-cluster.md) | *(a definir)* |
| **3 · Aplicación, contenedores y CI/CD** | 1, 7, 8 | [`01-descripcion.md`](01-descripcion.md), [`02-arquitectura.md`](02-arquitectura.md), [`03-inventario.md`](03-inventario.md), [`11-cicd.md`](11-cicd.md) | *(a definir)* |
| **4 · Publicación y monitoreo** | 9, 10 | [`15-publicacion.md`](15-publicacion.md), [`08-monitoreo.md`](08-monitoreo.md) | *(a definir)* |
| **5 · Procesos, incidencias, n8n y seguridad** | 2, 3, 11, 12, 13, 14 | [`12-incidencias.md`](12-incidencias.md), [`13-documental.md`](13-documental.md), [`14-automatizacion.md`](14-automatizacion.md), [`09-seguridad.md`](09-seguridad.md) | *(a definir)* |

**Criterio para repartir:** el frente 5 es el más grande pero el más fácil de
contar, porque son herramientas y procesos, no mediciones. El 1 y el 2 son los
más técnicos. Conviene que el 5 lo tome quien menos cómodo esté con SQL, no al
revés.

**Lo que cada uno tiene que poder hacer con su frente**, que es lo que la
consigna llama «acreditar el dominio»:

- explicar **qué se configuró y con qué valores**;
- explicar **por qué eso y no otra cosa**, incluida la alternativa descartada;
- decir **el número** que lo respalda, sin leerlo;
- decir **qué NO resuelve** y qué quedó afuera.

Las cuatro cosas están escritas en el informe de cada punto. No hay que
inventar nada: hay que leerlo y poder repetirlo sin el papel.

---

## Paso 5 · El repositorio nuevo con participación por integrante

La idea es un repositorio donde cada uno suba su parte en su rama y la mergee,
para que se vea el aporte de cada uno. Tres cosas prácticas antes de armarlo:

**Lo que la cátedra ve cuando abre un repositorio** son tres columnas: el autor
de cada commit, **la fecha y hora**, y qué archivos tocó. La pestaña
*Insights → Contributors* los grafica en el tiempo. Un repositorio creado en un
día con cincuenta commits de cinco autores se lee distinto de uno con actividad
repartida: no es que «se detecte», es que **se ve directamente**, y la consigna
dice que la cátedra puede tomar examen individual **para verificar la
participación efectiva**. O sea que lo que el repositorio muestre va a ser
contrastado con lo que cada uno pueda explicar en vivo.

**Por eso el reparto del paso 4 viene primero.** Si cada uno es dueño de su
frente de verdad —lo lee, lo entiende, lo puede defender— entonces que suba su
parte en su rama no es una puesta en escena: es el registro de un reparto real,
aunque el código ya estuviera escrito. Esa diferencia es toda la diferencia, y
es la que se nota en la defensa.

**Mecánica, si se hace:**

1. Crear el repositorio nuevo y hacer un primer commit con sólo el `README.md`
   y el `.gitignore`.
2. Cada uno clona y crea su rama: `feature/<nombre>-<frente>`.
3. Cada uno lleva **los archivos de su frente** a su rama, commitea con
   mensajes propios y abre su PR.
4. **Cada PR lo aprueba otro integrante**, no el autor. Eso es lo que cierra de
   verdad el punto 3, y acá sí se puede hacer bien desde el principio.
5. Mergear en orden de dependencia: infraestructura y base primero, aplicación
   después, monitoreo y publicación al final.

**Qué NO hay que hacer:** reescribir las fechas de los commits (`--date`,
`GIT_COMMITTER_DATE`, rebase con fechas falsas). Es lo único de esta lista que
puede convertir un problema de presentación en un problema de honestidad
académica, y el `git log --format=fuller` lo muestra igual, porque deja la
fecha de *autor* y la de *commit* distintas.

---

## Paso 6 · Ensayar

Con los frentes repartidos:

1. **Una corrida cronometrada**, los cinco hablando, con el guion minuto a
   minuto de [`17-defensa.md`](17-defensa.md) §3. Son 20 minutos y se van
   solos.
2. **Preguntas cruzadas**: cada uno contesta **cinco preguntas de un frente que
   no es el suyo**, sin leer. El banco está en [`17-defensa.md`](17-defensa.md)
   §4, con 43 preguntas y su respuesta corta.
3. **Las nueve que duelen** (§5), que apuntan a lo que no anda. Esas hay que
   contestarlas de memoria y sin ponerse a la defensiva: están documentadas, y
   eso es lo que se defiende.

⚠️ **Antes del ensayo hay que levantar el stack**, porque la demostración en
vivo es parte del tiempo y son 23 contenedores.

---

## Paso 7 · Lo técnico que queda

Poco, y nada bloquea la entrega.

| Qué | Quién | Cuándo |
|---|---|---|
| **Probar el sitio desde otra red** — el celular con datos móviles, no el WiFi de casa. El `CF-RAY` ya prueba que pasa por Cloudflare, pero una prueba desde afuera es mejor evidencia | Cualquiera | Antes de la presentación |
| **Registrar el *runner* autoalojado**. Sin él, el trabajo de despliegue de `entrega.yml` queda en `skipped` para siempre: sólo corre desde `main` y sobre `runs-on: [self-hosted, restoya-produccion]`. Está anotado como limitación, así que es una decisión, no un olvido — pero si se quiere demostrar el despliegue automático, hay que registrarlo | Gabriel | Opcional |
| **Bajar el túnel después de la presentación**: `docker compose --profile tunel down` | Gabriel | Después |

### Lo que queda sin corregir a propósito, y hay que saber defenderlo

No son olvidos. Son decisiones tomadas, documentadas y con la razón escrita.

- **D-01 — 19 endpoints sin ninguna autenticación.** Cinco archivos de rutas no
  importan el middleware mientras `caja.route.js` sí lo tiene. El peor es
  `DELETE /api/roles/:id` con el `CASCADE` de `usuario_roles`. Son cinco líneas,
  pero tocan pantallas que hoy andan sin token y **no hay pruebas** para
  verificar que no se rompe nada. **Y es el motivo por el que el túnel se baja
  después de la presentación.**
- **Hallazgo 17 — pgAdmin entra sin credencial** y conecta solo a la base con la
  clave guardada en su volumen. Lo contiene que está en `127.0.0.1` y fuera del
  *ingress* del túnel.
- **Sin pruebas unitarias del backend**, reemplazadas por la prueba de humo del
  CI. El argumento está medido: de los seis problemas reales del proyecto, las
  unitarias habrían atajado **cero**.

Los tres están en [`16-limitaciones.md`](16-limitaciones.md) y en
[`09-seguridad.md`](09-seguridad.md).

---

## Paso 8 · El día de la presentación

Media hora antes:

```bash
docker compose --profile app --profile monitoreo --profile procesos --profile tunel up -d
```

- [ ] `curl -I https://restoya.liners-panel.com` devuelve **200**.
- [ ] El tablero de Grafana **abierto y cargado de antes**: sólo dibuja los
      paneles que entran en pantalla, así que si se abre en el momento se ve
      negro.
- [ ] Mantis abierto **con el filtro de cerradas apagado**:
      `view_all_set.php?type=1&hide_status=-2`. Si no, muestra 1 incidencia de 17.
- [ ] n8n en la lista de ejecuciones.
- [ ] El repositorio abierto en una pestaña.

Si algo no levanta, las 19 capturas son el respaldo y cada una dice qué prueba.
**Decir que es el respaldo porque algo no levantó** es mejor que fingir. Pero no
es el plan: la consigna dice que mostrar capturas **no alcanza**.
