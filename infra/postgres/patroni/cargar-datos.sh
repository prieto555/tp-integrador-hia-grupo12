#!/bin/sh
# Carga el esquema y los datos de referencia en el cluster con failover.
#
# Se conecta SIEMPRE por el balanceador (puerto 5000), nunca a un nodo por su
# nombre: esa es la forma correcta de hablarle a un cluster con eleccion de
# lider, y de paso demuestra que el balanceador enruta las escrituras.
#
#   docker compose --profile failover up -d
#   bash infra/postgres/patroni/cargar-datos.sh
#
# QUE SE CARGA Y QUE NO:
#
#   SI  - el esquema completo (tablas, enums, indices, vistas)
#       - los datos de referencia: roles, funciones, mesas, productos, cajas
#       - los dos usuarios reales, con su rol
#
#   NO  - los 6.000.000 de pedidos del punto 4.
#
# Eso ultimo es deliberado y hay que saber defenderlo: el conjunto grande vive
# en el nodo simple, que es donde se midieron las consultas del punto 5 y donde
# hay memoria para que esas mediciones signifiquen algo. Replicarlo en tres
# nodos serian 10 GB para demostrar lo mismo: que cuando se cae el lider, otro
# toma su lugar. Los pedidos de la demostracion se crean en vivo, que ademas es
# mejor prueba: se escribe ANTES y DESPUES de la caida.

set -eu

AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$AQUI/../../.."
ENV_FILE="$RAIZ/infra/compose/.env"

[ -f "$ENV_FILE" ] || { echo "No esta $ENV_FILE" >&2; exit 1; }

leer() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }

DB_NAME="$(leer DB_NAME)"
DB_USER="$(leer DB_USER)"
DB_PASSWORD="$(leer DB_PASSWORD)"

# Todo corre DENTRO de un contenedor del cluster, asi que el balanceador se
# alcanza por su nombre de servicio y la clave no pasa por la linea de
# comandos de Windows.
ejecutar() {
    docker exec -i -e PGPASSWORD="$DB_PASSWORD" restoya_pg1 \
        psql -h pgbalanceador -p 5000 -U "$DB_USER" -d "$1" -v ON_ERROR_STOP=1 -q
}

echo "== 1. Crear la base =="
# El "|| true" es a proposito: si ya existe, no es un error, es la segunda
# corrida del script.
docker exec -e PGPASSWORD="$DB_PASSWORD" restoya_pg1 \
    psql -h pgbalanceador -p 5000 -U "$DB_USER" -d postgres \
    -c "CREATE DATABASE \"$DB_NAME\"" 2>/dev/null || echo "   (ya existia)"

echo "== 2. Esquema =="
ejecutar "$DB_NAME" < "$RAIZ/infra/postgres/schema.sql"

echo "== 3. Datos de referencia desde el nodo simple =="
docker exec -e PGPASSWORD="$DB_PASSWORD" restoya_db \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --data-only --no-owner --no-privileges \
        -t roles -t funciones -t roles_funciones -t mesas -t productos -t cajas \
  | docker exec -i -e PGPASSWORD="$DB_PASSWORD" restoya_pg1 \
        psql -h pgbalanceador -p 5000 -U "$DB_USER" -d "$DB_NAME" -q

echo "== 4. Los dos usuarios reales, con su rol =="
docker exec -e PGPASSWORD="$DB_PASSWORD" restoya_db \
    psql -U "$DB_USER" -d "$DB_NAME" -A -t \
    -c "COPY (SELECT u.* FROM usuarios u JOIN usuario_roles ur ON ur.\"usuarioId\" = u.\"usuarioId\") TO STDOUT" \
  | docker exec -i -e PGPASSWORD="$DB_PASSWORD" restoya_pg1 \
        psql -h pgbalanceador -p 5000 -U "$DB_USER" -d "$DB_NAME" -q \
        -c "COPY usuarios FROM STDIN"

docker exec -e PGPASSWORD="$DB_PASSWORD" restoya_db \
    psql -U "$DB_USER" -d "$DB_NAME" -A -t -c "COPY usuario_roles TO STDOUT" \
  | docker exec -i -e PGPASSWORD="$DB_PASSWORD" restoya_pg1 \
        psql -h pgbalanceador -p 5000 -U "$DB_USER" -d "$DB_NAME" -q \
        -c "COPY usuario_roles FROM STDIN"

echo "== 5. Control =="
docker exec -e PGPASSWORD="$DB_PASSWORD" restoya_pg1 \
    psql -h pgbalanceador -p 5000 -U "$DB_USER" -d "$DB_NAME" -A -F" | " \
    -c "SELECT 'productos' AS tabla, count(*) FROM productos
        UNION ALL SELECT 'mesas', count(*) FROM mesas
        UNION ALL SELECT 'roles', count(*) FROM roles
        UNION ALL SELECT 'usuarios', count(*) FROM usuarios
        ORDER BY 1"

echo
echo "Listo. El cluster responde por 127.0.0.1:5600 (escritura) y :5601 (lectura)."
