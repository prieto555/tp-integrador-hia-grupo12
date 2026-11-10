#!/usr/bin/env bash
# Simulacion de la caida del primario y promocion de la replica
# (punto 6, actividades 7 y 8).
#
#   ./infra/postgres/simular-caida.sh
#
# Hace la prueba completa, mide cada paso y deja la salida lista para pegar en
# el informe. ES DESTRUCTIVO en el sentido de que PROMUEVE la replica: despues
# de correrlo, la replica ya no es replica y hay que volver a clonarla con
#
#   docker compose --profile replica down
#   docker volume rm restoya_pgdata_replica
#   docker compose --profile replica up -d
#
# Por eso pregunta antes.
#
# Lo que la prueba tiene que demostrar, segun la consigna:
#   - como se detecta la falla          -> seccion 3
#   - como se promueve el otro nodo     -> seccion 4
#   - como se evita perder datos        -> seccion 5
#
# Y lo que tiene que dejar claro: aca NO hay failover automatico. La deteccion
# y la promocion las hace este script porque alguien lo corre. Ver
# docs/10-cluster.md.

set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
ENV="$AQUI/../compose/.env"
PRIMARIO=restoya_db
REPLICA=restoya_db_replica

# shellcheck disable=SC1090
set -a; . "$ENV"; set +a

