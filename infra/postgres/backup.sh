#!/bin/sh
# Servicio de copias de seguridad. Corre en bucle dentro de su propio
# contenedor, sobre la red interna: nunca expone la base hacia afuera.
#
# Cada ciclo: pg_dump comprimido -> verificacion -> rotacion -> bitacora.

set -u

DESTINO=/backups
BITACORA="$DESTINO/backups.log"

mkdir -p "$DESTINO"

registrar() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') | $1" | tee -a "$BITACORA"
}

registrar "Servicio iniciado. Intervalo: ${INTERVALO_SEGUNDOS}s. Retiene: ${RETENER} copias."

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

        # Verificacion: si el volcado esta corrupto, pg_restore -l falla.
        if pg_restore -l "$ARCHIVO" >/dev/null 2>&1; then
            registrar "OK   | ${ARCHIVO##*/} | ${TAMANIO} | ${SEGUNDOS}s | verificado"
        else
            registrar "AVISO| ${ARCHIVO##*/} | el volcado no pasa la verificacion"
        fi
    else
        registrar "ERROR| fallo pg_dump, ver detalle arriba"
    fi

    # Rotacion: deja las N mas nuevas.
    ls -1t "$DESTINO"/${PGDATABASE}-*.dump 2>/dev/null \
        | tail -n +$((RETENER + 1)) \
        | while read -r VIEJO; do
            rm -f "$VIEJO"
            registrar "ROTA | ${VIEJO##*/} eliminada por retencion"
        done

    sleep "$INTERVALO_SEGUNDOS"
done
