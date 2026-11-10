#!/usr/bin/env bash
# Despliegue con verificacion y vuelta atras automatica (punto 8).
#
#   ./infra/despliegue/desplegar.sh <version>
#
# donde <version> es el SHA del commit, que es la etiqueta con la que el
# pipeline publico las imagenes en ghcr.io.
#
# Lo que hace, en orden:
#
#   1. anota que version esta corriendo ahora (para poder volver);
#   2. baja las imagenes nuevas;
#   3. recrea backend y frontend;
#   4. verifica que el sistema responda de verdad, no solo que el contenedor
#      este "up";
#   5. si la verificacion falla, vuelve sola a la version anterior y termina
#      con error.
#
# El punto 4 es el que justifica todo el script. "docker compose up -d" sale
# con codigo 0 en cuanto arranca el contenedor, aunque el proceso de adentro
# se este reiniciando en bucle. Nos paso: una variable sin declarar dejo el
# backend reiniciandose y el despliegue habria quedado "exitoso".
#
# La base de datos NO se toca. Un despliegue no recrea el volumen de datos ni
# corre migraciones: si alguna vez hace falta migrar, va en un paso aparte y
# con copia previa, porque una migracion no se deshace volviendo la imagen.

set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    echo "Uso: $0 <version>   (el SHA del commit)" >&2
    exit 2
fi

AQUI="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_DIR="$AQUI/../compose"
ARCHIVO_VERSION="$AQUI/.version-desplegada"
URL="${URL_VERIFICACION:-http://127.0.0.1:8080}"
INTENTOS="${INTENTOS_VERIFICACION:-45}"

cd "$COMPOSE_DIR"

compose() {
    docker compose \
        -f docker-compose.yml \
        -f docker-compose.produccion.yml \
        --profile app "$@"
}

registro() { echo "$(date '+%H:%M:%S') | despliegue | $*"; }

# -----------------------------------------------------------------------------
# Verificacion. Devuelve 0 si el sistema responde de verdad.
# -----------------------------------------------------------------------------
verificar() {
    local i codigo cuerpo

    for i in $(seq 1 "$INTENTOS"); do
        if curl -fsS -o /dev/null "$URL/" 2>/dev/null; then
            break
        fi
        if [ "$i" = "$INTENTOS" ]; then
            registro "El frente no respondio en $((INTENTOS * 2)) s."
            return 1
        fi
        sleep 2
    done

    # Un 502 es nginx sin backend detras: el caso real que tuvimos.
    codigo=$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/productos")
    case "$codigo" in
        502|503|504|000)
            registro "nginx no alcanza al backend (HTTP $codigo)."
            return 1
            ;;
    esac

    # Que devuelva datos: eso prueba la cadena entera hasta PostgreSQL.
    cuerpo=$(curl -fsS "$URL/api/productos" 2>/dev/null) || {
        registro "La API no devolvio nada."
        return 1
    }
    case "$cuerpo" in
        \[*) ;;
        *) registro "La API no devolvio un arreglo."; return 1 ;;
    esac

    # Y que ningun contenedor haya quedado reiniciandose.
    if compose ps --format '{{.Name}} {{.State}}' | grep -v ' running$'; then
        registro "Hay servicios que no estan corriendo."
        return 1
    fi

    return 0
}

# -----------------------------------------------------------------------------
ANTERIOR=""
[ -f "$ARCHIVO_VERSION" ] && ANTERIOR="$(cat "$ARCHIVO_VERSION")"

registro "Desplegando $VERSION. Version anterior: ${ANTERIOR:-ninguna anotada}."

export VERSION
registro "Bajando las imagenes."
compose pull backend frontend

registro "Recreando backend y frontend."
compose up -d backend frontend

registro "Verificando."
if verificar; then
    echo "$VERSION" > "$ARCHIVO_VERSION"
    registro "Listo. $VERSION esta en servicio."
    exit 0
fi

# -----------------------------------------------------------------------------
# Vuelta atras.
# -----------------------------------------------------------------------------
registro "LA VERIFICACION FALLO."
compose logs --tail=80 backend frontend || true

if [ -z "$ANTERIOR" ]; then
    registro "No hay version anterior anotada: no se puede volver sola."
    registro "Hay que elegir a mano una etiqueta del registro y correr:"
    registro "  VERSION=<sha> docker compose -f docker-compose.yml \\"
    registro "    -f docker-compose.produccion.yml --profile app up -d"
    exit 1
fi

FALLIDA="$VERSION"
registro "Volviendo a $ANTERIOR."
VERSION="$ANTERIOR"
export VERSION
compose pull backend frontend
compose up -d backend frontend

if verificar; then
    registro "Se volvio a $ANTERIOR y el sistema responde."
    registro "La version $FALLIDA no quedo en servicio."
    # Se sale con error a proposito, aunque el sistema este sano: el commit
    # que se quiso desplegar esta roto y la corrida tiene que verse en rojo.
    exit 1
fi

registro "LA VUELTA ATRAS TAMPOCO RESPONDE. Hace falta intervenir a mano."
exit 1
