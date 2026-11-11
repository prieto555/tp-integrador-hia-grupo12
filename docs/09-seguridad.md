# Seguridad

Entregable del punto 15.9. Cubre el punto 14 de la consigna (épica E14 del
backlog).

Los once primeros hallazgos están verificados contra el stack corriendo: los
comandos de verificación están al final de cada sección, con su salida real.
**El hallazgo 12 es la excepción** y lo dice en su propia sección: la evidencia
es el código, no una corrida.

---

## Lo que se encontró y lo que se arregló

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | Filtro de CORS por subcadena | Alta | **Corregido** |
| 2 | Swagger abierto, y la raíz redirigía ahí | Alta | **Corregido** |
| 3 | Límite de login en 100 intentos / 15 min | Alta | **Corregido** |
| 4 | Chatbot sin autenticación ni límite, con la clave de Gemini | Alta | **Corregido** |
| 5 | El resto de la API sin ningún límite | Media | **Corregido** |
| 6 | `usuarios.email` sin `UNIQUE` en el modelo | Alta | **Corregido** |
| 7 | 16 vulnerabilidades en dependencias del backend (1 crítica) | Crítica | **8 corregidas, 7 no tienen arreglo real** |
| 8 | 48 vulnerabilidades en dependencias del frontend (4 críticas) | Crítica | **Las 6 de producción corregidas** |
| 9 | Imágenes base desactualizadas | Alta | **Corregidas hasta donde hay parche** |
| 10 | `@scarf/scarf` llama a su servidor al instalarse | Baja | Documentado, sin acción |
| 11 | El limitador guarda las cuentas en memoria | Media | Documentado, no corregido |
| 12 | 19 endpoints sin ninguna autenticación | Crítica | **Documentado, no corregido** |

---

## 1 · El filtro de CORS dejaba pasar cualquier dominio

Esta era la condición:

```js
if (!origin || permitidos.includes(origin) || origin.includes('onrender.com'))
```

Parece una lista blanca. **No lo es.** En la misma línea hay dos `includes`
distintos:

- `permitidos.includes(origin)` es `Array.prototype.includes`: compara el
  elemento **entero**. Correcto.
- `origin.includes('onrender.com')` es `String.prototype.includes`: busca una
  **subcadena**. Cualquier dominio que contenga ese texto en cualquier
  posición pasa.

Alcanza con registrar `onrender.com.sitio-falso.net`. El navegador de alguien
que entre ahí podrá hacer peticiones a la API con las credenciales de la
víctima.

**Arreglado**: lista exacta, desde `CORS_ORIGENES` en el entorno.

```
  http://localhost:8080                      Access-Control-Allow-Origin: http://localhost:8080
  http://onrender.com.sitio-falso.net        SIN cabecera CORS (rechazado)
  https://evil.example                       SIN cabecera CORS (rechazado)
```

> **Qué protege CORS y qué no.** Protege al navegador de otro sitio, no a la
> API. Quien use `curl` o Postman no manda cabecera `Origin` y no hay nada que
> comparar. Lo que protege a la API es la autenticación. Por eso las
> peticiones sin `Origin` se siguen permitiendo: bloquearlas daría una
> sensación de seguridad que no es real y rompería las pruebas.

---

## 2 · Swagger servía el índice completo del sistema

`/api-docs` estaba abierto, y la raíz `/` redirigía ahí. Entrar al servidor te
dejaba directamente en la documentación: todas las rutas, todos los
parámetros, todos los esquemas.

**Arreglado con dos cerrojos, y hacen falta los dos:**

1. **No se publica.** nginx sólo hace de *proxy* de `/api/`.
2. **No se sirve** salvo que se pida con `SWAGGER_HABILITADO=true`, y aun así
   pide usuario y contraseña (HTTP Basic, comparada en tiempo constante).

El primero depende del *proxy*. Si mañana alguien publica el puerto 3000 "para
probar", el segundo sigue en pie.

```
  /api-docs desde adentro de la red:  HTTP/1.1 404 Not Found
  /api-docs a través de nginx:        200  ← el index.html de Angular, no Swagger
```

> El 200 del segundo renglón engaña. nginx devuelve el `index.html` del SPA
> para cualquier ruta que no sea `/api/`, que es lo que hace falta para que
> recargar en `/platos` no dé 404. Swagger no está ahí: el cuerpo es
> `<!doctype html>` de la aplicación Angular.

La raíz ahora devuelve `{"servicio":"restoya-api","estado":"ok"}`.

---

