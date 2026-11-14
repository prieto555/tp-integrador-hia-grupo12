#!/usr/bin/env bash
# Prepara el túnel de Cloudflare para el punto 9.
#
#   ./infra/tunel/preparar-tunel.sh
#
# Es idempotente: si el túnel ya existe, no crea otro.
#
# Qué hace:
#   1. Comprueba que haya un certificado de origen (el que deja
#      `cloudflared tunnel login`).
#   2. Crea el túnel si no existe, y deja su archivo de credenciales en
#      infra/tunel/.credenciales.json (ignorado por Git: es un secreto).
#   3. Genera config.generado.yml a partir de la plantilla versionada.
#   4. Da de alta los registros DNS que apuntan los cinco nombres públicos
#      al túnel.
#   5. Le dice a Nextcloud cuál es su nombre público, que es lo único que no
#      se puede dejar en un archivo de configuración.
#
# Lo que NO hace: levantar el túnel. Eso es `docker compose --profile tunel
# up -d`, y es un paso aparte a propósito: publicar algo en Internet no tiene
# que ser un efecto secundario de correr un script de preparación.

set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
ENV="$RAIZ/infra/compose/.env"
PLANTILLA="$AQUI/config.plantilla.yml"
GENERADO="$AQUI/config.generado.yml"
CREDENCIALES="$AQUI/.credenciales.json"

[ -f "$ENV" ] || { echo "Falta $ENV" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV"; set +a

TUNEL="${TUNEL_NOMBRE:-restoya}"
DOMINIO="${DOMINIO_PUBLICO:?falta DOMINIO_PUBLICO en el .env (el nombre publico de la aplicacion, por ejemplo restoya.midominio.com)}"

# Los nombres de las herramientas. Se exigen en vez de derivarlos de la zona
# a proposito: el docker-compose.yml lee estas MISMAS variables del .env para
# decirle a cada herramienta cual es su nombre publico. Si el script se los
# inventara, el tunel publicaria un nombre y la herramienta armaria sus
# enlaces con otro, que es la clase de desajuste que no se ve hasta que
# alguien hace clic en un enlace de un correo de Mantis.
AYUDA="en el .env. Copia el bloque del final de .env.example y cambia el dominio."
DOMINIO_N8N="${DOMINIO_N8N:?falta DOMINIO_N8N $AYUDA}"
DOMINIO_MANTIS="${DOMINIO_MANTIS:?falta DOMINIO_MANTIS $AYUDA}"
DOMINIO_NUBE="${DOMINIO_NUBE:?falta DOMINIO_NUBE $AYUDA}"
DOMINIO_GRAFANA="${DOMINIO_GRAFANA:?falta DOMINIO_GRAFANA $AYUDA}"

# Un solo nivel de subdominio. El certificado gratuito de Cloudflare cubre
# dominio.com y *.dominio.com, pero no algo.otracosa.dominio.com: con dos
# niveles el navegador corta por certificado invalido y el tunel ni se entera.
for N in "$DOMINIO" "$DOMINIO_N8N" "$DOMINIO_MANTIS" "$DOMINIO_NUBE" "$DOMINIO_GRAFANA"; do
    ETIQUETAS=$(echo "$N" | awk -F. "{print NF}")
    if [ "$ETIQUETAS" -gt 3 ]; then
        echo "ADVERTENCIA: $N tiene mas de un nivel de subdominio." >&2
        echo "El certificado gratuito de Cloudflare no lo cubre y el navegador" >&2
        echo "va a cortar por certificado invalido. Usa un solo nivel." >&2
    fi
done

registro() { echo "$(date '+%H:%M:%S') | tunel | $*"; }

command -v cloudflared > /dev/null 2>&1 || {
    echo "Falta cloudflared. En Windows: winget install Cloudflare.cloudflared" >&2
    exit 1
}

# -----------------------------------------------------------------------------
# 1. El certificado de origen.
#
# Lo deja `cloudflared tunnel login` en ~/.cloudflared/cert.pem, y es lo que
# autoriza a crear tuneles y registros DNS en la zona. No se versiona y no se
# copia a ningun lado: es la llave de la cuenta.
# -----------------------------------------------------------------------------
CERT="${HOME:-$USERPROFILE}/.cloudflared/cert.pem"
if [ ! -s "$CERT" ]; then
    echo "No hay certificado en $CERT." >&2
    echo "Corre primero:  cloudflared tunnel login" >&2
    echo "Abre el navegador y hay que autorizar el dominio." >&2
    exit 1
fi
registro "Certificado de origen encontrado."

# -----------------------------------------------------------------------------
# 2. El tunel.
#
# OJO: NO se toca ningun otro tunel de la cuenta. Si hay uno andando para otra
# cosa, sigue andando: este script solo mira si existe uno con ESTE nombre.
# -----------------------------------------------------------------------------
# OJO con el filtro de borrados, que costo una corrida fallada:
# "cloudflared tunnel list --output json" NO pone deleted_at en null para un
# tunel vivo. Pone la fecha cero de Go:
#
#     "deleted_at": "0001-01-01T00:00:00Z"
#
# Eso, como cadena, es un valor VERDADERO en JavaScript. Con un `!x.deleted_at`
# ningun tunel pasaba el filtro: el script no encontraba el que acababa de
# crear y moria con "No se pudo averiguar el id". Hay que comparar contra la
# fecha cero, no contra null.
id_de_tunel() {
    cloudflared tunnel list --output json 2>/dev/null \
    | node -e 'let b="";process.stdin.on("data",d=>b+=d).on("end",()=>{
        let t=[];try{t=JSON.parse(b)}catch{};
        const vivo = x => !x.deleted_at || x.deleted_at.startsWith("0001-01-01");
        const m=(t||[]).find(x=>x.name===process.argv[1] && vivo(x));
        process.stdout.write(m?m.id:"");
      })' "$1"
}

