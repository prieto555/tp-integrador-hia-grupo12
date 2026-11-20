#!/bin/sh
# Prueba de caida del primario con failover automatico.
#
# Que hace: escribe una fila por segundo contra el BALANCEADOR -nunca contra
# un nodo por su nombre- mientras el lider se cae. Cada intento queda anotado
# con su hora y su resultado, asi el corte se mide en vez de estimarse.
#
#   bash infra/postgres/patroni/probar-failover.sh
#
# Lo que hay que mirar al final:
#   - cuantas escrituras fallaron (el corte real, en segundos)
#   - que el lider sea OTRO nodo
#   - que la linea de tiempo haya avanzado: es la prueba de que hubo una
#     promocion y no un reinicio

set -eu

AQUI="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$AQUI/../../compose/.env"
leer() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }

DB_NAME="$(leer DB_NAME)"
DB_USER="$(leer DB_USER)"
DB_PASSWORD="$(leer DB_PASSWORD)"
SEGUNDOS="${1:-90}"

pc() { MSYS_NO_PATHCONV=1 docker exec restoya_pg1 patronictl -c /etc/patroni.yml "$@" 2>/dev/null; }

sql() {
    docker exec -e PGPASSWORD="$DB_PASSWORD" restoya_pg1 \
        psql -h pgbalanceador -p 5000 -U "$DB_USER" -d "$DB_NAME" \
        -At -c "$1" 2>&1
}

echo "== Estado inicial =="
pc list
# El nombre del lider sale del JSON, parseado de verdad.
#
# El primer intento uso grep sobre la tabla de texto y se trajo
# "restoya-cluster" -el nombre del CLUSTER, no el del nodo-. El docker stop
# fallo contra un contenedor inexistente, el "|| true" se lo trago, y la
# prueba dio 75 escrituras sin un solo error... porque nunca se cayo nadie.
# Una prueba que no puede fallar no prueba nada.
LIDER="$(pc list -f json | node -e '
let b="";process.stdin.on("data",d=>b+=d).on("end",()=>{
  const m=JSON.parse(b).find(x=>x.Role==="Leader");
  process.stdout.write(m?m.Member:"");
})')"

if [ -z "$LIDER" ]; then
    echo "No se pudo determinar el lider. Se aborta." >&2
    exit 1
fi
echo "Lider actual: $LIDER"

echo
echo "== Preparando la tabla de la prueba =="
sql "CREATE TABLE IF NOT EXISTS prueba_failover (
        id serial PRIMARY KEY,
        momento timestamptz NOT NULL DEFAULT now(),
        nodo text NOT NULL DEFAULT inet_server_addr()::text)" >/dev/null
sql "TRUNCATE prueba_failover" >/dev/null

echo
echo "== Escribiendo cada segundo durante ${SEGUNDOS}s =="
echo "   (a los 15s se tira el lider)"
echo

OK=0; FALLO=0; PRIMER_FALLO=""; ULTIMO_FALLO=""
i=0
while [ "$i" -lt "$SEGUNDOS" ]; do
    i=$((i + 1))

    if [ "$i" -eq 15 ]; then
        echo "--- $(date -u +%H:%M:%S)  docker stop restoya_$LIDER ---"
        # SIN "|| true": si el contenedor no existe hay que enterarse, no
        # seguir corriendo una prueba que ya no prueba nada.
        docker stop "restoya_$LIDER" >/dev/null
    fi

    if sql "INSERT INTO prueba_failover DEFAULT VALUES" >/dev/null 2>&1; then
        OK=$((OK + 1))
        if [ -n "$PRIMER_FALLO" ] && [ -z "${RECUPERADO:-}" ]; then
            RECUPERADO="$(date -u +%H:%M:%S)"
            echo "--- $RECUPERADO  vuelve a escribir ---"
        fi
    else
        FALLO=$((FALLO + 1))
        [ -z "$PRIMER_FALLO" ] && PRIMER_FALLO="$(date -u +%H:%M:%S)" && echo "--- $PRIMER_FALLO  deja de escribir ---"
        ULTIMO_FALLO="$(date -u +%H:%M:%S)"
    fi
    sleep 1
done

echo
echo "== Resultado =="
echo "  escrituras correctas : $OK"
echo "  escrituras fallidas  : $FALLO   (cada una es ~1 s de corte)"
[ -n "$PRIMER_FALLO" ] && echo "  corte desde          : $PRIMER_FALLO"
[ -n "${RECUPERADO:-}" ] && echo "  recuperado a las     : ${RECUPERADO}"

echo
echo "== Estado final =="
pc list

echo
echo "== Filas escritas, por nodo que las recibio =="
sql "SELECT nodo, count(*), min(momento)::time AS desde, max(momento)::time AS hasta
     FROM prueba_failover GROUP BY nodo ORDER BY 3"
