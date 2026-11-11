<?php
# Configuracion de MantisBT para la gestion de incidencias del proyecto
# (punto 11). Este archivo se monta dentro del contenedor y por eso vive en el
# repositorio: sin esto, la configuracion existiria solo en la maquina donde
# se instalo y nadie mas podria reproducirla.
#
# La contrasena de la base NO esta aca: sale de MANTIS_DB_PASSWORD, que vive
# en infra/compose/.env, fuera de Git.

$g_hostname               = 'mantis-db';
$g_db_type                = 'mysqli';
$g_database_name          = 'incidencias';
$g_db_username            = 'mantis';
$g_db_password            = getenv('MANTIS_DB_PASSWORD');

$g_default_timezone       = 'America/Argentina/Jujuy';

# Sal criptografica. Mantis la usa para firmar cookies y tokens; tiene que ser
# distinta en cada instalacion, por eso tambien sale del entorno.
$g_crypto_master_salt     = getenv('MANTIS_SALT');

$g_path                   = getenv('MANTIS_URL') ?: 'http://localhost:8089/';

# --- Identidad -------------------------------------------------------------
$g_default_language       = 'spanish';
$g_window_title           = 'Incidencias — RestoYa (Grupo 12)';

# --- Alta de cuentas -------------------------------------------------------
# Cerrada. Las cinco cuentas del equipo las crea el administrador. Un sistema
# de incidencias con alta libre y sin verificacion de correo es una invitacion
# al spam, y ademas rompe la trazabilidad: no se sabe quien reporto que.
$g_allow_signup           = OFF;
$g_allow_anonymous_login  = OFF;
$g_lost_password_feature  = OFF;

# --- Correo ----------------------------------------------------------------
# Mailpit hace de servidor SMTP de laboratorio: recibe todo y no manda nada
# afuera. Es lo que corresponde en un entorno de prueba, donde una
# notificacion mal dirigida llegaria a una casilla real.
$g_phpMailer_method       = PHPMAILER_METHOD_SMTP;
$g_smtp_host              = 'mantis-mail';
$g_smtp_port              = 1025;
$g_from_name              = 'Incidencias RestoYa';
$g_from_email             = 'incidencias@restoya.test';
$g_return_path_email      = 'incidencias@restoya.test';
$g_webmaster_email        = 'incidencias@restoya.test';
$g_administrator_email    = 'incidencias@restoya.test';
$g_enable_email_notification = ON;
$g_email_send_using_cronjob  = OFF;

# --- Adjuntos --------------------------------------------------------------
# En la base y no en disco: asi la copia de seguridad de Mantis es una sola
# cosa y no "la base mas una carpeta que alguien se tiene que acordar".
$g_file_upload_method     = DATABASE;
$g_max_file_size          = 5000000;
$g_allowed_files          = 'png,jpg,jpeg,gif,pdf,txt,log,csv,json,sql,sh,yml,conf';

# --- Registro de horas -----------------------------------------------------
# Hace falta para poder decir cuanto costo cada incidencia, que es parte de
# lo que el punto 11 pide documentar.
$g_time_tracking_enabled             = ON;
$g_time_tracking_view_threshold      = UPDATER;
$g_time_tracking_edit_threshold      = DEVELOPER;
$g_time_tracking_reporting_threshold = MANAGER;

# --- Flujo de trabajo ------------------------------------------------------
# Una incidencia resuelta queda de solo lectura, pero quien verifica tiene que
# poder dejar su nota antes del cierre: se baja el umbral.
$g_update_readonly_bug_threshold = UPDATER;
$g_bug_resolved_status_threshold = RESOLVED;
$g_due_date_view_threshold       = VIEWER;
$g_due_date_update_threshold     = MANAGER;

# --- API REST --------------------------------------------------------------
# La carga de las incidencias se hizo con la API, no a mano: 15 incidencias
# con notas, horas y cambios de estado son unas 120 operaciones, y hacerlas a
# mano garantiza erratas y hace imposible repetir la carga.
$g_webservice_rest_api_enabled = ON;
# Queda en ON: pedir la contrasena de nuevo para emitir un token de API es lo
# correcto. El script de carga la desactiva mientras emite los tokens y la
# vuelve a activar al terminar, pase lo que pase.
$g_reauthentication            = ON;

# --- Formulario de alta ----------------------------------------------------
# Se saca del formulario lo que decide el equipo y no quien reporta: a quien
# se asigna, la prioridad, la fecha prevista y la visibilidad.
$g_bug_report_page_fields = array(
    'category_id',
    'reproducibility',
    'severity',
    'platform',
    'os',
    'summary',
    'description',
    'steps_to_reproduce',
    'additional_info',
    'attachments',
    'tags',
);
