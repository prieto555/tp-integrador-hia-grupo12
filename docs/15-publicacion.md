# Publicación en Internet

Entregable del punto 15.10. Cubre el **punto 9** de la consigna: dejar la
aplicación accesible desde Internet durante la demostración final.

> **Estado, antes que nada.** La aplicación **está publicada** en
> **https://restoya.liners-panel.com** y se probó por Internet, no en local.
>
> La publicación destapó **dos problemas que en local no se veían**, y los dos
> están arreglados y medidos en la sección 6: las tres cabeceras de seguridad
> de nginx no llegaban a ninguna respuesta de HTML, y —el grave— **el backend
> veía la IP de un contenedor en vez de la del visitante**, lo que convertía el
> límite de intentos de inicio de sesión en un interruptor para dejar afuera a
> todo el mundo. La sección 7 dice lo que todavía falta.

---

## 1 · El problema, que no es el habitual

El punto 9 pide que la aplicación sea accesible desde Internet. El camino
normal sería abrir un puerto en el router y apuntarle un dominio.

**Acá eso no se puede.** El proveedor de Internet de la casa usa **CGNAT**: la
conexión no tiene IP pública propia, la comparte con otros clientes detrás de
un NAT del proveedor. No hay panel donde reenviar un puerto, porque el router
de la casa tampoco tiene la IP pública. Es la misma razón por la que en esta
red no funciona P2P y por la que el acceso remoto entre las dos máquinas va por
Radmin VPN.

Entonces la publicación tiene que ser **de adentro hacia afuera**: un proceso
local que establece la conexión saliente y por ahí recibe el tráfico. Eso es un
túnel inverso.

### Las opciones que se miraron

| Opción | Por qué sí | Por qué no |
|---|---|---|
| Reenvío de puertos | lo más simple | **imposible: CGNAT** |
| **Cloudflare Tunnel** | URL estable con dominio propio, HTTPS incluido, gratis, el conector sale hacia afuera | hace falta un dominio en la cuenta |
| Túnel rápido (`--url`) | cero configuración | la dirección `*.trycloudflare.com` **cambia en cada arranque**: no sirve para una entrega |
| Tailscale Funnel | muy simple | la URL cuelga del dominio de Tailscale, y el modelo es de red privada, no de publicación |
| ngrok | conocido | el plan gratuito también rota la URL |
| VPS con túnel SSH inverso | control total | hay que pagar y administrar un servidor más |

Se eligió **Cloudflare Tunnel con túnel con nombre**. Las dos razones de peso:
la URL no cambia, y el conector no obliga a abrir nada en el router.

---

## 2 · Token o archivo de configuración: la decisión que importa

Un túnel se puede manejar de dos formas, y la diferencia no es de comodidad:

**(a) Con un token.** `cloudflared tunnel run --token ...`. Las reglas de
encaminamiento —qué nombre público va a qué servicio interno— viven en el panel
de Cloudflare. Es más rápido de arrancar.

**(b) Con un archivo de credenciales más un archivo de configuración.** Las
reglas se versionan en el repositorio.

Se eligió **(b)**, por el mismo criterio que hizo salir `pg_hba.conf`,
`config_inc.php` y el aprovisionamiento de Grafana del volumen al repositorio:

> **Qué está publicado en Internet es una decisión de seguridad, y una decisión
> de seguridad que vive en el panel de alguien no se puede auditar ni revisar en
> un *pull request*.**

Con (a), para saber qué quedó expuesto hay que entrar al panel con la cuenta de
alguien. Con (b), está en `infra/tunel/config.plantilla.yml`, con historial de
quién lo cambió y cuándo.

---

## 3 · Qué se publica, y sobre todo qué no

> **Esto cambió el 14/11, y el cambio es la parte interesante del punto.**
> Hasta esa fecha se publicaba **una sola cosa**, la aplicación, y las nueve
> herramientas quedaban afuera con el argumento que está más abajo. Ahora se
> publican **cinco nombres**. No porque el argumento fuera malo, sino porque
> el equipo necesita entrar a n8n, a Mantis y a Nextcloud desde sus casas
> para preparar la defensa, y la alternativa —que cada uno levante el stack
> completo en su máquina— no es alternativa: son 23 contenedores y 6.000.000
> de filas.
>
> Lo que importa para la defensa no es qué se eligió, es **que el criterio
> esté escrito y que el costo esté anotado**. Las dos cosas están en esta
> sección y el costo además es el hallazgo 18 de
> [`09-seguridad.md`](09-seguridad.md).

### Los cinco nombres publicados

