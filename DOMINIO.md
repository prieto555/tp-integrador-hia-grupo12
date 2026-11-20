# Cómo poner el sistema en un dominio propio

Guía para el **punto 9** de la consigna: *publicación y acceso desde Internet*.
Es el entregable 10 de la lista del punto 15 (*procedimiento de publicación en
Internet*), y el informe terminado está en
[`docs/15-publicacion.md`](docs/15-publicacion.md).

Esta guía es el paso a paso para **hacerlo**. El informe es el **por qué** de
cada decisión, y es lo que hay que poder explicar.

> **Si el grupo ya tiene el dominio** (hoy es `liners-panel.com`), saltate el
> paso 1 y pedí que te agreguen a la cuenta de Cloudflare, o que te pasen el
> certificado de origen. Los pasos 2 a 6 los corrés igual.

---

## Lo que pide el punto, en una frase

Que la aplicación se pueda abrir **desde Internet**, con **HTTPS**, en una
dirección **estable**, y que el procedimiento esté documentado.

Tres palabras que importan:

- **Desde Internet** no es `localhost` ni la IP de la red de casa. Se prueba
  desde afuera: el celular con **datos móviles**, no con el WiFi.
- **Estable** quiere decir que la dirección no cambia entre un arranque y el
  siguiente. Esto descarta los túneles rápidos (`cloudflared --url`, ngrok
  gratis): dan una dirección al azar que se pierde al reiniciar, y una entrega
  no se puede defender con una dirección que ya no existe.
- **HTTPS** sin excusas. Con Cloudflare el certificado viene incluido y no hay
  que pelearse con Let's Encrypt.

---

## Paso 1 · Conseguir el dominio

Hace falta un dominio propio porque el túnel con nombre de Cloudflare
**exige** una zona en la cuenta: el certificado que se usa para crear el túnel
se emite para esa zona.

Tres caminos, de menos a más trabajo:

**Comprar uno barato.** Es lo más rápido. Un `.xyz`, `.site` o `.online` sale
muy poco el primer año (del orden de uno a tres dólares en Porkbun, Namecheap
o Cloudflare Registrar — **verificá el precio del momento**, y mirá también el
de la renovación, que suele ser bastante más alto que el del primer año). Un
`.com` está más cerca de los diez a quince dólares al año. Para el TP sirve
cualquiera: el nombre no se califica.

**Un `.com.ar` en NIC Argentina** (`nic.ar`). Es barato y es el camino
"formal", pero necesitás CUIT/CUIL y la gestión tarda. Si no lo tenés ya, no
es el camino para esta semana.

**El dominio del grupo.** Si el equipo ya tiene uno en Cloudflare, lo más
sensato es usar un subdominio de ese (`restoya.eldominio.com`) y no comprar
nada. Es lo que se hizo acá.

> **Lo que NO sirve:** los servicios de DNS dinámico gratuitos (DuckDNS,
> No-IP) **no** te dan una zona que puedas poner en Cloudflare, así que no
> sirven para el túnel con nombre. Y `.tk`, `.ml` y compañía (Freenom) ya no
> existen como opción gratuita.

---

## Paso 2 · Pasar el dominio a Cloudflare

Cloudflare tiene que ser el que responde el DNS del dominio. Si lo compraste en
**Cloudflare Registrar**, ya está hecho y pasás al paso 3.

Si lo compraste en otro lado:

1. En Cloudflare: *Add a site*, escribís el dominio, plan **Free**.
2. Cloudflare te da **dos servidores de nombres** (algo como
   `xxx.ns.cloudflare.com`).
3. En el panel del registrador donde lo compraste, reemplazás los servidores de
   nombres por esos dos.
4. Esperás. Tarda entre unos minutos y unas horas; Cloudflare te avisa por
   correo cuando la zona está activa.

**No sigas hasta que la zona diga `Active`**, porque el paso 3 falla y el error
no dice que el problema es éste.

---

## Paso 3 · Autorizar la máquina

Una sola vez por máquina:

```bash
cloudflared tunnel login
```

Abre el navegador, elegís el dominio, y deja un certificado en
`~/.cloudflared/cert.pem`. **Ese archivo es la llave de la cuenta**: no se
copia a ningún lado, no se versiona, no se manda por WhatsApp.

Si `cloudflared` no está instalado, en Windows:

```bash
winget install Cloudflare.cloudflared
```

---

## Paso 4 · Decirle al proyecto cuáles son los nombres

En `infra/compose/.env` (que **no** se versiona; se arma copiando
`infra/compose/.env.example`):