ID=$(id_de_tunel "$TUNEL" || true)

if [ -n "$ID" ]; then
    registro "El tunel \"$TUNEL\" ya existe (id $ID)."
else
    registro "Creando el tunel \"$TUNEL\"."
    cloudflared tunnel create "$TUNEL" > /dev/null
    ID=$(id_de_tunel "$TUNEL")
    [ -n "$ID" ] || { echo "No se pudo averiguar el id del tunel recien creado." >&2; exit 1; }
    registro "Creado: id $ID."
fi

# -----------------------------------------------------------------------------
# 3. Las credenciales.
#
# cloudflared tunnel create las deja en ~/.cloudflared/<id>.json. Se copian al
# repositorio (ignoradas por Git) para que el contenedor las monte desde una
# ruta estable y no desde el perfil de quien corra el script.
# -----------------------------------------------------------------------------
ORIGEN_CRED="${HOME:-$USERPROFILE}/.cloudflared/$ID.json"
if [ -s "$ORIGEN_CRED" ]; then
    cp "$ORIGEN_CRED" "$CREDENCIALES"
    chmod 600 "$CREDENCIALES" 2>/dev/null || true
    registro "Credenciales copiadas a infra/tunel/.credenciales.json (ignorado por Git)."
elif [ -s "$CREDENCIALES" ]; then
    registro "Ya estaban en infra/tunel/.credenciales.json."
else
    echo "No encuentro las credenciales del tunel ni en $ORIGEN_CRED ni en $CREDENCIALES." >&2
    echo "Si el tunel se creo en otra maquina, hay que copiar ese archivo a mano." >&2
    exit 1
fi

# -----------------------------------------------------------------------------
# 4. La configuracion, a partir de la plantilla versionada.
# -----------------------------------------------------------------------------
node -e '
const fs = require("fs");
const [plantilla, salida, tunel, dominio, n8n, mantis, nube, grafana] = process.argv.slice(1);
let s = fs.readFileSync(plantilla, "utf8");
// split/join y no replace: en el texto de reemplazo de String.replace, las
// secuencias $&, $`, $\x27 y $1 son especiales.
s = s.split("TUNEL_NOMBRE").join(tunel);
s = s.split("DOMINIO_PUBLICO").join(dominio);
s = s.split("DOMINIO_N8N").join(n8n);
s = s.split("DOMINIO_MANTIS").join(mantis);
s = s.split("DOMINIO_NUBE").join(nube);
s = s.split("DOMINIO_GRAFANA").join(grafana);
// Un marcador sin reemplazar en un "hostname:" lo deja VACIO, y una regla
// con hostname vacio en cloudflared atrapa todo el trafico: seria publicar
// un servicio interno en el nombre de la aplicacion. Por eso se corta.
if (/DOMINIO_[A-Z0-9]|TUNEL_NOMBRE/.test(s)) {
  throw new Error("quedaron marcadores sin reemplazar");
}
fs.writeFileSync(salida, "# GENERADO por preparar-tunel.sh a partir de config.plantilla.yml.\n"
  + "# No editar aca: editar la plantilla, que es la que se versiona.\n\n" + s);
