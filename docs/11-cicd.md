# Integración continua y despliegue continuo (punto 8)

> Qué hay acá: qué valida el pipeline y **por qué esas validaciones y no otras**,
> cómo se construyen y publican las imágenes, cómo se despliega, y qué pasa
> cuando algo sale mal.

---

## 1. Por qué el pipeline es como es

La consigna pide que *«el pipeline deberá evitar que una modificación defectuosa
se publique sin las validaciones definidas por el equipo»*. Eso obliga a elegir
las validaciones, no a poner las que vienen de ejemplo en cualquier tutorial.

Las elegimos mirando hacia atrás: **qué cosas rompieron este proyecto de verdad**
durante los puntos 4 a 14, y cuál de las verificaciones posibles habría atajado
cada una.

| Lo que rompió de verdad | ¿Lo agarra una prueba unitaria? | ¿Lo agarra `npm audit`? | ¿Lo agarra levantar el sistema? |
|---|---|---|---|
| `apiLimiter is not defined`: el backend se reiniciaba en bucle (punto 14) | Sólo si hay una prueba que importe ese archivo | No | **Sí** |
| nginx devolvía 502: resolvía el nombre `backend` una sola vez (punto 10) | No | No | **Sí** |
| El servicio de copias no arrancaba por CRLF (punto 14) | No | No | **Sí** |
| `GET /api/pedidos/cocina` tumbaba el proceso por falta de `LIMIT` (punto 5) | No, con una base vacía responde bien | No | No |
| `proxy-addr` permitía falsificar `X-Forwarded-For` (punto 14) | No | **Sí** | No |
| Angular 21.2.17 con XSS en producción (punto 14) | No | **Sí** | No |

La conclusión es incómoda pero es la que manda: en **este** proyecto, las pruebas
unitarias habrían atajado cero de los seis problemas reales. Las dos cosas que
sirven son **levantar el sistema entero y pegarle**, y **auditar las
dependencias**. Por eso el pipeline hace exactamente eso, y por eso no hay un
trabajo de «pruebas unitarias» puesto para la foto.

> Lo que esto **no** dice es que las pruebas unitarias no sirvan. Dice que en un
> trabajo cuyo riesgo está en la integración —seis servicios, un *proxy*, una
> base— la prueba que paga es la de integración. El backend hoy no tiene pruebas
> unitarias: eso está en «limitaciones» y no se disimula.

---

## 2. Los dos archivos

Están separados a propósito.

| Archivo | Cuándo corre | Qué permisos tiene |
|---|---|---|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Cada *push* a `main`, `develop`, `feature/**`, `fix/**` y cada *pull request* | `contents: read`. **No puede publicar nada.** |
| [`.github/workflows/entrega.yml`](../.github/workflows/entrega.yml) | Sólo si CI terminó bien, y sólo desde `main` o `develop` | `contents: read`, `packages: write` |

El que puede escribir en el registro es un archivo aparte, con el permiso
mínimo, y **condicionado a que CI haya pasado**:

```yaml
if: github.event.workflow_run.conclusion == 'success'
```

Esa línea es el pipeline. Sin ella, `workflow_run` se dispara igual cuando CI
falla, y el sistema publicaría imágenes rotas sin que nadie lo note.

---

## 3. Lo que valida CI

### `backend` — sintaxis y dependencias reproducibles

- `npm ci` (no `npm install`): falla si `package-lock.json` no coincide con
  `package.json`. Instalar algo y olvidarse de subir el *lock* rompe la imagen
  de Docker, que también usa `npm ci`.
- `node --check` sobre todos los `.js` fuera de `node_modules`. No reemplaza una
  prueba, pero agarra el error de tipeo que deja el servidor sin arrancar.

### `frontend` — compilación de producción

`npm run build -- --configuration production`. En Angular, **compilar es el
verificador de tipos**: una plantilla que lee una propiedad que no existe falla
acá y no en el navegador del profesor. El paquete compilado queda guardado como
artefacto 7 días.

### `auditoria` — vulnerabilidades

Tres pasos, no uno, porque no son la misma gravedad:

| Paso | Frena la corrida | Por qué |
|---|---|---|
| Backend, todas las dependencias | Sí | Todo lo que instala el backend corre en el servidor |
| Frontend, `--omit=dev` | Sí | Esto viaja al navegador del usuario |
| Frontend, incluyendo desarrollo | No (`continue-on-error`) | Corre en la máquina que compila; Angular arrastra vulnerabilidades sin parche en su cadena de compilación, y frenar por eso dejaría el pipeline en rojo permanente, que es peor que no tenerlo |