| Nombre público | Servicio interno | Qué es | Con qué entra |
|---|---|---|---|
| `restoya.liners-panel.com` | `frontend:80` | la aplicación (punto 7) | nada: es pública a propósito |
| `n8n.liners-panel.com` | `n8n:5678` | automatización (punto 13) | cuenta de propietario de n8n |
| `mantis.liners-panel.com` | `mantis:80` | incidencias (punto 11) | usuario de MantisBT |
| `nube.liners-panel.com` | `nextcloud:80` | gestión documental (punto 12) | usuario de Nextcloud |
| `grafana.liners-panel.com` | `grafana:3000` | monitoreo (punto 10) | usuario de Grafana |

**Un solo nivel de subdominio, y no es una preferencia de estilo.** El
certificado gratuito de Cloudflare (Universal SSL) cubre `liners-panel.com` y
`*.liners-panel.com`, pero **no** `n8n.restoya.liners-panel.com`: un segundo
nivel de subdominio no entra en ese comodín. Con dos niveles el navegador
corta por certificado inválido **antes** de que el túnel entre en juego, así
que el error no se ve en el registro de `cloudflared` y manda a buscar el
problema donde no está. `preparar-tunel.sh` avisa si algún nombre tiene más
de un nivel.

### Lo que sigue sin publicarse

| Servicio | Puerto | Por qué no |
|---|---|---|
| pgAdmin | 5050 | **entra sin ninguna credencial** y ya viene conectado a la base: publicarlo es publicar la base. Hallazgo 17 |
| Prometheus | 9090 | expone todas las métricas y los destinos, sin autenticación |
| Alertmanager | 9093 | **permite silenciar alertas**: apagar el monitoreo desde afuera, sin autenticación |
| Mailpit | 8025 | buzón sin autenticación, y tiene los correos de alta de usuarios de Mantis |
| PostgreSQL | 5433 / 5434 | la base, directamente |

**El criterio que separa las dos listas es uno solo: si el servicio pide
usuario y clave o no.** No es cuánto vale lo que hay adentro —n8n guarda las
credenciales de Mantis, de Nextcloud y de la base, y es el blanco más valioso
del sistema— es si hay *algo* entre Internet y el servicio. En los cinco de
esta lista no hay nada: el primero que llegue al nombre está adentro.

Dos merecen un renglón más:

- **Alertmanager** es el menos obvio de la lista. No sólo muestra: **deja
  crear silencios**. Alguien con acceso apaga los avisos y después hace lo que
  quiera sin que nadie se entere.
- **pgAdmin** está en modo escritorio (`SERVER_MODE: "False"`), que no es una
  configuración floja: en ese modo pgAdmin **no tiene pantalla de ingreso**, y
  encima trae la conexión a la base guardada. Es el hallazgo 17 y es la razón
  por la que no se publica aunque sería la herramienta más cómoda de tener a
  mano.

### Qué se perdió al publicar las cuatro herramientas

Antes había **dos** cosas entre cada herramienta e Internet: la credencial, y
el hecho de que el puerto sólo escuchaba en `127.0.0.1`. Ahora hay **una**.

Dicho sin vueltas: **la clave de cada herramienta pasó a ser lo único que la
separa de cualquiera que sepa el nombre**. Y los nombres no son secretos: los
certificados que emite Cloudflare se publican en los registros de
*Certificate Transparency*, que son públicos y consultables. Nadie tiene que
adivinar `n8n.liners-panel.com`; está en una lista.

Lo que corresponde hacer con eso, por orden de lo que cuesta:

1. **Claves largas y distintas en las cuatro.** Es lo único que hoy sostiene
   la publicación. Están en el `.env`, que no se versiona.
2. **Cloudflare Access** por delante de los subdominios de herramientas.
   Agrega una pantalla de ingreso por correo *antes* de que el tráfico llegue
   al túnel: la herramienta no ve ni una petición de alguien sin autorizar.
   **n8n ya la tiene** —viene del trabajo anterior de n8n y se comprobó al
   publicar: pedir la raíz redirige a `cloudflareaccess.com`—. Mantis,
   Nextcloud y Grafana **no**. Falta sumarles los tres dominios a la
   aplicación de Access que ya existe: ver el hallazgo 18.
3. **Bajar el túnel cuando no se está usando** (`--profile tunel down`), que
   es lo que hay que hacer después de la entrega mientras D-01 siga abierto.

### Lo que hubo que tocar además del túnel