```
DOMINIO_PUBLICO=restoya.midominio.com
TUNEL_NOMBRE=restoya

ESQUEMA_PUBLICO=https
DOMINIO_N8N=n8n.midominio.com
DOMINIO_MANTIS=mantis.midominio.com
DOMINIO_NUBE=nube.midominio.com
DOMINIO_GRAFANA=grafana.midominio.com
```

Qué es cada cosa:

- **`DOMINIO_PUBLICO`** es el nombre de la aplicación: el frente de RestoYa con
  su `/api/`. Es el único que tiene que ser público de verdad.
- Los otros cuatro son las herramientas, cada una en su propio nombre.
- **`ESQUEMA_PUBLICO`** es `https` cuando se publica y `http` cuando se trabaja
  en local. No es decorativo: con él cada herramienta arma sus enlaces
  absolutos.

**Un solo nivel de subdominio.** `n8n.midominio.com` sí;
`n8n.restoya.midominio.com` **no**. El certificado gratuito de Cloudflare cubre
`midominio.com` y `*.midominio.com`, pero no un segundo nivel: con dos niveles
el navegador corta por certificado inválido **antes** de llegar al túnel, así
que el error no aparece en el registro de `cloudflared` y te manda a buscar el
problema donde no está. El script avisa si te pasa.

**Si sólo querés publicar la aplicación** y no las herramientas, dejá las
cuatro variables `DOMINIO_*` vacías y borrá sus reglas de
`infra/tunel/config.plantilla.yml`. Cada herramienta vuelve a su dirección
local y no hay que tocar nada más.

---

## Paso 5 · Preparar el túnel

```bash
./infra/tunel/preparar-tunel.sh
```

Es idempotente: si ya existe un túnel con ese nombre, no crea otro, y **no
toca ningún otro túnel de la cuenta**.

Hace cinco cosas, y conviene saber cuáles porque si algo falla el mensaje dice
en qué paso:

1. comprueba que exista el certificado del paso 3;
2. crea el túnel si no existe;
3. copia las credenciales del túnel a `infra/tunel/.credenciales.json`
   (ignorado por Git: es un secreto);
4. genera `infra/tunel/config.generado.yml` desde la plantilla versionada, y da
   de alta un `CNAME` por cada nombre;
5. le escribe a Nextcloud cuál es su nombre público (ver el paso 7).

**Lo que el script no hace es levantar el túnel.** Es a propósito: publicar algo
en Internet no tiene que ser el efecto secundario de correr un script de
preparación.

Si un nombre ya apunta a otra cosa, el script **avisa y sale** en vez de pisar
un registro ajeno.

---

## Paso 6 · Publicar

```bash
cd infra/compose && docker compose --profile app --profile tunel up -d
```

El perfil `app` tiene que estar: el túnel sin nginx arriba devuelve 502.

Para bajarlo:

```bash
cd infra/compose && docker compose --profile tunel down
```

---

## Paso 7 · Comprobar que de verdad se llega de afuera

```bash
curl -sI https://restoya.midominio.com/ | grep -iE "^(cf-ray|server)"
```

Tenés que ver una cabecera **`CF-RAY`**. Es la prueba de que la respuesta pasó
por Cloudflare y no por un atajo local; el sufijo es el datacenter que la
atendió (`-EZE` es Ezeiza).

```bash
curl -s https://restoya.midominio.com/ | wc -c
```

Tiene que devolver el tamaño del `index.html`, no 0 y no un puñado de bytes.

**Y la prueba que no se puede saltear: abrirlo desde el celular con datos
móviles**, con el WiFi apagado. Es la única que descarta que estés viendo algo
que sólo funciona desde tu propia red. Captura de pantalla, que va al informe.

### Las dos trampas que ya nos pasaron

**Nextcloud responde `Access through untrusted domain`.** Rechaza cualquier
nombre que no esté en su lista de dominios de confianza. La variable del
`docker-compose.yml` sólo la aplica **al instalar**, así que sobre una
instancia ya instalada hay que escribirlo con `occ`:

```bash
docker exec -u www-data restoya_nextcloud \
    php occ config:system:set trusted_domains 1 --value=nube.midominio.com
```

Eso lo hace el paso 5 del script, pero sólo si Nextcloud está levantado. Si lo
levantás después, volvé a correr el script.

**Entrás a Grafana o a Mantis y te rebota a `localhost`.** Las herramientas
arman enlaces absolutos (el redirigido después de entrar, los de los correos de
notificación) y hay que decirles cuál es su nombre público. Ya está resuelto con
las variables del paso 4: si te pasa, es que alguna quedó vacía.

---

## Lo que hay que escribir en el informe