Esa separación es la misma que se usó en el informe del punto 14, y es la razón
de que ahí el número sea 4 y no 40.

### `humo` — levantar el sistema y pegarle

El trabajo que más vale. Genera un `.env` descartable, levanta el perfil `app`
con `docker compose up -d --build` y comprueba cinco cosas:

1. El frente se sirve.
2. `GET /api/productos` **no** devuelve 502/503/504 — o sea, nginx alcanza al
   backend.
3. La respuesta es un arreglo JSON: la cadena `nginx → backend → PostgreSQL`
   está entera.
4. `GET /metrics` a través de nginx **no** devuelve 200. Es una verificación de
   seguridad: el punto 10 dejó las métricas fuera del alcance del navegador y
   esto impide que vuelvan a quedar publicadas sin que nadie se entere.
5. Ningún contenedor quedó en estado distinto de `running`.

Corre con `DB_SYNC=create` y la base vacía: los seis millones de filas del punto
4 no entran en un *runner* de GitHub y tampoco hacen falta para saber si la
aplicación arranca.

---

## 4. Construcción, escaneo y publicación

```
CI en verde → construir imagen → escanear con Trivy → publicar en ghcr.io
                                       ↓ si hay CRITICAL o HIGH con parche
                                   se corta, la imagen NO se publica
```

**El escaneo va antes de publicar.** Publicar y escanear después significa que
la imagen con la vulnerabilidad ya está disponible para que alguien la baje.

Trivy corre con `ignore-unfixed: true`: sólo frena por vulnerabilidades que
*tienen parche*. El punto 14 dejó documentadas dos que no lo tienen (`brotli` en
Alpine y la biblioteca estándar de Go en la imagen de postgres); si no se
excluyeran, el pipeline estaría en rojo por algo que el equipo no puede
arreglar.

### Por qué GitHub Container Registry y no Docker Hub

La autenticación sale del `GITHUB_TOKEN` de la propia corrida, que vive lo que
dura la corrida y se destruye sola. Con Docker Hub habría que guardar una
contraseña permanente como secreto del repositorio: **un secreto más que se
puede filtrar, para no ganar nada**. Además, el punto 14 ya nos había dejado
sin Docker Scout justamente por no querer iniciar sesión en Docker Hub con una
cuenta personal.

### Las etiquetas

| Etiqueta | Para qué |
|---|---|
| `:<sha-del-commit>` | **La que importa.** Es la que usa el despliegue y la vuelta atrás. Apunta a un código exacto. |
| `:<rama>` | Seguir la última de `develop` o de `main`. |
| `:latest` | Sólo desde `main`. |

No se despliega por `:latest` nunca. `latest` no dice a qué código corresponde,
y con `latest` no se puede volver a una versión concreta: es el equivalente a
no tener versiones.

---

## 5. Despliegue

La aplicación no corre en un servidor alquilado: corre en la máquina del equipo,
que es lo que pide el punto 9 (*servidor local con túnel*). Un *runner* alojado
por GitHub no puede llegar hasta ahí. Por eso el despliegue usa un **runner
autoalojado** en esa misma máquina, con la etiqueta `restoya-produccion`.

La lógica **no** vive en el YAML sino en
[`infra/despliegue/desplegar.sh`](../infra/despliegue/desplegar.sh). Eso es a
propósito: un script se puede correr a mano en la máquina y verificar, que es
como se probó. Si estuviera escrito dentro del YAML, la única forma de saber si
funciona sería esperar a que corra el pipeline.

### Qué hace el script

```
anotar la versión actual
   ↓
docker compose pull backend frontend     (bajar las imágenes nuevas)
   ↓
docker compose up -d backend frontend    (recrear)
   ↓
verificar de verdad
   ↓                              ↓
  bien                          falla
   ↓                              ↓
anotar la versión            volver a la anterior
como desplegada              y salir con error
```

**La verificación es el motivo del script.** `docker compose up -d` sale con
código 0 en cuanto arranca el contenedor, **aunque el proceso de adentro se esté
reiniciando en bucle**. Eso nos pasó: una variable sin declarar dejó el backend
en bucle y un despliegue sin verificación lo habría dado por exitoso.

La verificación repite las mismas comprobaciones que la prueba de humo, contra
el sistema ya desplegado.

### La base de datos no se toca

Un despliegue recrea `backend` y `frontend` y **nada más**. No recrea el volumen
de datos ni corre migraciones. Si alguna vez hace falta migrar, va en un paso
aparte y con copia previa, porque **una migración no se deshace volviendo la
imagen**: la imagen vieja contra un esquema nuevo falla igual.

### La superposición de producción

