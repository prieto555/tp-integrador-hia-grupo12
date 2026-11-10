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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Aumentado a 100 para permitir pruebas intensivas sin bloqueos
  message: "Demasiados intentos de inicio de sesión, intente de nuevo en 15 minutos."
});

app.use(express.json());

// Inyectamos nuestro Middleware Global de Auditoría
const auditarAccion = require('./src/middlewares/auditoria.middleware');
app.use(auditarAccion);
// Configuración de CORS dinámica
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como Postman) o desde el frontend (localhost o Vercel/Render)
    const permitidos = ['http://localhost:4200', process.env.FRONTEND_URL];
    if (!origin || permitidos.includes(origin) || origin.includes('onrender.com')) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  }
};
app.use(cors(corsOptions));

//Cargamos el modulo de direccionamiento de rutas
app.use('/api/chatbot', require('./src/routes/chatbot.route'));
const authRoutes = require('./src/routes/login.route');
const usuariosRoutes = require('./src/routes/usuario.route');
const mesaRoutes = require('./src/routes/mesa.route');
const productoRoutes = require('./src/routes/producto.route');
const pedidoRoutes = require('./src/routes/pedido.route');
const pagoRoutes = require('./src/routes/pago.route');
const historialRoutes = require('./src/routes/historial.route');

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

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Redirigir la ruta principal (/) a la documentación de Swagger para evitar el error 404
app.get('/', (req, res) => {
  res.redirect('/api-docs');
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
