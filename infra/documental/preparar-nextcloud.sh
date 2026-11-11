#!/usr/bin/env bash
# Prepara Nextcloud para el punto 12: grupos, cuentas, estructura de carpetas,
# permisos y carga de la documentacion del proyecto.
#
#   ./infra/documental/preparar-nextcloud.sh
#
# Es idempotente: se puede correr las veces que haga falta. Lo que ya existe
# no se vuelve a crear ni se pisa.
#
# Las contrasenas salen de infra/compose/.env y NO se imprimen. La del
# administrador ya existe ahi; las de las cuentas nuevas se generan aca y se
# anexan al mismo archivo, que esta en .gitignore.

set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
ENV="$RAIZ/infra/compose/.env"
CONTENEDOR="restoya_nextcloud"

[ -f "$ENV" ] || { echo "Falta $ENV" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; . "$ENV"; set +a

PUERTO="${NEXTCLOUD_PORT:-8081}"
URL="http://127.0.0.1:$PUERTO"
ADMIN="${NEXTCLOUD_ADMIN_USER:-admin}"

registro() { echo "$(date '+%H:%M:%S') | nextcloud | $*"; }

occ() { docker exec -u www-data "$CONTENEDOR" php occ "$@"; }

# -----------------------------------------------------------------------------
# 0. Esperar a que este instalado.
# -----------------------------------------------------------------------------
registro "Esperando a Nextcloud."
for i in $(seq 1 60); do
    if occ status 2>/dev/null | grep -q "installed: true"; then break; fi
    [ "$i" = 60 ] && { echo "No termino de instalarse en 300 s." >&2; exit 1; }
    sleep 5
done
registro "Instalado."

# -----------------------------------------------------------------------------
# 1. Grupos.
#
# Tres, y no uno por persona: los permisos se dan a grupos porque cuando entre
# o salga alguien hay que tocar una sola cosa. Dar permisos por persona es lo
# que produce las carpetas a las que todavia accede gente que se fue.
# -----------------------------------------------------------------------------
registro "Grupos."
for g in equipo automatizacion lectura; do
    occ group:list | grep -q "  - $g" || occ group:add "$g"
done

# -----------------------------------------------------------------------------
# 2. Cuentas.
#
# "automatizacion" es la cuenta que usa n8n. Es una cuenta aparte y no la del
# administrador a proposito: si manana hay que cortarle el acceso al robot, se
# desactiva esa cuenta y nada mas. Y en el registro de auditoria se ve cual
# subida la hizo una persona y cual un flujo.
# -----------------------------------------------------------------------------
clave_nueva() { head -c 18 /dev/urandom | base64 | tr -d '/+=' ; }

crear_cuenta() {
    local usuario="$1" nombre="$2" grupo="$3" var="$4"
    if occ user:list | grep -q "  - $usuario:"; then
        registro "La cuenta $usuario ya existe."
        return
    fi
    local clave
    if [ -n "${!var:-}" ]; then clave="${!var}"; else
        clave="$(clave_nueva)"
        printf '\n# Cuenta de Nextcloud creada por preparar-nextcloud.sh\n%s=%s\n' "$var" "$clave" >> "$ENV"
    fi
    OC_PASS="$clave" docker exec -u www-data -e OC_PASS="$clave" "$CONTENEDOR" \
        php occ user:add --password-from-env --display-name="$nombre" --group="$grupo" "$usuario" >/dev/null
    registro "Cuenta $usuario creada. La clave quedo en infra/compose/.env."
}

registro "Cuentas."
crear_cuenta garamayo "Aramayo, Gerardo Leonel" equipo NC_PASS_GARAMAYO
crear_cuenta jarmella "Armella, Julian Enrique"  equipo NC_PASS_JARMELLA
crear_cuenta fcruz    "Cruz, Florencia Agustina" equipo NC_PASS_FCRUZ
crear_cuenta fpol     "Pol, Jaime Facundo"       equipo NC_PASS_FPOL
crear_cuenta gprieto  "Prieto, Gabriel Arturo"   equipo NC_PASS_GPRIETO
crear_cuenta automatizacion "n8n (robot)"        automatizacion NC_PASS_BOT

# -----------------------------------------------------------------------------
# 3. Estructura de carpetas, por WebDAV.
#
# La numeracion no es decorativa: ordena las carpetas por el momento del
# proyecto en el que se usan, que es como la gente las busca.
# -----------------------------------------------------------------------------
carpeta() {
    local ruta="$1"
    local codigo
    codigo=$(curl -s -o /dev/null -w '%{http_code}' -X MKCOL \
        -u "$ADMIN:$NEXTCLOUD_ADMIN_PASSWORD" \
        "$URL/remote.php/dav/files/$ADMIN/$ruta")
    case "$codigo" in
        201) registro "Creada: $ruta" ;;
        405) ;;  # ya existia
        *)   echo "No se pudo crear $ruta (HTTP $codigo)" >&2; return 1 ;;
    esac
}

