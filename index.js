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
app.use(cors({ origin: "http://localhost:4200" }));

//Cargamos el modulo de direccionamiento de rutas
app.use('/api/pedidos', require('./src/routes/pedido.route'));
app.use('/api/productos', require('./src/routes/producto.route'));
app.use('/api/detalles-pedidos', require('./src/routes/detallePedido.route'));
app.use('/api/mesas', require('./src/routes/mesa.route'));
app.use('/api/pagos', require('./src/routes/pago.route'));
app.use('/api/caja', require('./src/routes/caja.route'));
app.use('/api/usuarios', require('./src/routes/usuario.route'));
app.use('/api/roles', require('./src/routes/rol.route'));
app.use('/api/funciones', require('./src/routes/funcion.route'));
app.use('/api/auth', authLimiter, require('./src/routes/login.route'));
app.use('/api/reportes', require('./src/routes/reporte.route'));
app.use("/api/cocina", cocinaRoutes);
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

  