## 3 · Cien intentos de login cada quince minutos

```js
max: 100, // Aumentado a 100 para permitir pruebas intensivas sin bloqueos
```

El comentario dice todo: se subió para probar y quedó así. Cien intentos cada
quince minutos por IP no es un límite, es un permiso para probar contraseñas.
Con una lista de las mil más usadas, son dos horas y media.

**Arreglado**: diez, configurable con `LIMITE_LOGIN`. Si hace falta subirlo
para probar, se sube por variable de entorno y no tocando el código, que es
como quedó en cien y nadie se acordó de bajarlo.

```
  intento 9  -> 401
  intento 10 -> 401
  intento 11 -> 429   ← el límite corta exactamente donde debe
```

---

## 4 · El chatbot gastaba la cuenta ajena

`POST /api/chatbot` **no pide autenticación**, no tenía límite, y reenvía la
consulta a la API de Gemini con la clave del proyecto:

```js
const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/...?key=${apiKey}`;
```

Cualquiera que llegue a la API puede gastar la cuota, o la plata si la cuenta
es paga. Es el endpoint más caro del sistema por petición, y era el único sin
ninguna protección.

**Arreglado**: limitador propio y mucho más apretado, diez por minuto.

```
  consulta 10 -> 500   ← llega al controlador (no hay clave de Gemini cargada)
  consulta 11 -> 429   ← cortado por el limitador
```

No se le puso autenticación porque el asistente es para clientes, que no
inician sesión. El límite es lo que corresponde.

---

## 5 · El resto de la API no tenía ningún límite

Sólo `/api/auth` tenía limitador. Todo lo demás estaba libre.

**Arreglado**: limitador general de 300 peticiones por minuto por IP delante
de todo `/api`, configurable con `LIMITE_API`. No está para frenar un ataque
grande —para eso hace falta algo delante del servidor— sino para que un script
suelto no voltee el servicio solo.

---

## 6 · Dos cuentas con el mismo correo

El modelo no declaraba `unique` y la base no tenía la restricción. La unicidad
se verificaba **sólo en la aplicación**:

```js
const existe = await Usuario.findOne({ where: { email } });
if (existe) return res.status(400)...
const nuevoUsuario = await Usuario.create({ ... });
```

Entre esas dos sentencias entra otra alta con el mismo correo. Dos cuentas
iguales rompen el inicio de sesión, porque `findOne` devuelve una sola.

El índice `usuarios_email_unico` ya se había creado en el punto 5 (después de
comprobar que no hubiera duplicados). Acá se completó: el modelo lo declara y
el controlador traduce el error de clave duplicada a un 400 claro en lugar de
un 500 genérico.

**Verificado por los dos caminos:**

```
alta con correo repetido, por la aplicación:
  {"status":"0","msg":"Ya existe el email."}   (http=400)

la misma alta, saltando la aplicación y escribiendo en la base:
  ERROR: duplicate key value violates unique constraint "usuarios_email_unico"