registro "Estructura de carpetas."
carpeta "RestoYa"
carpeta "RestoYa/01-Gestion"
carpeta "RestoYa/01-Gestion/Actas"
carpeta "RestoYa/01-Gestion/Sprints"
carpeta "RestoYa/02-Arquitectura"
carpeta "RestoYa/02-Arquitectura/Diagramas"
carpeta "RestoYa/03-Configuraciones"
carpeta "RestoYa/03-Configuraciones/Docker"
carpeta "RestoYa/03-Configuraciones/Monitoreo"
carpeta "RestoYa/04-Informes"
carpeta "RestoYa/04-Informes/Optimizacion"
carpeta "RestoYa/04-Informes/Replicacion"
carpeta "RestoYa/04-Informes/Seguridad"
carpeta "RestoYa/04-Informes/Rendimiento"
carpeta "RestoYa/05-Evidencias"
carpeta "RestoYa/05-Evidencias/Backups"
carpeta "RestoYa/05-Evidencias/CICD"
carpeta "RestoYa/06-Entrega"

# -----------------------------------------------------------------------------
# 4. Documentacion del proyecto.
#
# Se suben los informes que ya estan escritos. El repositorio sigue siendo la
# fuente: esto es la copia para leer y comentar, que es lo que pide el punto
# 12. Si divergen, manda el repositorio.
# -----------------------------------------------------------------------------
subir() {
    local origen="$1" destino="$2"
    [ -f "$origen" ] || { registro "No esta: $origen (se omite)"; return 0; }
    local codigo
    codigo=$(curl -s -o /dev/null -w '%{http_code}' -T "$origen" \
        -u "$ADMIN:$NEXTCLOUD_ADMIN_PASSWORD" \
        "$URL/remote.php/dav/files/$ADMIN/$destino")
    case "$codigo" in
        201|204) registro "Subido: $destino" ;;
        *) echo "No se pudo subir $destino (HTTP $codigo)" >&2; return 1 ;;
    esac
}

registro "Documentacion."
subir "$RAIZ/README.md"                   "RestoYa/README.md"
subir "$RAIZ/docs/05-docker.md"           "RestoYa/03-Configuraciones/Docker/05-docker.md"
subir "$RAIZ/docs/06-carga-datos.md"      "RestoYa/02-Arquitectura/06-carga-datos.md"
subir "$RAIZ/docs/07-optimizacion-sql.md" "RestoYa/04-Informes/Optimizacion/07-optimizacion-sql.md"
subir "$RAIZ/docs/08-monitoreo.md"        "RestoYa/03-Configuraciones/Monitoreo/08-monitoreo.md"
subir "$RAIZ/docs/09-seguridad.md"        "RestoYa/04-Informes/Seguridad/09-seguridad.md"
subir "$RAIZ/docs/10-cluster.md"          "RestoYa/04-Informes/Replicacion/10-cluster.md"
subir "$RAIZ/docs/11-cicd.md"             "RestoYa/05-Evidencias/CICD/11-cicd.md"
subir "$RAIZ/docs/12-incidencias.md"      "RestoYa/01-Gestion/12-incidencias.md"
subir "$RAIZ/docs/13-documental.md"       "RestoYa/01-Gestion/13-documental.md"
subir "$RAIZ/docs/14-automatizacion.md"   "RestoYa/01-Gestion/14-automatizacion.md"