Agregar una regla al *ingress* publica el puerto, pero **no** hace que la
herramienta funcione bien en su nombre nuevo. Cada una arma enlaces absolutos
y hay que decirle cuál es su nombre público, o los enlaces apuntan a
`localhost`, que del lado del visitante no existe:

| Herramienta | Qué se le dijo | Qué pasa si no |
|---|---|---|
| MantisBT | `MANTIS_URL` → `$g_path` en `config_inc.php` | los enlaces de los correos de notificación y el redirigido después de entrar van a `localhost:8089` |
| Grafana | `GF_SERVER_ROOT_URL`, `GF_SERVER_DOMAIN` | entrar termina en una redirección a `localhost:3001` |
| n8n | `WEBHOOK_URL`, `N8N_EDITOR_BASE_URL`, `N8N_PROTOCOL` | el editor muestra direcciones de *webhook* que no son alcanzables desde afuera, y el flujo F01 no se puede probar |
| Nextcloud | `trusted_domains`, `OVERWRITEHOST`, `OVERWRITEPROTOCOL` | responde **"Access through untrusted domain"** y no sirve ni la pantalla de inicio |

Las cuatro salen de las mismas variables del `.env` que usa el túnel, así que
no puede pasar que el túnel publique un nombre y la herramienta crea que se
llama otro.

**El caso de Nextcloud tiene una trampa.** La variable
`NEXTCLOUD_TRUSTED_DOMAINS` del `docker-compose.yml` la aplica la imagen
**sólo durante la instalación**; sobre una instancia ya instalada se lee y se
ignora. Como la nuestra ya estaba instalada, el nombre público hay que
escribirlo con `occ`, y queda en `config.php` adentro del volumen:

```bash
docker exec -u www-data restoya_nextcloud \
    php occ config:system:set trusted_domains 1 --value=nube.liners-panel.com
```

Eso lo hace solo el paso 6 de `preparar-tunel.sh`, y es idempotente.

### Y una que no es de configuración sino de red

El conector del túnel estaba **sólo en la red `interna`**, que es donde vive
`frontend`. Pero Mantis está en `incidencias`, Nextcloud en `documental` y n8n
en `automatizacion`: redes separadas a propósito, para que un problema en una
herramienta no alcance a las otras.

Con la regla del *ingress* puesta y sin la red, Cloudflare devuelve **502**:
el conector no llega al servicio. Así que `cloudflared` ahora está en las
cuatro redes. Vale aclararlo porque suena peor de lo que es: **estar en una
red no publica nada**. Lo que se publica es lo que está en el *ingress*, que
es el archivo que se revisa en el *pull request*. La red es condición
necesaria, no suficiente.

Y lo que hace que esta lista sea una garantía y no una intención: **el túnel no
abre puertos en el router**. El conector sale hacia Cloudflare. Lo que no está
en el archivo de configuración **no es alcanzable desde Internet**, y no hay
forma de equivocarse dejando un puerto abierto.
### La regla final, que es la que importa

```yaml
  - service: http_status:404
```

`cloudflared` no arranca sin una regla final sin `hostname`, así que es
obligatoria. Pero además hace algo: si alguien apunta otro nombre a este túnel,
o si mañana se agrega un *hostname* desde el panel por error, **lo que recibe es
un 404 y no un servicio interno**.

---

## 4 · Dónde termina el cifrado

Es la pregunta que conviene tener contestada, porque el origen es HTTP:

```
navegador ──HTTPS──▶ Cloudflare ──túnel cifrado──▶ cloudflared ──HTTP──▶ nginx
          certificado de                          (dentro de la red
          Cloudflare                               interna de Docker)
```

El único tramo en claro es el último, y está **dentro de la red de Docker de
esta máquina**. En ningún momento hay tráfico sin cifrar por Internet.

El certificado lo emite y renueva Cloudflare: no hay que administrar Let's
Encrypt ni renovaciones, que es otra ventaja real de esta opción sobre montar
nginx con TLS propio detrás de un VPS.

---

## 5 · El procedimiento

### 5.1 · Una sola vez: autorizar la cuenta

```bash
cloudflared tunnel login
```

Abre el navegador y pide elegir la zona. Deja `~/.cloudflared/cert.pem`, que es
**la llave de la cuenta**: autoriza a crear túneles y registros DNS en esa zona.
No se versiona y no se copia a ningún lado. Al contenedor no entra.

`cloudflared` ya está instalado en esta máquina, en
`C:\Program Files (x86)\cloudflared\` y en el PATH.

### 5.2 · Decir cuáles son los nombres públicos

En `infra/compose/.env`:

```
DOMINIO_PUBLICO=restoya.midominio.com
TUNEL_NOMBRE=restoya

