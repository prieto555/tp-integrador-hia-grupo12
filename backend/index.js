require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./config/database");
const cocinaRoutes = require("./src/routes/cocina.route");
var app = express();

// middlewares de seguridad
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Detras de nginx. Sin esto, express-rate-limit ve la cabecera
// X-Forwarded-For que pone el proxy, no confia en ella, y lanza
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR en cada peticion: sin un cliente que
// identificar, el limite de intentos de login no limita nada.
// El 1 es la cantidad de saltos de confianza: exactamente nginx, no mas.
app.set('trust proxy', 1);

//middlewares
app.use(helmet()); // Protege cabeceras HTTP

// E14-03. Antes esto era max: 100, con el comentario "Aumentado a 100 para
// permitir pruebas intensivas sin bloqueos". Cien intentos de inicio de sesion
// cada quince minutos por IP no es un limite: es un permiso para probar
// contrasenas. Con una lista de las mil mas usadas, son dos horas y media.
//
// Diez es el valor habitual. Una persona que se equivoca la reintenta dos o
// tres veces, no diez. Si hace falta subirlo para probar, se sube por variable
// de entorno y no tocando el codigo, que es como quedo en cien y nadie se
// acordo de bajarlo.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LIMITE_LOGIN) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiados intentos de inicio de sesión, intente de nuevo en 15 minutos." }
});

// Limitador general para toda la API. El de arriba cuida el inicio de sesion;
// este cuida al resto, que antes no tenia ninguno. No esta para frenar un
// ataque grande (para eso hace falta algo delante del servidor), sino para que
// un script suelto no voltee el servicio solo.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.LIMITE_API) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas peticiones, espere un momento." }
});

// El chatbot aparte, y mucho mas apretado.
//
// POST /api/chatbot no pide autenticacion y reenvia la consulta a la API de
// Gemini con la clave del proyecto. Sin limite, cualquiera que llegue a la API
// puede gastar la cuota ajena, o la plata ajena si la cuenta es paga. Es el
// endpoint mas caro del sistema por peticion.
const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.LIMITE_CHATBOT) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas consultas al asistente, espere un momento." }
});

// Metricas para Prometheus (punto 10). Va antes de las rutas para medirlas
// todas, pero mide al terminar la peticion, que es cuando se sabe que ruta
// matcheo y con que codigo se respondio.
const { medirPeticiones, servirMetricas } = require('./src/middlewares/metricas.middleware');
app.use(medirPeticiones);

// /metrics NO va bajo /api a proposito: nginx solo hace de proxy de /api/,
// asi que esta ruta no es alcanzable desde el navegador. Solo la ve
// Prometheus, por la red interna de Docker.
app.get('/metrics', servirMetricas);

app.use(express.json());

// Inyectamos nuestro Middleware Global de Auditoría
const auditarAccion = require('./src/middlewares/auditoria.middleware');
app.use(auditarAccion);
// E14-01. La version anterior tenia esta condicion:
//
//     origin.includes('onrender.com')
//
// Parece una lista blanca y no lo es. Ese includes es
// String.prototype.includes, que busca una SUBCADENA, no
// Array.prototype.includes, que compara el elemento entero. Dos metodos con el
// mismo nombre y semanticas distintas, en la misma linea que el correcto
// (permitidos.includes(origin), ese si compara entero).
//
// Consecuencia: https://onrender.com.sitio-falso.net pasa el filtro, porque
// contiene la cadena "onrender.com". Tambien pasa cualquier dominio que la
// contenga en cualquier posicion. Alcanza con registrar uno.
//
// Ahora la lista es exacta y sale de una variable de entorno, asi que cambiar
// de dominio no es tocar codigo.
//
// Vale aclarar que CORS protege AL NAVEGADOR DE OTRO SITIO, no a la API: quien
// use curl o Postman no manda cabecera Origin y no hay nada que comparar. Lo
// que protege a la API es la autenticacion. Por eso las peticiones sin Origin
// se siguen permitiendo: bloquearlas daria una sensacion de seguridad que no
// es real y romperia las pruebas.
//
// Y en despliegue CORS casi no interviene: nginx sirve el frontend y hace de
// proxy de /api, asi que el navegador habla con un solo origen.
const ORIGENES_PERMITIDOS = (
  process.env.CORS_ORIGENES || 'http://localhost:4200,http://localhost:8080'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || ORIGENES_PERMITIDOS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('No permitido por CORS'));
  },
};
app.use(cors(corsOptions));

//Cargamos el modulo de direccionamiento de rutas
app.use('/api/chatbot', chatbotLimiter, require('./src/routes/chatbot.route'));
const authRoutes = require('./src/routes/login.route');
const usuariosRoutes = require('./src/routes/usuario.route');
const mesaRoutes = require('./src/routes/mesa.route');
const productoRoutes = require('./src/routes/producto.route');
const pedidoRoutes = require('./src/routes/pedido.route');
const pagoRoutes = require('./src/routes/pago.route');
const historialRoutes = require('./src/routes/historial.route');

// El limitador general va delante de todo /api. El de inicio de sesion se
// suma al general, no lo reemplaza.
app.use('/api', apiLimiter);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/mesas', mesaRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/cocina', cocinaRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/historial', historialRoutes);
app.use('/api/caja', require('./src/routes/caja.route'));
app.use('/api/roles', require('./src/routes/rol.route'));
app.use('/api/funciones', require('./src/routes/funcion.route'));
app.use('/api/reportes', require('./src/routes/reporte.route'));
app.use('/api/dashboard', require('./src/routes/dashboard.route'));
// Swagger Setup
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger.config');

