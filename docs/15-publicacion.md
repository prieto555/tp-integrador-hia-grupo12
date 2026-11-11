# Publicación en Internet

Entregable del punto 15.10. Cubre el **punto 9** de la consigna: dejar la
aplicación accesible desde Internet durante la demostración final.

> **Estado, antes que nada.** Toda la infraestructura está escrita, versionada
> y revisada: el servicio `cloudflared` en el *compose* (perfil `tunel`), la
> plantilla de configuración, y `infra/tunel/preparar-tunel.sh`, que crea el
> túnel y el registro DNS. **Lo que falta es un dato: el nombre de la zona** —el
> dominio que está en la cuenta de Cloudflare—, porque sin él no hay `CNAME`
> que crear. La sección 7 dice exactamente qué queda por correr y por verificar.

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

Se publica **una sola cosa**: la aplicación, a través de nginx, que sirve el
frente y hace de *proxy* de `/api/`. Con esa única regla queda publicada la
aplicación completa, porque el backend ya está detrás de nginx y no publica
puerto.

Deliberadamente **no** se publican, aunque el túnel podría hacerlo con dos
líneas cada uno:

| Servicio | Puerto | Por qué no |
|---|---|---|
| pgAdmin | 5050 | consola de la base: con eso se lee y se borra todo |
| Grafana | 3001 | interfaz administrativa, y muestra la forma interna del sistema |
| Prometheus | 9090 | expone todas las métricas y los destinos, sin autenticación |
| Alertmanager | 9093 | **permite silenciar alertas**: apagar el monitoreo desde afuera |
| MantisBT | 8089 | los problemas del sistema, con detalle de cómo explotarlos |
| Nextcloud | 8081 | la documentación interna del proyecto |
| n8n | 5678 | tiene adentro las credenciales de Mantis y de Nextcloud |
| Mailpit | 8025 | buzón sin autenticación |
| PostgreSQL | 5433 / 5434 | la base, directamente |

Dos de esos merecen un renglón más:

- **Alertmanager** es el peor de la lista y el menos obvio. No sólo muestra:
  **deja crear silencios**. Alguien con acceso apaga los avisos y después hace
  lo que quiera sin que nadie se entere.
- **n8n** es el que más credenciales tiene adentro de todo el sistema, y está
  conectado a las cuatro redes de Docker. Es el blanco más valioso que hay.

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

### 5.2 · Decir cuál es el nombre público

En `infra/compose/.env`:

```
DOMINIO_PUBLICO=restoya.midominio.com
TUNEL_NOMBRE=restoya
```

`DOMINIO_PUBLICO` tiene que ser un subdominio de **la zona que se autorizó en
el paso anterior**: el certificado se emite para esa zona.

### 5.3 · Preparar el túnel

```bash
./infra/tunel/preparar-tunel.sh
```

Es idempotente y hace cuatro cosas:

1. comprueba que exista el certificado de origen;
2. crea el túnel **sólo si no existe uno con ese nombre** —no toca ningún otro
   túnel de la cuenta, que es importante porque esta cuenta ya tiene otro
   andando para otra cosa—;
3. copia las credenciales a `infra/tunel/.credenciales.json`, que está en el
   `.gitignore`;
4. genera `config.generado.yml` desde la plantilla versionada y da de alta el
   `CNAME` que apunta el nombre al túnel.

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

## 6 · Lo que sí está verificado hoy

Sin dominio no se puede probar la publicación, pero sí se probó lo de este
lado, que es la mitad que suele fallar:

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

## 7 · Lo que falta, con nombre y apellido

### 7.1 · El dato que bloquea todo

**El nombre de la zona de Cloudflare.** Con eso se corre `tunnel login`, se
completa `DOMINIO_PUBLICO` y el procedimiento de la sección 5 se ejecuta
entero. Son unos minutos.

Si la cuenta **no tiene** ningún dominio agregado, hay dos salidas y conviene
decidirla antes de la semana de la presentación:

1. registrar un dominio barato (`.ar`, `.com.ar` o cualquiera de los que
   Cloudflare vende) y agregarlo a la cuenta;
2. usar el túnel rápido (`cloudflared tunnel --url http://localhost:8080`) y
   aceptar que la dirección cambia en cada arranque, lo que significa leer la
   URL nueva en voz alta el día de la demostración. Funciona, pero no es "una
   aplicación publicada": es una demostración con una dirección temporal, y
   conviene decirlo así y no al revés.

### 7.2 · Una verificación que hay que hacer con el túnel arriba

**Qué IP ve el backend.** `backend/index.js:18` tiene:

```js
app.set('trust proxy', 1);
```

El `1` son los saltos de confianza: exactamente nginx. **Con el túnel, los
saltos son más**: Cloudflare agrega `X-Forwarded-For` y `CF-Connecting-IP`. Si
el backend termina leyendo la IP equivocada —o peor, siempre la misma—, el
límite de diez intentos de inicio de sesión **deja de distinguir clientes** y
pasa a ser un límite global: con dos personas probando la aplicación a la vez,
una bloquea a la otra.

La comprobación es concreta y hay que hacerla el mismo día: entrar por el
dominio, fallar un inicio de sesión, y mirar qué IP quedó en
`historial_accesos`. Si no es la IP real del visitante, hay que subir el número
de saltos o leer `CF-Connecting-IP`.

Está anotado también en [`16-limitaciones.md`](16-limitaciones.md), §1.3.

### 7.3 · Lo que no se va a hacer, y por qué

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
