#!/usr/bin/env bash
# Prepara MantisBT para el punto 11: proyecto, categorias, cuentas y un token
# de API para poder cargar las incidencias desde un script.
#
#   ./infra/incidencias/preparar-mantis.sh
#
# Es idempotente: lo que ya existe no se vuelve a crear.
#
# Mantis no tiene una API para administrar usuarios ni proyectos: la API REST
# sirve para incidencias y poco mas. Para lo demas hay que usar los mismos
# formularios que usaria una persona, con su cookie de sesion y su token
# anti-CSRF. Eso es lo que hacen las funciones de abajo. No es elegante, pero
# es lo que hay, y es preferible a dejar 25 pasos manuales sin documentar.

set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
ENV="$RAIZ/infra/compose/.env"
CFG="$AQUI/config_inc.php"

# En Git Bash, $AQUI es una ruta POSIX (/c/Users/...) y el node de Windows no
# sabe resolverla: tira MODULE_NOT_FOUND. cygpath -m la deja como C:/Users/...,
# que es lo que node espera. En Linux cygpath no existe, y tampoco hace falta.
if command -v cygpath > /dev/null 2>&1; then
    AQUI_NODE="$(cygpath -m "$AQUI")"
else
    AQUI_NODE="$AQUI"
fi

[ -f "$ENV" ] || { echo "Falta $ENV" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV"; set +a

URL="http://127.0.0.1:${MANTIS_PORT:-8089}"
JAR="$(mktemp -t mantis-XXXXXX)"
DESTINO_TOKEN="$AQUI/.token-api"
PROYECTO="RestoYa"

trap 'rm -f "$JAR"' EXIT

registro() { echo "$(date '+%H:%M:%S') | mantis | $*"; }

obtener() { curl -s -b "$JAR" -c "$JAR" "$URL/$1"; }

# Saca el valor de un campo oculto de un formulario.
campo() { obtener "$1" | tr '>' '\n' | grep -oP "name=[\"']$2[\"'][^<]*value=[\"']\K[^\"']+" | head -1 || true; }

# -----------------------------------------------------------------------------
# 0. Esperar a que conteste algo.
#
# OJO: aca no sirve "curl -fsS", que falla con cualquier codigo >= 400. Mantis
# sin instalar devuelve 500 en todas sus paginas, porque las tablas no existen
# todavia; esperando un 200 nos quedariamos 300 s y saldriamos con error justo
# antes de instalarlo. Lo que se espera aca es que el servidor conteste, sea lo
# que sea.
# -----------------------------------------------------------------------------
codigo_login() {
    curl -s -o /dev/null -w '%{http_code}' "$URL/login_page.php" 2>/dev/null || echo 000
}

registro "Esperando a Mantis en $URL."
for i in $(seq 1 60); do
    c=$(codigo_login)
    [ "$c" != "000" ] && break
    [ "$i" = 60 ] && { echo "No respondio en 300 s." >&2; exit 1; }
    sleep 5
done
registro "Responde (HTTP $c)."

# -----------------------------------------------------------------------------
# 0b. Instalar el esquema, si la base esta vacia.
#
# La imagen no instala nada: trae MantisBT y Apache, y nada mas. El esquema lo
# crea admin/install.php, que es un formulario web. Y el entrypoint de la imagen
# ESCONDE la carpeta admin/ salvo que MANTIS_ENABLE_ADMIN valga 1.
#
# Que este escondida es correcto y no se cambia: admin/ trae el instalador y las
# herramientas de mantenimiento, asi que con esa carpeta publicada cualquiera que
# llegue al puerto puede reinstalar la base encima. Entonces se enciende para
# instalar, se instala, y se vuelve a apagar.
# -----------------------------------------------------------------------------
COMPOSE="$RAIZ/infra/compose/docker-compose.yml"

recrear_mantis() {
    MANTIS_ENABLE_ADMIN="$1" docker compose -f "$COMPOSE" --profile incidencias \
        up -d --force-recreate mantis > /dev/null 2>&1
    for _ in $(seq 1 30); do
        [ "$(codigo_login)" != "000" ] && return 0
        sleep 2
    done
    return 1
}

if [ "$(codigo_login)" = "200" ]; then
    registro "El esquema ya esta instalado."
else
    registro "La base esta vacia: hay que instalar el esquema."
    registro "Encendiendo admin/ SOLO para instalar."
    recrear_mantis 1 || { echo "Mantis no volvio con admin/ encendida." >&2; exit 1; }

    # admin_username y admin_password son las credenciales con las que el
    # instalador CREARIA la base si no existiera. Aca la crea el contenedor de
    # MariaDB, asi que van vacias a proposito: el usuario "mantis" ya tiene lo
    # que necesita sobre su propia base y no hace falta darle el root del motor.
    salida=$(curl -s -X POST \
        -d "install=2" \
        -d "db_type=mysqli" \
        -d "hostname=mantis-db" \
        -d "db_username=mantis" \
        --data-urlencode "db_password=${MANTIS_DB_PASSWORD}" \
        -d "database_name=incidencias" \
        -d "admin_username=" -d "admin_password=" \
        -d "db_table_prefix=mantis" \
        -d "db_table_plugin_prefix=plugin" \
        -d "db_table_suffix=_table" \
        -d "timezone=America/Argentina/Jujuy" \
        -d "go=Install/Upgrade+Database" \
        "$URL/admin/install.php")

    registro "Apagando admin/ de nuevo."
    recrear_mantis 0 || { echo "Mantis no volvio con admin/ apagada." >&2; exit 1; }

    c=$(codigo_login)
    if [ "$c" != "200" ]; then
        echo "El instalador no dejo la base usable (login_page.php da HTTP $c)." >&2
        echo "Lo que contesto el instalador:" >&2
        echo "$salida" | sed 's/<[^>]*>//g' | sed '/^[[:space:]]*$/d' | tail -25 >&2
        exit 1
    fi
    registro "Esquema instalado y admin/ escondida de nuevo."
fi

# -----------------------------------------------------------------------------
# 1. Entrar como administrador.
#
# La instalacion por defecto de esta imagen crea administrator/root. Lo
# primero que hace este script es cambiar esa clave: dejar administrator/root
# en una herramienta que publica puerto, aunque sea en 127.0.0.1, es dejar la
# puerta abierta.
# -----------------------------------------------------------------------------
entrar() {
    local usuario="$1" clave="$2" tok
    : > "$JAR"
    tok=$(campo "login_page.php" "login_token")
    curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST \
        -d "return=index.php" -d "login_token=$tok" \
        -d "username=$usuario" --data-urlencode "password=$clave" \
        "$URL/login.php"
    obtener "my_view_page.php" | grep -q "logout_page.php"
}

CLAVE_ADMIN="${MANTIS_ADMIN_PASSWORD:-}"
if [ -n "$CLAVE_ADMIN" ] && entrar administrator "$CLAVE_ADMIN"; then
    registro "Entrado como administrator."
elif entrar administrator root; then
    registro "Entrado con la clave por defecto. Se cambia ya mismo."
    CLAVE_ADMIN="$(head -c 18 /dev/urandom | base64 | tr -d '/+=')"
    tok=$(campo "account_page.php" "account_update_token")
    curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST \
        -d "account_update_token=$tok" \
        --data-urlencode "password_current=root" \
        --data-urlencode "password=$CLAVE_ADMIN" \
        --data-urlencode "password_confirm=$CLAVE_ADMIN" \
        "$URL/account_update.php"
    printf '\n# Clave de administrator de Mantis, cambiada por preparar-mantis.sh\nMANTIS_ADMIN_PASSWORD=%s\n' \
        "$CLAVE_ADMIN" >> "$ENV"
    registro "Clave cambiada. Quedo en infra/compose/.env; no se imprime."
    if ! entrar administrator "$CLAVE_ADMIN"; then
        echo "El cambio de clave no se aplico." >&2
        if entrar administrator root; then
            echo "La clave de fabrica sigue sirviendo: el formulario descarto el cambio." >&2
            echo "Mantis exige el campo password_current en account_update.php." >&2
        fi
        exit 1
    fi
else
    echo "No se pudo entrar. Si ya cambiaste la clave a mano, ponela en MANTIS_ADMIN_PASSWORD." >&2
    exit 1
fi

# -----------------------------------------------------------------------------
# 2. Proyecto.
# -----------------------------------------------------------------------------
if obtener "manage_proj_page.php" | grep -q ">$PROYECTO<"; then
    registro "El proyecto $PROYECTO ya existe."
else
    tok=$(campo "manage_proj_create_page.php" "manage_proj_create_token")
    curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST \
        -d "manage_proj_create_token=$tok" \
        --data-urlencode "name=$PROYECTO" \
        -d "status=10" -d "view_state=10" -d "inherit_global=1" \
        --data-urlencode "description=Practica Integradora Final de HIA 2026, Grupo 12. Incidencias reales detectadas durante el desarrollo." \
        "$URL/manage_proj_create.php"
    registro "Proyecto creado."
fi

ID_PROYECTO=$(obtener "manage_proj_page.php" \
    | grep -oP "project_id=\K[0-9]+(?=[^>]*>$PROYECTO<)" | head -1 || true)
[ -n "$ID_PROYECTO" ] || { echo "No se pudo averiguar el id del proyecto." >&2; exit 1; }
registro "Proyecto $PROYECTO = id $ID_PROYECTO."

# -----------------------------------------------------------------------------
# 3. Categorias.
#
# Salen del JSON, para que la lista este en un solo lugar.
# -----------------------------------------------------------------------------
registro "Categorias."
node -e 'const d=require("'"$AQUI_NODE"'/incidencias.json");console.log(d.categorias.join("\n"))' | while read -r cat; do
    [ -z "$cat" ] && continue
    if obtener "manage_proj_edit_page.php?project_id=$ID_PROYECTO" | grep -qF ">$cat<"; then
        continue
    fi
    tok=$(campo "manage_proj_edit_page.php?project_id=$ID_PROYECTO" "manage_proj_cat_add_token")
    curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST \
        -d "manage_proj_cat_add_token=$tok" -d "project_id=$ID_PROYECTO" \
        --data-urlencode "name=$cat" \
        "$URL/manage_proj_cat_add.php"
    registro "  + $cat"
done

# -----------------------------------------------------------------------------
# 4. Cuentas.
#
# Mantis manda un correo de alta con un enlace para fijar la clave. Como el
# SMTP es Mailpit, esos correos no salen a ningun lado: quedan en el buzon de
# laboratorio, que es exactamente lo que queremos para una demostracion.
# -----------------------------------------------------------------------------
registro "Cuentas."
node -e 'const d=require("'"$AQUI_NODE"'/incidencias.json");for(const u of d.usuarios)console.log([u.usuario,u.nombre,u.email,u.acceso].join("|"))' \
| while IFS='|' read -r usuario nombre email acceso; do
    [ -z "$usuario" ] && continue
    if obtener "manage_user_page.php?search=$usuario" | grep -q ">$usuario<"; then
        registro "  = $usuario (ya existe)"
        continue
    fi
    case "$acceso" in
        manager)   nivel=70 ;;
        developer) nivel=55 ;;
        *)         nivel=25 ;;
    esac
    tok=$(campo "manage_user_create_page.php" "manage_user_create_token")
    curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST \
        -d "manage_user_create_token=$tok" \
        --data-urlencode "username=$usuario" \
        --data-urlencode "realname=$nombre" \
        --data-urlencode "email=$email" \
        -d "access_level=$nivel" -d "enabled=on" -d "protected=" \
        "$URL/manage_user_create.php"
    registro "  + $usuario ($acceso)"