El punto no se cierra con el sistema andando: pide el **procedimiento**. Las
cuatro cosas que tiene que contestar, que son las mismas de todos los informes
de este repositorio:

**Qué se configuró y con qué valores.** El túnel, los nombres, las reglas del
*ingress*. Está en `infra/tunel/config.plantilla.yml`, que es un archivo
versionado precisamente para eso.

**Por qué eso y no otra cosa.** Y acá está lo que de verdad se califica:

- **Por qué un túnel y no abrir un puerto en el router.** Porque el proveedor
  de Internet de la casa usa **CGNAT**: la conexión no tiene IP pública propia,
  la comparte con otros clientes detrás de un NAT del proveedor. No hay panel
  donde reenviar un puerto, porque el router tampoco tiene la IP pública. El
  túnel no es una comodidad, es el único camino. *(Si en tu casa no hay CGNAT,
  decilo: el reenvío de puertos sería posible y entonces tenés que justificar
  por qué elegiste el túnel de todos modos — y hay un buen argumento: no abre
  nada en el router.)*
- **Por qué un túnel con nombre y no el rápido.** Porque el rápido cambia la
  dirección en cada arranque.
- **Por qué el archivo de configuración y no un token.** Con token, las reglas
  de qué está publicado viven en el panel de Cloudflare: nadie más puede
  reproducir la instalación y nadie puede revisar en un *pull request* qué
  quedó expuesto. **Qué está publicado en Internet es una decisión de
  seguridad, y una decisión de seguridad que vive en el panel de alguien no se
  puede auditar.**

**Cómo se comprobó.** El `CF-RAY`, el tamaño de la respuesta, y la captura
desde datos móviles.

**Qué NO resuelve.** Que es la parte que distingue un informe de un folleto:

- Lo publicado sigue dependiendo de que **la máquina de casa esté prendida**.
  No hay alta disponibilidad: si se cae Docker, se cae el sitio.
- Cloudflare ve el tráfico **en claro**, porque el certificado es suyo. Para un
  TP está bien; para datos reales de personas, hay que decirlo.
- El plan gratuito **corta las subidas en 100 MB**, lo que importa para
  Nextcloud.
- Publicar las herramientas tiene un costo y está anotado: **hallazgo 18** de
  [`docs/09-seguridad.md`](docs/09-seguridad.md).

---

## Lo que no hay que hacer

**No publiques pgAdmin.** Está en modo escritorio (`SERVER_MODE: "False"`), que
significa que **no tiene pantalla de ingreso**, y encima trae la conexión a la
base guardada. Publicarlo es publicar la base entera. Es el hallazgo 17.

**Tampoco Prometheus, Alertmanager, Mailpit ni PostgreSQL.** Ninguno pide
credencial. Alertmanager es el menos obvio y el peor: no sólo muestra, **deja
silenciar alertas**, o sea apagar el monitoreo desde afuera.

**No borres la última regla del `ingress`:**

```yaml
  - service: http_status:404
```

`cloudflared` no arranca sin una regla final sin `hostname`, pero además es la
que importa: cualquier nombre que no esté en la lista recibe un 404 y no un
servicio interno.

**Ponele Cloudflare Access a las herramientas.** Es una pantalla de ingreso por
correo que corta **antes** del túnel: la herramienta no ve ni una petición de
alguien que no esté en la lista. **n8n ya la tiene** —viene del trabajo anterior
de n8n; pedirle la raíz redirige a `cloudflareaccess.com`— y Mantis, Nextcloud y
Grafana **no**. Se agregan sumando los tres dominios a la aplicación que ya
existe, en *Zero Trust → Access → Applications*. Es gratis hasta cincuenta
usuarios.

**Bajá el túnel cuando no lo estés usando.** Mientras **D-01** siga abierto
—diecinueve endpoints de la API sin autenticación, hallazgo 12— el sistema
publicado tiene una puerta abierta conocida. Está sin corregir a propósito y
documentado, pero eso no es razón para dejarlo publicado de noche.

---

## Para leer antes de defenderlo

| Archivo | Qué te da |
|---|---|
| [`docs/15-publicacion.md`](docs/15-publicacion.md) | El informe completo: las opciones que se descartaron, dónde termina el cifrado, y los dos problemas que la publicación destapó |
| [`infra/tunel/config.plantilla.yml`](infra/tunel/config.plantilla.yml) | La lista exacta de qué está publicado y qué no, con el motivo al lado |
| [`docs/09-seguridad.md`](docs/09-seguridad.md) | Hallazgos 13, 14 y 18: los tres salieron de publicar |
| [`PROBAR.md`](PROBAR.md) | El punto 9 con los comandos y lo que tienen que devolver |