sql_primario() { docker exec "$PRIMARIO" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1"; }
sql_replica()  { docker exec "$REPLICA"  psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1"; }

titulo() { echo; echo "=== $* ==="; }

if [ "${SI:-}" != "1" ]; then
    echo "Esta prueba PROMUEVE la replica: despues deja de ser replica."
    echo "Para rehacerla hay que borrar el volumen y volver a clonar (unos 50 s)."
    echo
    read -r -p "Seguir? (escribi SI) " r
    [ "$r" = "SI" ] || { echo "Cancelado."; exit 0; }
fi

# -----------------------------------------------------------------------------
titulo "1. Estado antes de la caida"
echo "primario en recuperacion : $(sql_primario 'SELECT pg_is_in_recovery();')"
echo "replica en recuperacion  : $(sql_replica  'SELECT pg_is_in_recovery();')"
echo "linea de tiempo primario : $(sql_primario 'SELECT timeline_id FROM pg_control_checkpoint();')"
echo "linea de tiempo replica  : $(sql_replica  'SELECT timeline_id FROM pg_control_checkpoint();')"
echo
echo "retraso:"
sql_primario "SELECT client_addr, state, sync_state,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS bytes_atras,
    write_lag, replay_lag
  FROM pg_stat_replication;"

# -----------------------------------------------------------------------------
titulo "2. Escribir algo justo antes de cortar"
# Esta fila es la prueba de que no se perdio nada: se escribe en el primario,
# se confirma que llego a la replica, y recien ahi se corta.
MARCA="caida-$(date +%H%M%S)"
sql_primario "INSERT INTO mesas (numero, capacidad, estado, \"fechaCreacion\", \"fechaActualizacion\")
  VALUES (902, 4, 'LIBRE', NOW(), NOW())
  ON CONFLICT (numero) DO UPDATE SET \"fechaActualizacion\" = NOW();" > /dev/null
echo "Insertada la mesa 902 en el primario ($MARCA)."
sleep 2
echo "En la replica: $(sql_replica "SELECT numero || ' / ' || estado FROM mesas WHERE numero = 902;")"

LSN_PRIMARIO=$(sql_primario 'SELECT pg_current_wal_lsn();')
LSN_REPLICA=$(sql_replica  'SELECT pg_last_wal_replay_lsn();')
echo "LSN primario: $LSN_PRIMARIO"
echo "LSN replica : $LSN_REPLICA"
echo "Diferencia  : $(sql_primario "SELECT pg_wal_lsn_diff('$LSN_PRIMARIO', '$LSN_REPLICA');") bytes"

# -----------------------------------------------------------------------------
titulo "3. Cortar el primario"
# docker stop manda SIGTERM: PostgreSQL hace un apagado ordenado. Es el caso
# amable. El caso feo (kill -9, corte de luz) se comenta en el informe.
T0=$(date +%s)
docker stop "$PRIMARIO" > /dev/null
echo "Primario detenido a las $(date '+%H:%M:%S')."

echo
echo "Como se detecta la falla. Tres formas, ninguna automatica:"
echo
echo "a) La aplicacion: el backend ya no puede escribir."
echo "   (el tablero historico SIGUE andando: lee de la replica)"
echo
echo "b) La replica lo dice en su registro:"
docker logs --tail 5 "$REPLICA" 2>&1 | sed 's/^/     /'
echo
echo "c) Prometheus: el destino postgres/primario pasa a up = 0 y la regla"
echo "   de servicio caido se dispara a los 90 s (ver punto 10)."

# -----------------------------------------------------------------------------
titulo "4. Promover la replica"
echo "La replica sigue viva y sigue leyendo, pero no acepta escrituras:"
docker exec "$REPLICA" psql -U "$DB_USER" -d "$DB_NAME" -c \
    "INSERT INTO mesas (numero, capacidad, estado, \"fechaCreacion\", \"fechaActualizacion\")
     VALUES (903, 4, 'LIBRE', NOW(), NOW());" 2>&1 | sed 's/^/     /' || true

echo
echo "Promoviendo..."
T1=$(date +%s)
docker exec "$REPLICA" pg_ctl promote -D /var/lib/postgresql/data 2>&1 | sed 's/^/     /'

for i in $(seq 1 60); do
    if [ "$(sql_replica 'SELECT pg_is_in_recovery();' 2>/dev/null || echo t)" = "f" ]; then
        break
    fi
    sleep 1
done
T2=$(date +%s)

echo
echo "Promovida en $((T2 - T1)) s (desde el corte: $((T2 - T0)) s)."
echo "en recuperacion     : $(sql_replica 'SELECT pg_is_in_recovery();')"
echo "linea de tiempo     : $(sql_replica 'SELECT timeline_id FROM pg_control_checkpoint();')"
echo
echo "La linea de tiempo paso de 1 a 2. Esa es LA prueba de que hubo una"
echo "promocion real y no un simple reinicio: PostgreSQL abre una linea nueva"
echo "para que no se puedan mezclar los WAL del nodo viejo con los del nuevo."

# -----------------------------------------------------------------------------
titulo "5. No se perdio nada, y ahora si acepta escrituras"
echo "La mesa 902, escrita en el primario antes del corte:"
sql_replica "SELECT numero || ' / ' || estado FROM mesas WHERE numero = 902;" | sed 's/^/     /'
echo
echo "Conteos (tienen que ser los mismos que antes del corte):"
sql_replica "SELECT 'pedidos', COUNT(*) FROM pedidos
             UNION ALL SELECT 'pagos', COUNT(*) FROM pagos;" | sed 's/^/     /'
echo
echo "Escritura en el nodo promovido:"
sql_replica "INSERT INTO mesas (numero, capacidad, estado, \"fechaCreacion\", \"fechaActualizacion\")
  VALUES (903, 4, 'LIBRE', NOW(), NOW())
  ON CONFLICT (numero) DO UPDATE SET \"fechaActualizacion\" = NOW()
  RETURNING numero || ' escrita en el nodo promovido';" | sed 's/^/     /'

# -----------------------------------------------------------------------------
titulo "6. Que queda despues"
cat <<'TEXTO'
Lo que ESTE script NO hizo, y hay que tener claro:

  - No cambio a donde apunta la aplicacion. El backend sigue configurado
    con DB_HOST=db, que es el nodo caido. Para que la aplicacion use el
    nodo promovido hay que cambiar esa variable y recrear el contenedor.
    Con Patroni + HAProxy eso lo resuelve el balanceador; aca no hay.

  - No evito el cerebro dividido. Si ahora se levanta el primario viejo,
    quedan DOS nodos que se creen primarios, los dos aceptando escrituras,
    con datos que divergen desde el momento del corte. NO LEVANTAR EL
    PRIMARIO VIEJO sin antes volver a clonarlo desde el nuevo
    (pg_basebackup, o pg_rewind si se quiere aprovechar lo que ya tiene).

  - La ranura de replicacion replica_1 quedo en el nodo caido y ya no sirve.
    Al rearmar el par hay que crear una nueva en el nodo que quede de
    primario.

Para volver al estado anterior:

  docker start restoya_db
  docker compose --profile replica down
  docker volume rm restoya_pgdata_replica
  docker compose --profile replica up -d

(en ese orden: primero se levanta el primario original, y la replica se
clona de cero, con lo cual el nodo promovido y sus datos se descartan)
TEXTO

titulo "Fin de la prueba"
echo "Tiempo total desde el corte hasta tener un nodo escribiendo: $((T2 - T0)) s."