[`docker-compose.produccion.yml`](../infra/compose/docker-compose.produccion.yml)
cambia una sola cosa: de dónde salen las imágenes.

```yaml
backend:
  build: !reset null
  image: ghcr.io/.../backend:${VERSION:?falta VERSION}
```

Con eso, lo que corre en producción es **exactamente el mismo binario** que pasó
las pruebas. Construir de nuevo en la máquina puede dar algo distinto —otra
versión de base, otra caché— aunque el código sea el mismo.

---

## 6. Vuelta atrás (*rollback*)

### Automática

Si la verificación falla después de desplegar, el script vuelve solo a la
versión anterior (la que tiene anotada en `infra/despliegue/.version-desplegada`),
la verifica, y **sale con error igual aunque el sistema quede sano**: el commit
que se quiso desplegar está roto y la corrida tiene que verse en rojo.

### A mano

Cualquier versión publicada sigue existiendo en el registro con su SHA:

```bash
cd infra/compose && VERSION=<sha> docker compose -f docker-compose.yml -f docker-compose.produccion.yml --profile app up -d
```

Para ver qué versiones hay disponibles:

```bash
gh api "/users/prieto555/packages/container/tp-integrador-hia-grupo12%2Fbackend/versions" --jq '.[].metadata.container.tags'
```

### Si la vuelta atrás tampoco levanta

El script lo dice con todas las letras y termina. Es el único caso que requiere
intervención manual, y la salida tiene los últimos 80 renglones de registro de
los dos contenedores para no tener que buscarlos.

---

## 7. Secretos

| Secreto | Dónde vive | Quién lo ve |
|---|---|---|
| Credenciales del registro | `GITHUB_TOKEN`, generado por cada corrida | La corrida, mientras dura |
| Contraseñas de la base, JWT, admin | `infra/compose/.env`, en la máquina, fuera de Git | La máquina |
| Claves del `.env` de la prueba de humo | Generadas con `openssl rand` dentro del propio trabajo | Nadie: el *runner* se destruye |

Ningún secreto se imprime en el registro de la corrida. Las claves de la prueba
de humo se generan y se anexan al archivo en el mismo paso, sin pasar por
`echo`:

```bash
{ echo "DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"; ... } >> .env
```

El permiso del `entrega.yml` es `packages: write` y nada más: no puede escribir
en el repositorio, ni tocar *issues*, ni crear *releases*.

---

## 8. Cómo registrar el *runner* autoalojado

Hay que hacerlo una sola vez, en la máquina donde corre la aplicación. Necesita
permiso de administración sobre el repositorio.

```bash
gh api -X POST repos/prieto555/tp-integrador-hia-grupo12/actions/runners/registration-token --jq .token
```

Después, en la máquina:

```bash
mkdir actions-runner && cd actions-runner
# Descargar el paquete que indica Settings → Actions → Runners → New self-hosted runner
./config.sh --url https://github.com/prieto555/tp-integrador-hia-grupo12 --token <el-token> --labels restoya-produccion
./run.sh
```

> **Advertencia que corresponde hacer.** Un *runner* autoalojado ejecuta en esa
> máquina el código de cualquier *workflow* del repositorio. Como el repositorio
> es **público**, hay que tener desactivado que los *pull requests* de
> desconocidos disparen *workflows* sin aprobación
> (Settings → Actions → *Require approval for all outside collaborators*), que
> es el valor por defecto. Si no, cualquiera podría abrir un PR que corra lo que
> quiera en la máquina del equipo.

---

## 9. Limitaciones

Lo que **no** está, dicho sin maquillaje:

1. **No hay pruebas unitarias del backend.** `npm test` sigue siendo el `exit 1`
   que viene por defecto. La sección 1 explica por qué la prueba de integración
   se priorizó sobre ellas, no por qué no harían falta.
2. **Las pruebas de Angular (`ng test`) no corren en CI.** Son las que genera el
   `ng new` y no comprueban nada del negocio; hacerlas correr con
   `ChromeHeadless` agregaría minutos sin agregar información.
3. **El *runner* autoalojado hay que registrarlo a mano** (sección 8). Mientras
   no esté, los dos primeros trabajos publican las imágenes igual y el tercero
   queda en espera.
4. **La prueba de humo corre con la base vacía.** No detecta problemas que sólo
   aparecen con volumen, como el `JavaScript heap out of memory` del punto 5.
5. **El escaneo frena sólo por vulnerabilidades con parche.** Las que no lo
   tienen están listadas en `docs/09-seguridad.md` y hay que revisarlas a mano
   cada tanto.
6. **El despliegue no corre migraciones de esquema.** Es deliberado (sección 5),
   pero significa que un cambio de modelo necesita un paso manual.