```

El segundo es el que importa: es el que sigue valiendo cuando la carrera
ocurre de verdad.

---

## 7, 8 y 9 · Escaneo de vulnerabilidades (E14-05 y E14-06)

Dos herramientas, porque miran cosas distintas:

- **`npm audit`** mira las dependencias de JavaScript.
- **Trivy** mira el sistema operativo de cada imagen.

Se eligió Trivy y no Docker Scout porque Scout **exige iniciar sesión en
Docker Hub**, y no corresponde usar la cuenta personal de nadie para una
herramienta del trabajo. Trivy corre en un contenedor y no pide cuenta.

### Dependencias del backend

| | Críticas | Altas | Moderadas | Total |
|---|---:|---:|---:|---:|
| Antes | 1 | 6 | 9 | 16 |
| **Después** | **0** | **0** | 7 | **7** |

La crítica era **`proxy-addr`: suplantación de IP a través de subredes de
confianza IPv4 mapeadas en IPv6**. Importa especialmente acá, porque en el
punto 5 se activó `trust proxy` para que nginx pudiera identificar al cliente.
Con esa biblioteca vulnerable, un cliente podía falsificar `X-Forwarded-For` y
**esquivar el limitador de intentos de login** — justo el que se acaba de
ajustar. Las dos cosas sueltas no significan nada; juntas son un camino de
ataque completo.

Las siete que quedan son todas moderadas, y para seis de ellas npm propone
como "arreglo" **bajar a una versión mayor anterior**: `sequelize` 6.37 → 3.30,
`exceljs` → 3.4, `swagger-jsdoc` → 6.2.8. Eso no es un arreglo, es el
resolvedor de npm siendo literal: romper la aplicación entera para cerrar un
aviso moderado no es una mejora de seguridad.

La única que sí era un salto hacia adelante, `nodemailer` 9 → 10, **sí se
hizo**: doce problemas de análisis de direcciones y denegación de servicio, y
el uso en el código es `createTransport` y `sendMail`, que no cambian entre
esas versiones.

### Dependencias del frontend

| | Críticas | Altas | Total |
|---|---:|---:|---:|
| Antes, todas | 4 | 18 | 48 |
| Antes, **sólo producción** | 0 | 4 | 6 |
| **Después, sólo producción** | **0** | **0** | **0** |
| Después, todas | 0 | 0 | 16 |

Hay que separar las dos cosas, porque no corren en el mismo lugar:

- **Las de producción** terminan dentro del paquete que se le manda al
  navegador. Eran seis, de Angular 21.2.17: **XSS por atributos manejadores de
  eventos en i18n** y **bypass del saneamiento por enlaces de host en
  directivas**. En una aplicación que cobra, un XSS es grave. Se subió a
  **21.2.26** y quedaron en cero. Las otras cuatro eran de renderizado del
  lado del servidor, que esta aplicación no usa — dicho para no inflar la
  cuenta.
- **Las de desarrollo** no viajan al navegador: la imagen final es nginx con
  los archivos estáticos, sin `node_modules`. Pero sí corren **en la máquina
  que compila**, y una de ellas era `piscina`: contaminación de prototipo que
  permite ejecución de código. Una herramienta de compilación comprometida
  puede inyectar lo que quiera en el paquete que después se despliega. Es la
  amenaza de cadena de suministro de la matriz, y por eso se subió
  `@angular/build` a 21.2.29.

Las dieciséis que quedan son moderadas y de herramientas de compilación.

### Imágenes

| Imagen | Antes | Después |
|---|---|---|
| `restoya-backend` | 1 crítica, 33 altas | **0 críticas, 6 altas** |
| `restoya-frontend` | 3 críticas, 64 altas | **1 crítica, 54 altas** |
| `postgres:16-alpine` | 1 crítica, 28 altas | 1 crítica, 25 altas |

**Un hallazgo que conviene entender**: `restoya-frontend` y `nginx:1.27-alpine`
daban exactamente el mismo número, 3 críticas y 64 altas. Ninguna venía del
código de este proyecto: **todas eran del sistema operativo de la imagen
base** (brotli, curl, c-ares). La superficie de ataque de un contenedor es en
buena medida su imagen base, y la forma de reducirla es actualizarla, no tocar
el código.

Se subió `nginx:1.27-alpine` → `1.29-alpine` y se volvieron a bajar
`node:24-alpine` y `postgres:16-alpine`.

**Lo que queda no tiene arreglo disponible todavía:**

- frontend: `brotli-libs 1.2.0-r0`, CVE-2026-111497. El parche existe
  (`1.2.1-r0`) pero la imagen de nginx todavía no lo trae.
- postgres: la biblioteca estándar de Go con la que está compilado,
  CVE-2025-68121.

En los dos casos la acción es la misma: volver a bajar la imagen cuando el de
arriba publique. No hay nada que podamos hacer desde acá, y decir lo contrario
sería inventar.

---

## 10 y 11 · Dos cosas anotadas sin corregir

**`@scarf/scarf`** entra de arrastre por `swagger-ui-express` y avisa a su
servidor cuando se instala. npm bloqueó su script de instalación por su cuenta.
No es grave, pero es una dependencia que habla con afuera sin que nadie se lo
haya pedido. Se saca sacando Swagger, que no vale la pena.

**El limitador guarda las cuentas en memoria del proceso.** Dos consecuencias:

1. reiniciar el backend borra el contador (se comprobó sin querer durante
   estas pruebas: después de agotar los diez intentos, un reinicio dejó entrar
   de nuevo);
2. con más de una réplica del backend, el límite efectivo es N veces el
   configurado, porque cada una cuenta por su lado.

El arreglo es un almacén compartido, normalmente Redis. Es un servicio más en
el *compose* y queda anotado como tarea, no hecho.

---

## 12 · Diecinueve endpoints sin ninguna autenticación

Apareció escribiendo el diagnóstico del punto 1, después de cerrados los nueve
primeros hallazgos de este informe, y es más grave que varios de ellos. Cinco
archivos de rutas **no importan el middleware de autenticación, ni una sola
vez**:

| Archivo | Endpoints | Lo peor que hay ahí |
|---|---|---|
| `backend/src/routes/pago.route.js:5-9` | 5 | `POST /` registra un pago; `DELETE /:id` lo borra |
| `backend/src/routes/rol.route.js:7-11` | 5 | `DELETE /:id` borra un rol |
| `backend/src/routes/funcion.route.js:7-11` | 5 | `PUT /:id` reescribe un permiso del sistema |
| `backend/src/routes/cocina.route.js:6-9` | 2 | `PATCH /estado/:idPedido` cambia el estado de cualquier pedido |
| `backend/src/routes/reporte.route.js:5-6` | 2 | el PDF y el Excel del cierre de caja |

No es un criterio de diseño: `caja.route.js` —el mismo dominio, la misma
plata— **sí** tiene `router.use(verificarToken)` y
`router.use(verificarRol('Cajero', 'Gerente'))` en sus líneas 7 y 8. Son cinco
archivos que quedaron afuera.

La combinación peor es `DELETE /api/roles/:id` con el `ON DELETE CASCADE` de
`usuario_roles`: borrar el rol Gerente sin autenticarse deja el sistema **sin
nadie que pueda administrarlo**, y la cuenta de administrador sigue existiendo
pero sin rol.

Vale aclarar qué lo contiene hoy y qué no:

- **Lo contiene** que el backend no publique puerto: desde afuera sólo se llega
  por nginx, que reenvía `/api/`. Lo cual no ayuda nada acá, porque estas rutas
  están justamente bajo `/api/`.
- **No lo contiene** el *guard* de Angular. Es comodidad de interfaz, no
  autorización: `curl` no pasa por Angular.
- **Lo contiene a medias** el limitador general de 300 peticiones por minuto.
  Frena el abuso masivo, no la petición única que borra un rol.

> **Por qué queda documentado y no corregido.** Agregar `verificarToken` es una
> línea por archivo, pero cambia el comportamiento de pantallas que hoy
> funcionan sin mandar *token* —cocina llama a `/api/cocina` y la caja a
> `/api/reportes`— y habría que verificar cada una. Sin pruebas automatizadas y
> con la entrega encima, eso es cómo se rompe una demostración. El arreglo está
> anotado con su alcance en [`16-limitaciones.md`](16-limitaciones.md), §8.

**Verificación pendiente.** A diferencia de los once hallazgos anteriores, éste
**no está comprobado contra el stack corriendo**: el `curl` sin token quedó sin
correr porque el motor de Docker no estaba levantado. La evidencia de hoy es el
código, en los archivos y líneas de la tabla.

---

## Matriz de amenazas (E14-04)

Las cinco familias que pide la consigna, con lo que hay hoy y lo que falta. La
columna que importa es la última.

### Ransomware

| | |
|---|---|
| **Qué pasaría** | Se cifran los datos de PostgreSQL y las copias, y piden rescate |
| **Puerta de entrada** | La máquina que corre Docker, no la aplicación |
| **Qué hay** | Copias automáticas cada hora, verificadas con `pg_restore -l`, rotando siete; restauración probada de punta a punta en 75 s con los conteos exactos |
| **Qué falta** | **Las copias están en la misma máquina.** Un cifrado del disco se las lleva junto con la base. Falta una copia fuera: Nextcloud es el punto 12 |

### Denegación de servicio

| | |
|---|---|
| **Qué pasaría** | La aplicación deja de responder |
| **Puerta de entrada** | Peticiones masivas, o una sola petición cara |
| **Qué hay** | Límite general de 300/min, login 10/15min, chatbot 10/min; topes de filas en los listados; *healthcheck* y `restart: unless-stopped`; alertas de monitoreo |
| **Qué falta** | Nada delante del servidor que absorba volumen. **Y un recordatorio del punto 5: una sola petición a `/api/pedidos/cocina` tumbaba el proceso entero** — no hacía falta volumen, hacía falta una consulta sin `LIMIT` |

### Robo de credenciales

| | |
|---|---|
| **Qué pasaría** | Alguien entra como gerente y ve o cambia todo |
| **Puerta de entrada** | Prueba de contraseñas, secretos en el repositorio, o la documentación abierta |
| **Qué hay** | Contraseñas con `bcrypt`; JWT; límite de intentos en 10; `.env` fuera del repositorio y `.env.example` con valores de mentira; Swagger cerrado; ningún puerto en `0.0.0.0` |
| **Qué falta** | **No hay segundo factor.** No hay caducidad forzada del token ni lista de revocación: un JWT robado vale hasta que expira. No hay política de contraseñas |

### Inyección

| | |
|---|---|
| **Qué pasaría** | Lectura o borrado de datos por una consulta armada desde la entrada |
| **Puerta de entrada** | Cualquier campo que llegue del cliente |
| **Qué hay** | Sequelize parametriza; `express-validator` en las rutas de alta; Angular escapa por defecto; `helmet` pone las cabeceras; **Angular subido a 21.2.26 por dos problemas de XSS reales** |
| **Qué falta** | Revisar que no quede ningún `sequelize.query` con interpolación. Las consultas agregadas en el punto 10 usan `replacements`, que es lo correcto |

### Cadena de suministro

| | |
|---|---|
| **Qué pasaría** | Una dependencia comprometida ejecuta código en la máquina que compila, o inyecta algo en el paquete que se despliega |
| **Puerta de entrada** | `npm install`, o una imagen base |
| **Qué hay** | `package-lock.json` versionado y `npm ci` en la imagen; **versiones fijas en todas las imágenes**, ninguna `:latest`; scripts de instalación bloqueados por npm; escaneo con `npm audit` y Trivy, con los resultados de arriba |
| **Qué falta** | El escaneo no corre solo: hay que acordarse. Debería ser un paso del *pipeline*, que es el punto 8. Tampoco hay firma ni verificación de procedencia de las imágenes |

---

## Procedimiento de respuesta ante incidentes (E14-07)

Escrito corto a propósito. Un procedimiento que no se puede seguir con el
sistema caído y a las once de la noche no sirve.

### 0. Antes de tocar nada

**Anotar la hora y sacar los registros**, que es lo primero que se pierde:

```bash
cd infra/compose
docker compose --profile app --profile monitoreo logs --no-color --timestamps > incidente-$(date +%Y%m%d-%H%M).log
```

Y mirar qué dice el monitoreo: `http://127.0.0.1:3001`, qué alertas hay
activas y desde cuándo. El tablero contesta en treinta segundos preguntas que
adivinando llevan una hora.