ESQUEMA_PUBLICO=https
DOMINIO_N8N=n8n.midominio.com
DOMINIO_MANTIS=mantis.midominio.com
DOMINIO_NUBE=nube.midominio.com
DOMINIO_GRAFANA=grafana.midominio.com
```

Los cinco tienen que ser subdominios de **la zona que se autorizó en el paso
anterior**: el certificado se emite para esa zona. Y de **un solo nivel**, por
lo del comodín del certificado que está en la sección 3.

Las cuatro variables de las herramientas **no son opcionales** y el script
corta si falta alguna. Podría derivarlas de la zona
(`n8n.` + lo que quede de `DOMINIO_PUBLICO`), y a propósito no lo hace: el
`docker-compose.yml` lee **estas mismas variables** para decirle a cada
herramienta cuál es su nombre público. Si el script se las inventara, el túnel
publicaría un nombre y la herramienta armaría sus enlaces con otro — la clase
de desajuste que no se nota hasta que alguien hace clic en un enlace de un
correo de Mantis.

Si se dejan vacías, cada herramienta vuelve a su dirección local
(`localhost:8089`, `localhost:3001`…) y no hay que tocar nada más: son los
valores por omisión del `docker-compose.yml`. Un clon sin dominio funciona
exactamente como antes de este cambio.

`ESQUEMA_PUBLICO` existe por eso mismo: es el `http` / `https` con el que se
arman esos enlaces, y tiene que ser `https` cuando se publica y `http` cuando
se trabaja en local.

### 5.3 · Preparar el túnel

```bash
./infra/tunel/preparar-tunel.sh
```

Es idempotente y hace cinco cosas:

1. comprueba que exista el certificado de origen;
2. crea el túnel **sólo si no existe uno con ese nombre** —no toca ningún otro
   túnel de la cuenta, que es importante porque esta cuenta ya tiene otro
   andando para otra cosa—;
3. copia las credenciales a `infra/tunel/.credenciales.json`, que está en el
   `.gitignore`;
4. genera `config.generado.yml` desde la plantilla versionada y da de alta **un
   `CNAME` por cada uno de los cinco nombres**;
5. le escribe a Nextcloud su nombre público con `occ`, que es lo único que no se
   puede dejar en un archivo de configuración (ver la sección 3). Si Nextcloud
   no está levantado, avisa y sigue: hay que volver a correr el script después.

Y una comprobación que parece de más y no lo es: si un marcador de la
plantilla quedara sin reemplazar, el `hostname:` de esa regla quedaría **vacío**,
y en `cloudflared` una regla con `hostname` vacío **atrapa todo el tráfico**.
Sería publicar una herramienta interna en el nombre de la aplicación. El
script corta antes de escribir el archivo.

**Lo que el script no hace es levantar el túnel**, y es a propósito: publicar
algo en Internet no tiene que ser el efecto secundario de correr un script de
preparación.

Si el nombre ya apunta a otra cosa, el script **avisa y sale**; no pisa un
registro ajeno.

### 5.4 · Publicar

```bash
cd infra/compose && docker compose --profile app --profile tunel up -d
```

Los dos perfiles juntos. El servicio `cloudflared` **no** declara `depends_on`
del frontend, a propósito: Compose exige que la dependencia esté en un perfil
habilitado, y atarlos haría que `--profile tunel` solo fallara con un error
confuso. Si nginx no está arriba, Cloudflare devuelve 502 hasta que lo esté.

### 5.5 · Bajar

```bash
cd infra/compose && docker compose --profile tunel down
```

Baja el conector y la aplicación deja de ser alcanzable desde Internet al
instante. El túnel y el registro DNS siguen existiendo, listos para volver a
levantarlo.

---

## 6 · La corrida

Se corrió el 10/11 sobre la zona `liners-panel.com`, que ya estaba autorizada
en esta máquina —`~/.cloudflared/cert.pem` existía desde el 17/10 y tiene un
`zoneID` adentro—, así que el paso 5.1 no hizo falta.

### 6.1 · Lo que dejó el script

```
21:40:27 | tunel | Certificado de origen encontrado.
21:40:28 | tunel | El tunel "restoya" ya existe (id 65415256-cd3f-43a3-ac55-b68b2fec356d).
21:40:28 | tunel | Credenciales copiadas a infra/tunel/.credenciales.json (ignorado por Git).
21:40:28 | tunel | config.generado.yml escrito para restoya.liners-panel.com.
21:40:28 | tunel | Dando de alta el registro DNS de restoya.liners-panel.com.
21:40:30 | tunel | DNS listo.

