#!/bin/sh
# Mide las consultas de referencia del punto 5, con y sin indices.
#
#   sh medir.sh [repeticiones]
#
# El problema de medir "antes de crear los indices" y "despues" como dos
# momentos distintos es que entre uno y otro cambia la cache: la segunda
# medicion sale mejor aunque el indice no sirva para nada. Para que la
# comparacion signifique algo, las dos mitades corren seguidas, sobre la misma
# cache, y lo unico que cambia es si el planificador tiene permiso de usar los
# indices:
#
#   enable_indexscan / enable_bitmapscan / enable_indexonlyscan = off
#
# Eso deja al planificador con las mismas opciones que tenia antes de que los
# indices existieran. No es una simulacion aproximada: es exactamente el plan
# que elegia.
#
# Se corre cada consulta varias veces y se informa el MEJOR tiempo, no el
# promedio. El promedio mezcla el ruido del sistema operativo; el mejor tiempo
# es el piso real de la consulta.

set -e

CONTENEDOR="${CONTENEDOR:-restoya_db}"
USUARIO="${DB_USER:-restoya}"
BASE="${DB_NAME:-restoyadb}"
REPS="${1:-3}"

DIR=$(dirname "$0")
ORIGEN="$DIR/consultas-planas.sql"

SIN_INDICES="SET enable_indexscan=off; SET enable_bitmapscan=off; SET enable_indexonlyscan=off;"

# Devuelve el tiempo en milisegundos de una consulta, el mejor de REPS corridas.
mejor_tiempo() {
    prefijo="$1"
    consulta="$2"
    mejor=""
    i=0
    while [ "$i" -lt "$REPS" ]; do
        i=$((i + 1))
        ms=$(printf '%s\nEXPLAIN (ANALYZE, TIMING OFF, SUMMARY ON) %s\n' "$prefijo" "$consulta" \
            | docker exec -i "$CONTENEDOR" psql -U "$USUARIO" -d "$BASE" -t -A 2>/dev/null \
            | sed -n 's/^ *Execution Time: \([0-9.]*\) ms$/\1/p')
        [ -z "$ms" ] && continue
        if [ -z "$mejor" ]; then
            mejor="$ms"
        else
            mejor=$(awk -v a="$mejor" -v b="$ms" 'BEGIN{print (b<a)?b:a}')
        fi
    done
    [ -z "$mejor" ] && mejor="error"
    echo "$mejor"
}

printf '%-52s | %12s | %12s | %8s\n' "consulta" "sin indices" "con indices" "mejora"
printf '%.52s-+-%.12s-+-%.12s-+-%.8s\n' \
    "----------------------------------------------------" \
    "------------" "------------" "--------"

# Calienta la cache antes de la primera medicion, para no castigar a Q1 por ser
# la primera.
docker exec -i "$CONTENEDOR" psql -U "$USUARIO" -d "$BASE" -q \
    -c "SELECT count(*) FROM pedidos;" \
    -c "SELECT count(*) FROM detalle_pedidos;" \
    -c "SELECT count(*) FROM pagos;" > /dev/null 2>&1

# Corta el archivo en los marcadores "-- @@ nombre" y mide cada bloque.
awk '/^-- @@ /{n++; sub(/^-- @@ /,""); nombre[n]=$0; next}
     n>0 {cuerpo[n]=cuerpo[n] " " $0}
     END {for(i=1;i<=n;i++) printf "%s\t%s\n", nombre[i], cuerpo[i]}' "$ORIGEN" |
while IFS="$(printf '\t')" read -r nombre cuerpo; do
    [ -z "$cuerpo" ] && continue
    sin=$(mejor_tiempo "$SIN_INDICES" "$cuerpo")
    con=$(mejor_tiempo "" "$cuerpo")
    if [ "$sin" = "error" ] || [ "$con" = "error" ]; then
        mejora="-"
    else
        mejora=$(awk -v a="$sin" -v b="$con" 'BEGIN{ if (b>0) printf "%.1fx", a/b; else print "-" }')
    fi
    printf '%-52s | %12s | %12s | %8s\n' "$nombre" "$sin" "$con" "$mejora"
done
