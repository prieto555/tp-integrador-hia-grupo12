#!/usr/bin/env bash
# Prepara n8n para el punto 13: crea las cuatro credenciales e importa los tres
# flujos.
#
#   ./infra/automatizacion/preparar-n8n.sh
#
# Es idempotente: volver a correrlo sobreescribe las credenciales y los flujos
# con lo mismo.
#
# Por que hace falta un script y no alcanza con los JSON del repositorio:
#
#   - Los flujos se versionan SIN secretos. Cada nodo que necesita una clave
#     referencia una credencial por su id (CRED_MANTIS_API y companhia), y el
#     valor vive en el almacen cifrado de n8n, no en el repositorio.
#   - Los ids de esas credenciales no son inventados al azar: son exactamente
#     los que los flujos ya referencian. Al crearlas con el mismo id, los nodos
#     quedan enlazados sin tocar un solo JSON a mano.
#   - El archivo temporal con los secretos se crea con permisos 600, se copia
#     al contenedor, se importa y se borra de los dos lados. Nada se imprime.
#
# Antes hay que tener corriendo el perfil "automatizacion", y haber corrido
# preparar-mantis.sh (que emite el token que usa el flujo F01).

set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
ENV="$RAIZ/infra/compose/.env"
FLUJOS="$AQUI/flujos"
TOKEN_MANTIS="$RAIZ/infra/incidencias/.token-api"
CONTENEDOR="restoya_n8n"

