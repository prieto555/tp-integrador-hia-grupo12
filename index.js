require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./config/database");
const cocinaRoutes = require("./src/routes/cocina.route");
var app = express();

// middlewares de seguridad
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

//middlewares
app.use(helmet()); // Protege cabeceras HTTP

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Limita cada IP a 10 peticiones de login por ventana
  message: "Demasiados intentos de inicio de sesión, intente de nuevo en 15 minutos."
});

app.use(express.json());
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
//setting
app.set('port', process.env.PORT || 3000);

const seedDatabase = require('./config/seed');

// Sincronizar Base de Datos y arrancar el servidor
//.sync() con alter: true actualiza las tablas si hubo cambios en los modelos
sequelize.sync({ alter: true })
  .then(async () => {
    console.log("Tablas de PostgreSQL sincronizadas");
    await seedDatabase();
    
    app.listen(app.get("port"), () => {
      console.log(`Server started on port`, app.get("port"));
    });
  })
  .catch((err) => {
    console.error(
      "No se pudo iniciar el servidor debido a un error en la BD:",
      err,
    );
  });

  