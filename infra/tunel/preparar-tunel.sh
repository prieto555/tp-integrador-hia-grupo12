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
#   4. Da de alta el registro DNS que apunta el nombre público al túnel.
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
ID=$(cloudflared tunnel list --output json 2>/dev/null \
     | node -e 'let b="";process.stdin.on("data",d=>b+=d).on("end",()=>{
         let t=[];try{t=JSON.parse(b)}catch{};
         const n=process.argv[1];
         const m=(t||[]).find(x=>x.name===n && !x.deleted_at);
         process.stdout.write(m?m.id:"");
       })' "$TUNEL" || true)

if [ -n "$ID" ]; then
    registro "El tunel \"$TUNEL\" ya existe (id $ID)."
else
    registro "Creando el tunel \"$TUNEL\"."
    cloudflared tunnel create "$TUNEL" > /dev/null
    ID=$(cloudflared tunnel list --output json 2>/dev/null \
         | node -e 'let b="";process.stdin.on("data",d=>b+=d).on("end",()=>{
             let t=[];try{t=JSON.parse(b)}catch{};
             const m=(t||[]).find(x=>x.name===process.argv[1] && !x.deleted_at);
             process.stdout.write(m?m.id:"");
           })' "$TUNEL")
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
const [plantilla, salida, tunel, dominio] = process.argv.slice(1);
let s = fs.readFileSync(plantilla, "utf8");
// split/join y no replace: en el texto de reemplazo de String.replace, las
// secuencias $&, $`, $\x27 y $1 son especiales.
s = s.split("TUNEL_NOMBRE").join(tunel);
s = s.split("DOMINIO_PUBLICO").join(dominio);
if (s.includes("DOMINIO_PUBLICO") || s.includes("TUNEL_NOMBRE")) {
  throw new Error("quedaron marcadores sin reemplazar");
}
fs.writeFileSync(salida, "# GENERADO por preparar-tunel.sh a partir de config.plantilla.yml.\n"
  + "# No editar aca: editar la plantilla, que es la que se versiona.\n\n" + s);
' "$PLANTILLA" "$GENERADO" "$TUNEL" "$DOMINIO"
registro "config.generado.yml escrito para $DOMINIO."

# -----------------------------------------------------------------------------
# 5. El registro DNS.
#
# Apunta el nombre publico al tunel con un CNAME a <id>.cfargotunnel.com. Es
# idempotente del lado de Cloudflare, pero si el nombre ya apunta a otra cosa
# avisa en vez de pisarlo.
# -----------------------------------------------------------------------------
registro "Dando de alta el registro DNS de $DOMINIO."
if salida=$(cloudflared tunnel route dns "$TUNEL" "$DOMINIO" 2>&1); then
    registro "DNS listo."
else
    case "$salida" in
        *"already configured"*|*"already exists"*|*"record with that host"*)
            registro "El registro ya existia y apunta a este tunel." ;;
        *)
            echo "No se pudo dar de alta el DNS:" >&2
            echo "$salida" | sed 's/^/    /' >&2
            echo >&2
            echo "Si el nombre ya apunta a otra cosa, hay que resolverlo a mano en el" >&2
            echo "panel de Cloudflare: este script no pisa un registro ajeno." >&2
            exit 1 ;;
    esac
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
echo "Quedara en:  https://$DOMINIO"
echo
echo "Lo unico publicado es la aplicacion. pgAdmin, Grafana, Prometheus,"
echo "Mantis, Nextcloud, n8n y la base NO estan en el ingress, a proposito:"
echo "ver el cuadro en infra/tunel/config.plantilla.yml."