done

# -----------------------------------------------------------------------------
# 5. Token de API para cargar las incidencias.
#
# Mantis pide reautenticarse para emitir un token, y eso no se puede responder
# desde un script. Se desactiva mientras dura la emision y se vuelve a activar
# al terminar PASE LO QUE PASE: el trap es lo importante de este bloque.
# -----------------------------------------------------------------------------
restaurar_reautenticacion() {
    sed -i 's/^\$g_reauthentication            = OFF;/$g_reauthentication            = ON;/' "$CFG" 2>/dev/null || true
}

if [ -s "$DESTINO_TOKEN" ]; then
    registro "Ya hay un token guardado. No se emite otro."
else
    trap 'restaurar_reautenticacion; rm -f "$JAR"' EXIT
    sed -i 's/^\$g_reauthentication            = ON;/$g_reauthentication            = OFF;/' "$CFG"
    sleep 2

    tok=$(campo "api_tokens_page.php" "create_api_token_form_token")
    nombre_token="carga-$(date +%Y%m%d%H%M%S)"
    TOKEN=$(curl -s -b "$JAR" -c "$JAR" -X POST \
        -d "create_api_token_form_token=$tok" \
        --data-urlencode "token_name=$nombre_token" \
        "$URL/api_token_create.php" \
        | grep -oP '<div class="well">\K[^<]+' | head -1 || true)

    restaurar_reautenticacion
    trap 'rm -f "$JAR"' EXIT

    if [ -z "$TOKEN" ]; then
        echo "No se pudo emitir el token de API." >&2
        exit 1
    fi
    printf '%s' "$TOKEN" > "$DESTINO_TOKEN"
    chmod 600 "$DESTINO_TOKEN"
    registro "Token emitido y guardado en infra/incidencias/.token-api (ignorado por Git)."
fi

registro "Listo. Ahora: node infra/incidencias/cargar-incidencias.js"
echo
echo "Mantis:  $URL"
echo "Buzon:   http://127.0.0.1:${MAILPIT_PORT:-8025}"
