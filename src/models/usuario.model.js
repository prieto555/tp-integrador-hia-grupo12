const { DataTypes } = require('sequelize');
const sequelize = require('./../../config/database'); // Asegúrate de que la ruta apunte a tu archivo

const Usuario = sequelize.define('Usuario', {
    // Sequelize crea un campo 'id' autoincrementable automáticamente, no hace falta ponerlo
    usuarioId : { type: DataTypes.INTEGER, allowNull: false},
    apellido: { type: DataTypes.STRING, allowNull: false },
    nombre: { type: DataTypes.STRING, allowNull: false },
    dni: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false }
}, {
    tableName: 'usuarios', // Nombre de la tabla en minúsculas y plural
    timestamps: true, // Crea automáticamente los campos createdAt y updatedAt
});

module.exports = Usuario;

const Rol = require('./rol.model');

Usuario.belongsToMany(Rol, {
    through:"usuario_roles",
    foreignKey: "usuarioId",
    otherKey: "rolId"
});