// E14-02. Antes /api-docs estaba abierto, y ademas la raiz redirigia ahi, asi
// que entrar al servidor te dejaba directamente en la documentacion completa
// de la API: todas las rutas, todos los parametros, todos los esquemas. Es el
// indice del sistema servido a quien pase.
//
// Ahora hay dos cerrojos, y hacen falta los dos:
//
//   1. NO SE PUBLICA. nginx solo hace de proxy de /api/, asi que /api-docs no
//      es alcanzable desde el navegador en despliegue.
//   2. NO SE SIRVE salvo que se pida con SWAGGER_HABILITADO=true, y aun asi
//      pide usuario y contrasena.
//
// El primero depende del proxy. Si manana alguien publica el puerto 3000
// "para probar", el segundo sigue en pie.
const SWAGGER_HABILITADO = String(process.env.SWAGGER_HABILITADO).toLowerCase() === 'true';

if (SWAGGER_HABILITADO) {
  const usuarioDocs = process.env.SWAGGER_USER;
  const claveDocs = process.env.SWAGGER_PASSWORD;

  if (!usuarioDocs || !claveDocs) {
    // Fallar al arrancar antes que servir la documentacion sin clave. Un
    // servicio que no levanta se nota; uno que levanta con la puerta abierta,
    // no.
    console.error('SWAGGER_HABILITADO=true exige SWAGGER_USER y SWAGGER_PASSWORD.');
    process.exit(1);
  }

  const crypto = require('crypto');

  // Comparacion de tiempo constante. Comparar con === corta en el primer
  // caracter distinto, y esa diferencia de tiempo deja adivinar la clave de a
  // un caracter.
  const iguales = (a, b) => {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  };

  const pedirClave = (req, res, next) => {
    const cabecera = req.headers.authorization || '';
    const [tipo, credenciales] = cabecera.split(' ');

    if (tipo === 'Basic' && credenciales) {
      const [usuario, clave] = Buffer.from(credenciales, 'base64').toString().split(':');
      if (iguales(usuario, usuarioDocs) && iguales(clave, claveDocs)) {
        return next();
      }
    }

    res.set('WWW-Authenticate', 'Basic realm="Documentacion"');
    return res.status(401).send('Autenticacion requerida');
  };

  app.use('/api-docs', pedirClave, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log('Documentacion Swagger habilitada en /api-docs, con usuario y contrasena.');
}

// La raiz ya no redirige a la documentacion. Devuelve lo minimo para saber que
// el servicio esta vivo, sin contar que hay adentro.
app.get('/', (_req, res) => {
  res.json({ servicio: 'restoya-api', estado: 'ok' });
});

//setting
app.set('port', process.env.PORT || 3000);


// ---------------------------------------------------------------------------
// Arranque.
//
// Antes esto era sequelize.sync({ alter: true }) fijo. Eso hacia tres cosas
// malas en cada arranque:
//
//   1. soltaba y recreaba las siete claves foraneas, tomando bloqueo
//      ACCESS EXCLUSIVE sobre tablas de millones de filas;
//   2. acumulaba una constraint UNIQUE duplicada en "mesas" por arranque
//      (se encontraron siete: mesas_numMesa_key hasta mesas_numMesa_key6);
//   3. sobre el dataset de 30 millones de filas tardaba 122 sentencias ALTER
//      antes de poder escuchar, y el healthcheck de Docker lo mataba.
//
// Con el esquema cambiando debajo, ninguna medicion de rendimiento es
// reproducible. El esquema se versiona en infra/postgres/schema.sql.
//
//   DB_SYNC sin definir / "none" -> no toca el esquema. Es el valor de despliegue.
//   DB_SYNC=alter                -> el comportamiento viejo. Solo en una base de prueba.
//   DB_SYNC=create               -> crea lo que falte, sin alterar lo que ya existe.
//
// DB_SEED=false ademas evita que el arranque escriba datos base, para que una
// medicion no arranque con escrituras encima.
// ---------------------------------------------------------------------------

const seedDatabase = require('./config/seed');

const MODO_SYNC = (process.env.DB_SYNC || 'none').toLowerCase();
const DEBE_SEMBRAR = (process.env.DB_SEED || 'true').toLowerCase() !== 'false';

const prepararEsquema = async () => {
  if (MODO_SYNC === 'alter') {
    console.warn('DB_SYNC=alter: el arranque va a ALTERAR el esquema. No usar sobre datos que importen.');
    await sequelize.sync({ alter: true });
    console.log('Esquema sincronizado con alter.');
    return;
  }

  if (MODO_SYNC === 'create') {
    await sequelize.sync();
    console.log('Esquema sincronizado: se creo lo que faltaba.');
    return;
  }

  // Sin sincronizacion. Solo se verifica que la base responda; si no responde,
  // el arranque falla aca y no a mitad de la primera peticion.
  await sequelize.authenticate();
  console.log('Esquema sin modificar (DB_SYNC=none).');
};

prepararEsquema()
  .then(async () => {
    if (DEBE_SEMBRAR) {
      await seedDatabase();
    } else {
      console.log('Seed salteado (DB_SEED=false).');
    }

    app.listen(app.get('port'), () => {
      console.log('Server started on port', app.get('port'));
    });
  })
  .catch((err) => {
    console.error('No se pudo iniciar el servidor debido a un error en la BD:', err);
    process.exit(1);
  });