### 1. Contener

| Síntoma | Qué hacer primero |
|---|---|
| Datos cifrados o alterados | **Parar todo** (`docker compose stop`). No restaurar encima todavía |
| Alguien entró con credenciales ajenas | Cambiar `JWT_SECRET` (invalida todas las sesiones) y las contraseñas del `.env` |
| La API no responde | Mirar si es el límite, el montículo de Node o la base, en ese orden |
| Un secreto se subió al repositorio | Darlo por comprometido y **rotarlo**. Borrar el *commit* no alcanza: ya quedó en el historial de quien lo clonó |

### 2. Entender antes de restaurar

Restaurar una copia antes de saber cuándo empezó el problema restaura también
el problema. Los registros del paso 0 dicen desde cuándo.

### 3. Restaurar

```bash
ls -lh infra/compose/backups/           # qué copias hay
cat infra/compose/backups/backups.log   # cuáles se verificaron bien
pg_restore -l <copia>                   # verificar antes de restaurar
```

La restauración completa tardó **75 segundos** y los conteos coincidieron
exactos con el origen. Está medido, no estimado
(ver [06-carga-datos.md](06-carga-datos.md)).

### 4. Cerrar

Abrir la incidencia en Mantis (punto 11) con: qué pasó, desde cuándo, cómo se
detectó, qué se hizo y **qué se cambia para que no vuelva a pasar**. Sin ese
último punto el ciclo no se cierra, sólo se repite.

---

## Lo que falta y lo que no se pudo comprobar

- **Nada de esto se probó con un atacante de verdad.** Se verificó que los
  controles hacen lo que dicen, no que resistan a alguien que quiera pasarlos.
  No hubo prueba de penetración.
- **No hay segundo factor ni revocación de tokens.** Es el hueco más grande
  que queda.
- **Las copias siguen en la misma máquina.** Mitiga fallas, no ransomware.
- **El escaneo no está en el *pipeline*.** Hoy hay que acordarse de correrlo.
  Es trabajo del punto 8.
- **El limitador no comparte estado entre réplicas.** Ver el punto 11 de la
  lista de arriba.
- **Las imágenes no se firman ni se verifica su procedencia.**
- **Los secretos están en `.env`, en claro.** Fuera del repositorio, pero en
  claro. Un gestor de secretos es lo que corresponde y excede el trabajo.