21:40:30 | tunel | Preparado. El tunel NO esta levantado todavia.
```

Lo que se comprobó después, y es lo que importa de esa salida:

**El otro túnel de la cuenta sigue intacto.** Es la razón por la que el script
busca por nombre exacto en vez de asumir que hay uno solo:

```
ID                                   NAME    CREATED              CONNECTIONS
b100b189-8d63-4e68-a927-47268cd2fd89 liners  2026-10-17T23:20:05Z 1xeze01, 2xeze02, 1xeze07
65415256-cd3f-43a3-ac55-b68b2fec356d restoya 2026-11-11T00:39:26Z
```

`liners` conserva sus cuatro conexiones; `restoya` tiene cero porque todavía no
se levantó.

**El nombre resuelve a Cloudflare**, o sea que el `CNAME` quedó bien y además
está *proxied*:

```
$ nslookup restoya.liners-panel.com 1.1.1.1
Name:    restoya.liners-panel.com
Addresses:  2606:4700:3034::ac43:8b38
            2606:4700:3035::6815:4f02
            104.21.79.2
            172.67.139.56
```

Esas direcciones son de Cloudflare, no de esta casa. **La IP de la conexión
doméstica no aparece en ningún lado**, que es otra cosa que el túnel da gratis
y un reenvío de puertos no: con puerto abierto, el dominio apuntaría a la IP
real y quedaría publicada.

**La configuración generada quedó con el dominio real** y con la regla final:

```yaml
tunnel: restoya
credentials-file: /etc/cloudflared/credenciales.json
metrics: 0.0.0.0:2000
retries: 5
ingress:
  - hostname: restoya.liners-panel.com
    service: http://frontend:80
    originRequest:
      connectTimeout: 10s
      httpHostHeader: restoya.liners-panel.com
  - service: http_status:404
```

### 6.2 · Lo que la corrida encontró: el script no andaba

La primera corrida murió así:

```
21:39:24 | tunel | Certificado de origen encontrado.
21:39:25 | tunel | Creando el tunel "restoya".
No se pudo averiguar el id del tunel recien creado.
```

Creó el túnel y después **no pudo encontrarlo**, que es un síntoma raro: el
script hace la misma consulta antes y después de crear.

La causa está en una línea que parecía obvia. Para saltear los túneles
borrados, el filtro era `!x.deleted_at`. Pero
`cloudflared tunnel list --output json` **no pone `deleted_at` en `null` para
un túnel vivo**: pone la fecha cero de Go.

```json
{"id":"...","name":"liners","deleted_at":"0001-01-01T00:00:00Z","connections":[...]}
```

Esa cadena, en JavaScript, es un valor **verdadero**. Así que `!x.deleted_at`
daba `false` para **todos** los túneles, el `find` no devolvía ninguno, y el
script concluía que no existía ninguno:

- en la primera consulta eso era inofensivo —creaba el túnel, que era lo
  correcto—;
- en la segunda era fatal, porque ahí el id tenía que estar.

Y hay una consecuencia peor que el error, que es la que hace que valga contarlo:
**el script había dejado de ser idempotente sin avisar.** Si no hubiera salido
con error en la segunda consulta, cada corrida habría creado un túnel nuevo
llamado `restoya`, porque nunca encontraba el anterior.

El arreglo compara contra la fecha cero en vez de contra `null`, y de paso
unifica los dos bloques de código repetidos en una sola función
`id_de_tunel()`. La segunda corrida dijo *"El tunel \"restoya\" ya existe"*,
que es la prueba de que la idempotencia volvió.

> Es exactamente el tipo de error que la sección 8 de
> [`14-automatizacion.md`](14-automatizacion.md) describe para los flujos de
> n8n: **un valor que existe pero no es el que se cree.** Ahí fueron las
> etiquetas en inglés; acá, una fecha cero que se lee como "sí, está borrado".

### 6.3 · Lo verificado antes de la corrida

Esto ya estaba comprobado y sigue valiendo:

| Qué | Cómo se comprobó |
|---|---|
| `preparar-tunel.sh` no tiene errores de sintaxis | `bash -n infra/tunel/preparar-tunel.sh` |
| El script aborta con un mensaje claro y **sin crear nada** si falta `DOMINIO_PUBLICO` | la variable está declarada con `${...:?mensaje}` |
| El script no toca el otro túnel de la cuenta | busca por nombre exacto en `cloudflared tunnel list --output json` y crea sólo si no hay coincidencia |
| El `compose` con el perfil `tunel` es válido | `docker compose --profile tunel config` |
| El conector llega a nginx por la red interna | el servicio está en la red `interna`, la misma que `frontend` |
| **`/metrics` del backend no queda publicado** | se pidió `/metrics` por el camino de nginx y devuelve el `index.html` de la SPA, no las métricas: nginx sólo hace de *proxy* de `/api/` |
| Las credenciales y la configuración generada no entran a Git | las cuatro rutas están en el `.gitignore` |

La última fila es la que más tranquiliza: la única cosa publicada es `/`, y
`/metrics` —que es lo que un escaneo busca primero— no está detrás de una
contraseña sino **fuera del camino**.

---

### 6.4 · Publicado, y los dos problemas que la publicación destapó

El túnel se levantó junto con la aplicación:

```bash
docker compose --profile app --profile tunel up -d
```

y registró cuatro conexiones con la red de Cloudflare, dos a cada *datacenter*
de Buenos Aires (`eze02` y `eze07`), por QUIC:

```
INF Registered tunnel connection connIndex=0 ip=198.41.192.107 location=eze02 protocol=quic
INF Registered tunnel connection connIndex=1 ip=198.41.200.233 location=eze07 protocol=quic
INF Registered tunnel connection connIndex=2 ip=198.41.192.77  location=eze02 protocol=quic
INF Registered tunnel connection connIndex=3 ip=198.41.200.43  location=eze07 protocol=quic
```

Lo primero que se probó fue lo que tenía que estar y lo que **no** tenía que
estar:

| Pedido a `https://restoya.liners-panel.com` | Resultado | Qué prueba |
|---|---|---|
| `/` | **200**, 16.695 bytes, `text/html` | la aplicación se sirve |
| `/api/productos` | **200**, 1.083 bytes, `application/json` | el *proxy* de `/api/` funciona **a través del túnel**, no sólo en local |
| `/platos` | 200, 16.695 bytes, `text/html` | el ruteo de Angular anda: devuelve `index.html`, no un 404 |
| `/metrics` | 200, **16.695 bytes, `text/html`** | **no son las métricas**: es el `index.html`. Se confirmó leyendo el cuerpo, que empieza con `<!doctype html>` |
| `/api-docs` | 200, 16.695 bytes, `text/html` | tampoco es Swagger |