# -----------------------------------------------------------------------------
# 5. Permisos.
#
# Nextcloud: 1 leer, 2 actualizar, 4 crear, 8 borrar, 16 volver a compartir.
#
#   31 = todo
#   15 = leer, crear, actualizar y borrar, PERO no volver a compartir
#    1 = solo leer
#
# Que nadie pueda volver a compartir es deliberado: el punto 12 pide verificar
# el acceso solo de los usuarios autorizados, y eso se vuelve imposible si
# cualquiera puede generar un enlace publico desde adentro.
# -----------------------------------------------------------------------------
compartir() {
    local ruta="$1" grupo="$2" permisos="$3"
    local codigo
    # OJO con la ruta: va SIN barra inicial. Con "path=/RestoYa" el OCS
    # responde 404 "Wrong path, file/folder does not exist" aunque la carpeta
    # exista y este indexada; con "path=RestoYa" responde 200.
    codigo=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
        -u "$ADMIN:$NEXTCLOUD_ADMIN_PASSWORD" \
        -H "OCS-APIRequest: true" \
        -d "path=$ruta" -d "shareType=1" -d "shareWith=$grupo" -d "permissions=$permisos" \
        "$URL/ocs/v2.php/apps/files_sharing/api/v1/shares")
    case "$codigo" in
        200) registro "Compartida $ruta con $grupo (permisos $permisos)." ;;
        400|403) ;;  # ya estaba compartida
        *) echo "No se pudo compartir $ruta con $grupo (HTTP $codigo)" >&2 ;;
    esac
}

registro "Permisos."
# El equipo trabaja sobre todo el proyecto, pero no puede volver a compartir.
compartir "RestoYa" equipo 15
# El robot entra SOLO a la carpeta donde deja sus informes, y solo puede
# crear: no borra ni modifica lo que ya esta. Si el flujo se vuelve loco,
# lo peor que hace es llenar esa carpeta de archivos.
compartir "RestoYa/04-Informes/Rendimiento" automatizacion 5
# El grupo "lectura" existe para la defensa: una cuenta que mira y no toca.
compartir "RestoYa" lectura 1

# -----------------------------------------------------------------------------
# 6. Endurecer.
# -----------------------------------------------------------------------------
# El nombre interno del contenedor tiene que estar en trusted_domains, o
# Nextcloud rechaza con HTTP 400 todo pedido cuya cabecera Host sea
# "nextcloud". Desde el navegador no se nota, porque ahi el Host es
# 127.0.0.1; lo que se rompe es que OTRO servicio del grupo le hable por su
# nombre de red, que es justo lo que hace el flujo F03 del punto 13 para subir
# su informe. El indice 1 venia con un "localhost" repetido.
occ config:system:set trusted_domains 1 --value=nextcloud >/dev/null

registro "Ajustes de seguridad."
# Sin esto, cualquiera del equipo puede generar un enlace publico sin clave y
# el control de acceso del punto 12 deja de significar nada.
occ config:app:set core shareapi_allow_links --value="no"
occ config:app:set core shareapi_enforce_links_password --value="yes"
# El registro de auditoria es lo que permite responder "quien bajo que y
# cuando", que es la mitad de lo que sirve tener gestion documental.
# Sin esto la auditoria no sirve de nada: admin_audit escribe sus anotaciones
# en nivel "info" y el nivel por defecto de Nextcloud es "warning" (2), asi que
# el archivo queda en cero bytes y parece que estuviera funcionando. Se comprobo
# generando una accion y mirando el archivo, no leyendo la documentacion.
occ config:system:set loglevel --value=1 >/dev/null

occ app:enable admin_audit >/dev/null 2>&1 || registro "admin_audit no disponible en esta imagen."
# Esta es la unica llamada con una ruta absoluta como argumento, y Git Bash la
# reescribiria a C:/Program Files/Git/var/... MSYS_NO_PATHCONV va SOLO aca y no
# exportada para todo el script: con ella puesta, el -o /dev/null de curl deja
# de traducirse al dispositivo nulo de Windows y curl sale con el codigo 23.
# Se llama a docker exec directo y no a la funcion occ, porque una asignacion
# delante de una funcion de shell no se comporta igual que delante de un
# programa.
MSYS_NO_PATHCONV=1 docker exec -u www-data "$CONTENEDOR" php occ \
    config:app:set admin_audit logfile --value="/var/www/html/data/audit.log" \
    2>/dev/null || true

registro "Listo."
echo
echo "Nextcloud: $URL"
echo "Las claves de las cuentas nuevas quedaron en infra/compose/.env."
echo "Ninguna se imprimio en pantalla."