[ -f "$ENV" ] || { echo "Falta $ENV" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV"; set +a

URL="http://127.0.0.1:${N8N_PORT:-5678}"

# En Git Bash las rutas POSIX (/c/Users/...) no las entiende el node de
# Windows, y los argumentos que parecen rutas absolutas se reescriben solos.
# cygpath arregla lo primero; para lo segundo se pone MSYS_NO_PATHCONV SOLO en
# las llamadas que lo necesitan, nunca exportada: con ella puesta para todo, el
# "-o /dev/null" de curl deja de traducirse y curl sale con el codigo 23.
if command -v cygpath > /dev/null 2>&1; then
    AQUI_NODE="$(cygpath -m "$AQUI")"
    RAIZ_NODE="$(cygpath -m "$RAIZ")"
else
    AQUI_NODE="$AQUI"
    RAIZ_NODE="$RAIZ"
fi

registro() { echo "$(date '+%H:%M:%S') | n8n | $*"; }

# docker es un binario de Windows: una ruta como /tmp/algo la busca en
# C:	mpalgo y no la encuentra. Esto traduce SOLO el lado local de docker cp.
ruta_local() {
    if command -v cygpath > /dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
}

n8n_cli() { MSYS_NO_PATHCONV=1 docker exec -u node "$CONTENEDOR" n8n "$@" 2>&1 \
    | grep -v 'Permissions 0644\|User settings loaded'; }

# -----------------------------------------------------------------------------
# 0. Esperar.
# -----------------------------------------------------------------------------
registro "Esperando a n8n en $URL."
for i in $(seq 1 60); do
    codigo=$(curl -s -o /dev/null -w '%{http_code}' "$URL/healthz") || codigo=000
    [ "$codigo" = "200" ] && break
    [ "$i" = 60 ] && { echo "n8n no respondio en 300 s." >&2; exit 1; }
    sleep 5
done
registro "Responde."

# -----------------------------------------------------------------------------
# 1. El secreto del webhook de alertas.
#
# Alertmanager va a llamar al webhook de n8n, y ese webhook no puede quedar
# abierto: cualquiera que llegue al puerto podria abrir incidencias falsas. Se
# protege con una cabecera compartida. Si todavia no existe, se genera una y se
# guarda en el .env, sin imprimirla.
# -----------------------------------------------------------------------------
if [ -z "${ALERTAS_WEBHOOK_TOKEN:-}" ]; then
    ALERTAS_WEBHOOK_TOKEN="$(head -c 24 /dev/urandom | base64 | tr -d '/+=')"
    printf '\n# Secreto que comparten Alertmanager y el webhook de n8n (punto 13),\n# generado por preparar-n8n.sh\nALERTAS_WEBHOOK_TOKEN=%s\n' \
        "$ALERTAS_WEBHOOK_TOKEN" >> "$ENV"
    registro "Secreto del webhook generado y guardado en infra/compose/.env."
else
    registro "El secreto del webhook ya estaba en el .env."
fi

[ -s "$TOKEN_MANTIS" ] || { echo "Falta $TOKEN_MANTIS. Corre antes preparar-mantis.sh." >&2; exit 1; }

# El mismo secreto, en un archivo que lee Alertmanager (credentials_file). Asi
# no hay un secreto escrito en alertmanager.yml, que si esta en el repositorio.
# El archivo esta en el .gitignore.
TOKEN_ALERTAS="$RAIZ/infra/prometheus/.token-alertas"
printf '%s' "$ALERTAS_WEBHOOK_TOKEN" > "$TOKEN_ALERTAS"
chmod 600 "$TOKEN_ALERTAS"
registro "Secreto escrito en infra/prometheus/.token-alertas para Alertmanager."

# -----------------------------------------------------------------------------
# 2. Las credenciales.
#
# Los ids son los que los flujos ya referencian: asi quedan enlazados solos.
# -----------------------------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"; MSYS_NO_PATHCONV=1 docker exec "$CONTENEDOR" rm -rf /tmp/n8n-import > /dev/null 2>&1 || true' EXIT
umask 077

registro "Armando las credenciales."
node -e '
const fs = require("fs");
const [salida, tokenMantis, secretoAlertas, ncUsuario, ncClave] = process.argv.slice(1);
const creds = [
  {
    id: "CRED_WEBHOOK_ALERTAS",
    name: "Cabecera de alertas",
    type: "httpHeaderAuth",
    // Authorization: Bearer <secreto>. No es capricho: el http_config de
    // Alertmanager no permite cabeceras con nombre arbitrario, solo el bloque
    // "authorization", que manda exactamente esta cabecera.
    data: { name: "Authorization", value: "Bearer " + secretoAlertas },
  },
  {
    id: "CRED_MANTIS_API",
    name: "Token de API de Mantis",
    type: "httpHeaderAuth",
    data: { name: "Authorization", value: tokenMantis },
  },
  {
    id: "CRED_SMTP_MAILPIT",
    name: "Mailpit del laboratorio",
    type: "smtp",
    // Mailpit no pide autenticacion ni cifra: es un buzon de laboratorio y los
    // correos no salen a ningun lado. Por eso usuario y clave van vacios.
    data: { user: "", password: "", host: "mantis-mail", port: 1025, secure: false, disableStartTls: true },
  },
  {
    id: "CRED_NEXTCLOUD_BOT",
    name: "Nextcloud - cuenta automatizacion",
    type: "httpBasicAuth",
    data: { user: ncUsuario, password: ncClave },
  },
];
fs.writeFileSync(salida, JSON.stringify(creds, null, 2));
' "$TMP/credenciales.json" \
  "$(cat "$TOKEN_MANTIS")" \
  "$ALERTAS_WEBHOOK_TOKEN" \
  "automatizacion" \
  "${NC_PASS_BOT:?falta NC_PASS_BOT en el .env (lo genera preparar-nextcloud.sh)}"

chmod 600 "$TMP/credenciales.json"

MSYS_NO_PATHCONV=1 docker exec "$CONTENEDOR" mkdir -p /tmp/n8n-import
MSYS_NO_PATHCONV=1 docker cp "$(ruta_local "$TMP/credenciales.json")" "$CONTENEDOR:/tmp/n8n-import/credenciales.json" > /dev/null
registro "Importando las credenciales."
n8n_cli import:credentials --input=/tmp/n8n-import/credenciales.json
MSYS_NO_PATHCONV=1 docker exec "$CONTENEDOR" rm -f /tmp/n8n-import/credenciales.json
rm -f "$TMP/credenciales.json"
registro "Credenciales importadas. El archivo temporal se borro de los dos lados."

# -----------------------------------------------------------------------------
# 3. Los flujos.
#
# Se importan DESACTIVADOS ("active": false en cada JSON). Activarlos es una
# decision de quien los revisa, no del script: un flujo que abre incidencias
# solo no se enciende por sorpresa.
# -----------------------------------------------------------------------------
registro "Importando los flujos."
MSYS_NO_PATHCONV=1 docker exec "$CONTENEDOR" mkdir -p /tmp/n8n-import/flujos
for f in "$FLUJOS"/*.json; do
    MSYS_NO_PATHCONV=1 docker cp "$(ruta_local "$f")" "$CONTENEDOR:/tmp/n8n-import/flujos/$(basename "$f")" > /dev/null
done
n8n_cli import:workflow --separate --input=/tmp/n8n-import/flujos

echo
registro "Listo. Flujos cargados y desactivados:"
n8n_cli list:workflow | sed 's/^/    /'
echo
echo "n8n:    $URL"
echo "Buzon:  http://127.0.0.1:${MAILPIT_PORT:-8025}"
echo
echo "Alertmanager ya le habla al flujo F01: el receptor 'registro-y-n8n' manda a"
echo "http://n8n:5678/webhook/alerta con Authorization: Bearer, leyendo el secreto"
echo "de infra/prometheus/.token-alertas. Si cambio el secreto, hay que recargar:"
echo "  docker compose --profile monitoreo restart alertmanager"
