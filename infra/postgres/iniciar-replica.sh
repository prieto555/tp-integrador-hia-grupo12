#!/bin/sh
# Arranque de la replica (punto 6, tarea E6-01).
#
# Una replica no se "configura": se CLONA. PostgreSQL no replica tabla por
# tabla sino bloque por bloque del archivo, asi que la replica tiene que
# empezar siendo una copia binaria exacta del primario y, a partir de ahi,
# seguir aplicando el WAL que el primario le manda.
#
# Este script hace eso una sola vez y despues arranca PostgreSQL normal:
#
#   1. si el directorio de datos esta vacio, lo clona con pg_basebackup;
#   2. si ya tiene datos, no toca nada y arranca.
#
# Es idempotente a proposito: "docker compose up -d" se puede correr las veces
# que haga falta y la segunda no vuelve a copiar cuatro gigas.
#
# Corre como root para poder preparar los permisos del volumen, y baja a
# postgres con su-exec para todo lo demas. PostgreSQL se niega a arrancar como
# root, y con razon.

set -eu

: "${PGDATA:?falta PGDATA}"
: "${PRIMARIO_HOST:?falta PRIMARIO_HOST}"
: "${PRIMARIO_PUERTO:=5432}"
: "${REPLICACION_USER:?falta REPLICACION_USER}"
: "${REPLICACION_PASSWORD:?falta REPLICACION_PASSWORD}"
: "${RANURA:=replica_1}"

registro() { echo "$(date '+%Y-%m-%d %H:%M:%S') | replica | $*"; }

# Docker crea el volumen nuevo como root. Sin esto, pg_basebackup no puede
# escribir y PostgreSQL rechaza un directorio con permisos abiertos.
mkdir -p "$PGDATA"
chown -R postgres:postgres "$PGDATA"
chmod 0700 "$PGDATA"

if [ -s "$PGDATA/PG_VERSION" ]; then
    registro "Ya hay datos en $PGDATA. No se clona de nuevo."
else
    registro "Directorio vacio: clonando desde $PRIMARIO_HOST:$PRIMARIO_PUERTO."

    # Esperar a que el primario acepte conexiones. Sin esto la primera corrida
    # falla por carrera: compose arranca los dos contenedores casi juntos.
    until su-exec postgres pg_isready -h "$PRIMARIO_HOST" -p "$PRIMARIO_PUERTO" -q; do
        registro "El primario todavia no responde. Reintento en 3 s."
        sleep 3
    done

    # La contrasena viaja por variable de entorno y no por la linea de
    # comandos, que seria visible en "ps".
    export PGPASSWORD="$REPLICACION_PASSWORD"

    # -Fp      formato plano: el directorio queda listo para arrancar tal cual.
    # -Xs      trae el WAL por streaming MIENTRAS copia. Sin esto, en una base
    #          grande el WAL generado durante la copia puede reciclarse antes
    #          de que termine, y la copia queda inservible.
    # -R       escribe standby.signal y primary_conninfo: es lo que convierte
    #          al directorio copiado en una replica y no en otra base suelta.
    # -S       usa la ranura de replicacion, que es lo que impide que el
    #          primario borre WAL que la replica todavia no aplico.
    # -c fast  fuerza un checkpoint ya, en vez de esperar al proximo.
    su-exec postgres pg_basebackup \
        -h "$PRIMARIO_HOST" \
        -p "$PRIMARIO_PUERTO" \
        -U "$REPLICACION_USER" \
        -D "$PGDATA" \
        -Fp -Xs -R -P \
        -S "$RANURA" \
        -c fast

    unset PGPASSWORD

    chown -R postgres:postgres "$PGDATA"
    chmod 0700 "$PGDATA"

    # OJO: la contrasena quedo escrita en primary_conninfo, dentro de
    # postgresql.auto.conf, en el volumen. Es como lo hace pg_basebackup -R y
    # no esta en el repositorio, pero conviene saberlo antes de copiar ese
    # volumen a otro lado.
    registro "Clonado. El directorio tiene standby.signal, asi que arranca como replica."
fi

registro "Arrancando PostgreSQL en modo replica."

# Se entrega el control al entrypoint de la imagen oficial, que hace el resto:
# baja a postgres, maneja las senales y ejecuta el servidor como PID 1.
exec docker-entrypoint.sh postgres