Las tres respuestas de 16.695 bytes son el mismo archivo. Eso es la prueba de
que `/metrics` y `/api-docs` **no están protegidos: están fuera del camino**,
que es más fuerte, porque no depende de que una contraseña siga puesta.

El certificado y el camino:

```
$ openssl x509 -noout -issuer -subject -dates
issuer=C=US, O=Let's Encrypt, CN=YE1
subject=CN=liners-panel.com
notBefore=Oct 17 20:51:48 2026 GMT
notAfter=Jan 15 20:51:47 2027 GMT
```

```
Server: cloudflare
CF-RAY: a589443e683d6d4a-EZE
```

El `CF-RAY` con sufijo `EZE` prueba que la petición pasó por el *datacenter* de
Ezeiza y no por un atajo local. Y el certificado lo emite y lo renueva
Cloudflare: no hay que administrar nada.

---

#### Problema 1: las tres cabeceras de seguridad de nginx no llegaban a ninguna parte

Al mirar las cabeceras de la respuesta apareció esto:

```
$ curl -sI https://restoya.liners-panel.com/
HTTP/1.1 200 OK
Cache-Control: no-cache
Server: cloudflare
```

Faltaban `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`, que
`nginx.conf` declara a nivel del servidor **con `always`**. Lo primero fue
descartar que las sacara Cloudflare, pidiendo directo a nginx:

```
$ curl -sI http://127.0.0.1:8080/
Cache-Control: no-cache          <- y nada mas
```

No era Cloudflare. Tampoco era sólo la página principal:

| Pedido local | Cabeceras de seguridad |
|---|---|
| `/` | **ninguna** |
| `/scripts-47AA7252.js` | **ninguna** |
| `/no-existe-nada` | **ninguna** |
| `/api/productos` | las tres… **duplicadas**, con dos `Referrer-Policy` de valor distinto |

La causa es una regla de nginx que no es intuitiva: **si un bloque `location`
tiene un `add_header` propio, no hereda ninguno de los del padre.** Los dos
bloques que ponían un `Cache-Control` —el de los archivos con *hash* y el de
`index.html`— se estaban comiendo las tres cabeceras de seguridad enteras. Y
como `location /` hace `try_files` hacia `/index.html`, hasta la página
principal caía en ese bloque.