' "$PLANTILLA" "$GENERADO" "$TUNEL" "$DOMINIO" \
  "$DOMINIO_N8N" "$DOMINIO_MANTIS" "$DOMINIO_NUBE" "$DOMINIO_GRAFANA"
registro "config.generado.yml escrito para $DOMINIO."

# -----------------------------------------------------------------------------
# 5. El registro DNS.
#
# Apunta el nombre publico al tunel con un CNAME a <id>.cfargotunnel.com. Es
# idempotente del lado de Cloudflare, pero si el nombre ya apunta a otra cosa
# avisa en vez de pisarlo.
# -----------------------------------------------------------------------------
for NOMBRE in "$DOMINIO" "$DOMINIO_N8N" "$DOMINIO_MANTIS" "$DOMINIO_NUBE" "$DOMINIO_GRAFANA"; do
    registro "Dando de alta el registro DNS de $NOMBRE."
    if salida=$(cloudflared tunnel route dns "$TUNEL" "$NOMBRE" 2>&1); then
        registro "DNS listo: $NOMBRE."
    else
        case "$salida" in
            *"already configured"*|*"already exists"*|*"record with that host"*)
                registro "$NOMBRE ya existia y apunta a este tunel." ;;
            *)
                echo "No se pudo dar de alta el DNS de $NOMBRE:" >&2
                echo "$salida" | sed 's/^/    /' >&2
                echo >&2
                echo "Si el nombre ya apunta a otra cosa, hay que resolverlo a mano en el" >&2
                echo "panel de Cloudflare: este script no pisa un registro ajeno." >&2
                exit 1 ;;
        esac
    fi
done

# -----------------------------------------------------------------------------
# 6. El nombre publico de Nextcloud.
#
# Nextcloud rechaza con "Access through untrusted domain" cualquier Host que
# no este en trusted_domains, y no sirve ni la pantalla de inicio.
#
# La variable NEXTCLOUD_TRUSTED_DOMAINS del docker-compose.yml alcanza para
# una instalacion NUEVA: la imagen la aplica al instalar y despues no la mira
# mas. Sobre la instancia que ya esta instalada hay que escribirlo con occ, y
# queda en config.php adentro del volumen, asi que sobrevive a recrear el
# contenedor.
# -----------------------------------------------------------------------------
if docker ps --format "{{.Names}}" 2>/dev/null | grep -qx restoya_nextcloud; then
    ocupado=$(docker exec -u www-data restoya_nextcloud \
        php occ config:system:get trusted_domains 2>/dev/null || true)
    if echo "$ocupado" | grep -qx "$DOMINIO_NUBE"; then
        registro "Nextcloud ya confia en $DOMINIO_NUBE."
    else
        # El indice 1 va despues de localhost, que es el 0.
        if docker exec -u www-data restoya_nextcloud \
            php occ config:system:set trusted_domains 1 --value="$DOMINIO_NUBE" > /dev/null 2>&1; then
            registro "Nextcloud ahora confia en $DOMINIO_NUBE."
        else
            echo "No se pudo escribir trusted_domains en Nextcloud." >&2
            echo "A mano:  docker exec -u www-data restoya_nextcloud php occ config:system:set trusted_domains 1 --value=$DOMINIO_NUBE" >&2
        fi
    fi
else
    registro "Nextcloud no esta levantado: cuando lo levantes, volve a correr este script."
fi

echo
registro "Preparado. El tunel NO esta levantado todavia."
echo
echo "Para publicar la aplicacion:"
echo "    cd infra/compose && docker compose --profile tunel up -d"
echo
echo "Para bajarla:"
echo "    cd infra/compose && docker compose --profile tunel down"
echo
echo "Quedara publicado:"
echo "    aplicacion   https://$DOMINIO"
echo "    n8n          https://$DOMINIO_N8N"
echo "    Mantis       https://$DOMINIO_MANTIS"
echo "    Nextcloud    https://$DOMINIO_NUBE"
echo "    Grafana      https://$DOMINIO_GRAFANA"
echo
echo "NO se publican pgAdmin, Prometheus, Alertmanager, Mailpit ni la base."
echo "La diferencia es que esos cinco no piden credencial ninguna; ver el"
echo "cuadro en infra/tunel/config.plantilla.yml."
echo
echo "Y de las cuatro herramientas publicadas, la clave pasa a ser lo unico"
echo "que las separa de Internet. Hallazgo 18 de docs/09-seguridad.md."
