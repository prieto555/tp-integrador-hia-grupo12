#!/bin/sh
# Servicio de copias de seguridad. Corre en bucle dentro de su propio
# contenedor, sobre la red interna: nunca expone la base hacia afuera.
#
# Cada ciclo: pg_dump comprimido -> verificacion -> rotacion -> bitacora.
#
# REGLA QUE ORGANIZA TODO ESTE GUION: una copia solo cuenta como copia si
# esta verificada. Si el volcado falla o no pasa la verificacion, el archivo
# se borra y NO se rota. Ver la seccion "Por que" al final.

set -u

DESTINO=/backups
BITACORA="$DESTINO/backups.log"

mkdir -p "$DESTINO"

registrar() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') | $1" | tee -a "$BITACORA"
}

# Deja las N copias validas mas nuevas. Solo se llama despues de un volcado
# verificado: rotar despues de un fallo es cambiar una copia buena por nada.
rotar() {
    ls -1t "$DESTINO"/${PGDATABASE}-*.dump 2>/dev/null \
        | tail -n +$((RETENER + 1)) \
        | while read -r VIEJO; do
            rm -f "$VIEJO"
            registrar "ROTA | ${VIEJO##*/} eliminada por retencion"
        done
}

registrar "Servicio iniciado. Intervalo: ${INTERVALO_SEGUNDOS}s. Retiene: ${RETENER} copias."

# Esperar a que la base acepte conexiones ANTES del primer volcado.
#
# Sin esto, el servicio arranca junto con el resto del stack, le pega a una
# base que todavia no termino de levantar y el primer volcado falla siempre.
# Es lo que llenaba la carpeta de archivos de 0 bytes: un fallo por cada
# arranque, y en esta maquina el motor de Docker se cayo cuatro veces el
# 11/11.
ESPERA=0
until pg_isready -q 2>/dev/null; do
    ESPERA=$((ESPERA + 2))
    if [ "$ESPERA" -ge 120 ]; then
        registrar "ERROR| la base no acepto conexiones en 120s; se intenta igual"
        break
    fi
    sleep 2
done
[ "$ESPERA" -gt 0 ] && [ "$ESPERA" -lt 120 ] \
    && registrar "Base lista tras ${ESPERA}s de espera."

while true; do
    MARCA=$(date '+%Y%m%d-%H%M%S')
    ARCHIVO="$DESTINO/${PGDATABASE}-${MARCA}.dump"

    INICIO=$(date +%s)

    # Formato custom (-Fc): comprimido y restaurable con pg_restore de forma
    # selectiva, a diferencia del .sql plano.
    if pg_dump -Fc -f "$ARCHIVO" 2>>"$BITACORA"; then
        FIN=$(date +%s)
        SEGUNDOS=$((FIN - INICIO))
        TAMANIO=$(du -h "$ARCHIVO" | cut -f1)

        # Dos comprobaciones, no una:
        #   -s  el archivo existe y NO esta vacio. pg_dump puede salir con 0 y
        #       dejar un archivo de 0 bytes si lo matan a mitad de camino.
        #   pg_restore -l  el volcado se puede leer; si esta corrupto, falla.
        if [ -s "$ARCHIVO" ] && pg_restore -l "$ARCHIVO" >/dev/null 2>&1; then
            registrar "OK   | ${ARCHIVO##*/} | ${TAMANIO} | ${SEGUNDOS}s | verificado"
            rotar
        else
            rm -f "$ARCHIVO"
            registrar "AVISO| ${ARCHIVO##*/} | no paso la verificacion; archivo descartado, NO se rota"
        fi
    else
        # pg_dump -f deja el archivo creado aunque falle. Si queda, el proximo
        # ls -1t lo ve como la copia mas nueva y empuja una buena fuera de la
        # retencion.
        rm -f "$ARCHIVO"
        registrar "ERROR| fallo pg_dump, ver detalle arriba; archivo descartado, NO se rota"
    fi

    sleep "$INTERVALO_SEGUNDOS"
done

# ---------------------------------------------------------------------------
# Por que esta escrito asi
#
# El 11/11, corriendo la lista de PROBAR.md, la carpeta tenia cuatro archivos
# de 0 bytes y tres copias buenas. El registro mostraba el mismo patron en
# cada arranque:
#
#     22:07:59 | Servicio iniciado. Intervalo: 3600s. Retiene: 7 copias.
#     22:07:59 | ERROR| fallo pg_dump, ver detalle arriba
#     22:07:59 | ROTA | restoyadb-20261110-162016.dump eliminada por retencion
#
# Tres errores encadenados, y el tercero es el grave:
#
#   1. El primer volcado salia antes de que la base estuviera lista y fallaba.
#   2. El archivo de 0 bytes quedaba en disco.
#   3. La rotacion corria IGUAL -estaba fuera del if- y ademas contaba al
#      archivo vacio como la copia mas nueva, asi que empujaba una copia buena
#      fuera de la retencion.
#
# O sea que cada reinicio del stack cambiaba una copia valida por una vacia.
# Con siete de retencion y unos cuantos reinicios, la carpeta se queda sin
# nada util y parece llena.
#
# Una copia de 0 bytes es peor que no tener copia, porque parece respaldo.
# Y el flujo F02 de n8n, que verifica las copias, busca *.dump: con un archivo
# vacio ahi, o da por buena una copia que no sirve o abre una incidencia falsa.
# ---------------------------------------------------------------------------