El `always` no tiene nada que ver: eso sólo decide si la cabecera se agrega
también en las respuestas de error.

El efecto neto era **exactamente el contrario del buscado**. El comentario del
archivo decía: *"El backend ya pone las suyas con Helmet, pero los archivos
estáticos no pasan por el backend"*. Y lo que pasaba era que `/api/` —que ya
las tenía por Helmet— las recibía dos veces, y los archivos estáticos, que son
la única razón por la que esas líneas existen, no recibían ninguna.

**Arreglo:** las tres cabeceras se declaran en cada bloque que sirve contenido
y se saca del nivel del servidor, así `/api/` queda sólo con las de Helmet.
Verificado después de recargar nginx:

```
$ curl -sI https://restoya.liners-panel.com/
Cache-Control: no-cache
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN

$ curl -sI http://127.0.0.1:8080/api/productos | grep -c x-content-type-options
1
```

---

#### Problema 2: el backend veía la IP de un contenedor, no la del visitante

Éste es el que de verdad importa, y es el que estaba anotado como verificación
pendiente en la sección 7 **antes** de correrlo. Salió mal, como se temía, pero
por un motivo distinto del previsto.

La medición: se hizo un `POST /api/pedidos` por el túnel —es una de las rutas
públicas, la que usa el cliente que escanea el QR— y se leyó qué IP guardó el
middleware de auditoría.

```
$ curl -s https://cloudflare.com/cdn-cgi/trace | grep ^ip=
ip=181.177.197.253

$ select "idHistorial", ip, metodo from historial_accesos order by 1 desc limit 1
6000008 | 172.24.0.17 | AUDITORIA: POST en /api/pedidos
```

`172.24.0.17` es el contenedor de `cloudflared` dentro de la red de Docker.

**Por qué, y acá está lo que no se sabía: `cloudflared` no manda
`X-Forwarded-For`. Manda `CF-Connecting-IP`.** Entonces el
`$proxy_add_x_forwarded_for` de nginx no tenía ninguna cadena que ampliar y
quedaba con un solo elemento: la IP del propio `cloudflared`. Express, con
`trust proxy = 1`, descarta ese único salto y se queda sin nada que mirar, así
que cae en la IP del socket.

La consecuencia es peor que un dato mal registrado. **El limitador de intentos
de inicio de sesión cuenta por IP.** Con todas las peticiones de Internet
llegando con la misma IP:

> diez intentos fallidos de cualquiera dejan afuera a **todo el mundo** durante
> quince minutos.

El control que se ajustó en el punto 14 para frenar la fuerza bruta —de 100
intentos a 10— se convierte, al publicar, en una forma de **apagar el inicio de
sesión del sistema desde afuera, gratis y sin autenticarse**. Y encima el
historial de accesos deja de servir para nada: todas las filas con la misma IP.

Vale subrayar una cosa: **el punto 14 dio este control por cerrado y
verificado, y lo estaba** — en local. Lo rompió *publicar*. Es la razón por la
que el punto 9 no es "poner la aplicación en Internet" y listo.

**Arreglo**, en `frontend/nginx.conf`: un `map` que elige de dónde sale la IP.

```nginx
map $http_cf_connecting_ip $ip_del_visitante {
    ""      $proxy_add_x_forwarded_for;
    default $http_cf_connecting_ip;
}
```

y después `proxy_set_header X-Forwarded-For $ip_del_visitante;`.

Si viene `CF-Connecting-IP`, ésa es la IP del visitante. Si no viene —acceso
local, sin túnel— se usa la cadena normal de nginx, así que levantar el
proyecto sin el perfil `tunel` sigue funcionando igual. **No se tocó
`trust proxy = 1`**: sigue habiendo exactamente un salto de confianza, nginx, y
ahora lo que nginx le pasa es la IP correcta.

Es seguro confiar en esa cabecera **sólo porque a este nginx no se llega de
otra forma**: el puerto 80 no está publicado en la LAN, únicamente en
`127.0.0.1` y a través del túnel. Si algún día se publica el puerto, la
cabecera pasa a ser falsificable y hay que reemplazar el `map` por una lista de
IP de confianza de Cloudflare. Quedó escrito en el propio archivo.

**Verificación, con el antes y el después en la misma tabla** —las tres filas
son mediciones reales, no un ejemplo—:

