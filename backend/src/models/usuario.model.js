const { DataTypes } = require('sequelize');
const sequelize = require('./../../config/database'); // Asegúrate de que la ruta apunte a tu archivo

const Usuario = sequelize.define('Usuario', {
    // Sequelize crea un campo 'id' autoincrementable automáticamente, no hace falta ponerlo
    usuarioId : { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false},
    apellido: { type: DataTypes.STRING, allowNull: false },
    nombre: { type: DataTypes.STRING, allowNull: false },
    dni: { type: DataTypes.STRING, allowNull: true },
    // El UNIQUE no es solo un indice: es lo unico que impide que existan dos
    // cuentas con el mismo correo. La verificacion que hacia la aplicacion
    // (findOne y despues create) deja una ventana entre las dos sentencias en
    // la que entra otra alta igual. El indice en la base ya existe
    // (usuarios_email_unico, creado en el punto 5 despues de comprobar que no
    // hubiera duplicados); esto hace que el modelo diga lo mismo que el
    // esquema, y que Sequelize valide antes de llegar a la base.
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }
}, {
    tableName: 'usuarios', // Nombre de la tabla en minúsculas y plural
});

const bcrypt = require('bcryptjs');

// compararPassword: compara la password ingresada contra el hash guardado
Usuario.prototype.compararPassword = async function (passwordPlano) {
    return bcrypt.compare(passwordPlano, this.password);
};

module.exports = Usuario;

const Rol = require('./rol.model');

Usuario.belongsToMany(Rol, {
    through:"usuario_roles",
    foreignKey: "usuarioId",
    otherKey: "rolId"
});