const { Sequelize } = require("sequelize");
// Crea proyectodb en el servidory configura las credenciales de tu bd de PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME, 
  process.env.DB_USER, 
  process.env.DB_PASSWORD, 
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT || "postgres",
  }
);
// Probar y levantar la conexión
sequelize.authenticate()
  .then(() => console.log("DB is connected to PostgreSQL"))
  .catch((err) => console.error("Error al conectar a PostgreSQL:", err));
module.exports = sequelize;