```
 idHistorial |       ip        | metodo
-------------+-----------------+--------------------------------
     6000010 | 172.24.0.1      | AUDITORIA: POST en /api/pedidos   <- local, despues del arreglo
     6000009 | 181.177.197.253 | AUDITORIA: POST en /api/pedidos   <- por el tunel, despues
     6000008 | 172.24.0.17     | AUDITORIA: POST en /api/pedidos   <- por el tunel, ANTES
```

La fila 6000009 es la IP pública real, la misma que reporta
`cloudflare.com/cdn-cgi/trace`. La 6000010 prueba que el camino local no se
rompió: sigue registrando la puerta de enlace de Docker, igual que antes.

Los tres pedidos de prueba se borraron después de medir, y las tablas quedaron
en los 6.000.000 de filas exactos que tenían (`pedidos`, `detalle_pedidos` y
`pagos`). Las tres filas del historial se dejaron a propósito: son la medición.

> **Nota sobre el estado del contenedor.** El arreglo de `nginx.conf` se probó
> copiándolo al contenedor en marcha y recargando nginx (`nginx -s reload`), que
> es lo que permitió medir el antes y el después en la misma sesión. La imagen
> se reconstruyó después para que el cambio sobreviva a un reinicio, porque el
> `Dockerfile` copia `nginx.conf` adentro de la imagen y un `docker compose up`
> con la imagen vieja volvería al comportamiento anterior **sin avisar**.

---

## 7 · Lo que falta, con nombre y apellido

### 7.1 · Una prueba desde otra red

Todo lo de la sección 6 se midió **desde esta máquina pero por Internet**: el
pedido sale hacia Cloudflare y vuelve por el túnel, y el `CF-RAY` con sufijo
`EZE` prueba que pasó por el *datacenter* de Ezeiza. No es una prueba local.

Igual falta la prueba desde **otra red**: el celular con datos móviles, no con
el WiFi de la casa. Dos cosas que sólo esa prueba descarta:

1. que el resolutor de DNS de esta red no esté metiendo mano (este proveedor
   filtra dominios por DNS, cosa que ya pasó en este proyecto);
2. que la IP que registra el historial sea la de **otro** visitante y no la
   nuestra, que es la única forma de confirmar del todo el arreglo de la
   sección 6.4.

Es un minuto de trabajo y conviene hacerlo antes del día de la presentación,
no el mismo día.

### 7.2 · Bajar el túnel después de la entrega

**Esto no es opcional.** Está en la sección 7.3 como decisión, y acá como
tarea con fecha: el día después de la presentación,

```bash
cd infra/compose && docker compose --profile tunel down
```

La aplicación deja de ser alcanzable al instante y el túnel queda listo para
volver a levantarlo. El motivo es el hallazgo **D-01**: 19 endpoints sin
autenticación, entre ellos `DELETE /api/roles/:id`, hoy alcanzables desde
Internet.

### 7.3 · Cerrar D-01 antes de volver a publicar

Mientras D-01 esté abierto, esta aplicación **no debería estar en Internet más
que el rato de una demostración**. El arreglo está descrito en
[`01-descripcion.md`](01-descripcion.md) §5 y anotado en
[`16-limitaciones.md`](16-limitaciones.md) §8.

### 7.4 · Lo que no se va a hacer, y por qué

- **No se van a publicar Nextcloud ni Mantis**, aunque la consigna del punto 12
  hable de "centralizar la documentación". Hoy los dos van por HTTP, y
  publicarlos haría viajar sus contraseñas en claro hasta Cloudflare. Si
  hicieran falta, primero HTTPS.
- **No se va a poner autenticación de Cloudflare Access** delante de la
  aplicación. La aplicación tiene su propio inicio de sesión, y para la
  demostración la cátedra tiene que poder entrar sin que nadie le dé de alta
  una cuenta en una cuenta de Cloudflare ajena.
- **El túnel no se va a dejar levantado después de la entrega.** Es una
  aplicación con 19 endpoints sin autenticación (hallazgo **D-01** en
  [`01-descripcion.md`](01-descripcion.md)) y una base con datos de prueba. Se
  levanta para la demostración y se baja. Esto no es una limitación del túnel:
  es la consecuencia de D-01, y es exactamente la clase de decisión que un
  informe de publicación tiene que dejar escrita.

---

## Referencias

- La plantilla, con el cuadro completo: `infra/tunel/config.plantilla.yml`
- El script: `infra/tunel/preparar-tunel.sh`
- Por qué el backend no publica puerto: [`02-arquitectura.md`](02-arquitectura.md), §4.1
- El hallazgo D-01: [`01-descripcion.md`](01-descripcion.md), §5
- Lo que falta en todo el trabajo: [`16-limitaciones.md`](16-limitaciones.md)
