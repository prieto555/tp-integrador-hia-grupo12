const { DataTypes } = require('sequelize');
const sequelize = require('./../../config/database'); // Asegúrate de que la ruta apunte a tu archivo

const Funcion = sequelize.define('Funcion', {
    // Sequelize crea un campo 'id' autoincrementable automáticamente, no hace falta ponerlo
    funcionId : { type: DataTypes.INTEGER, allowNull: false},
    nombre: { type: DataTypes.STRING, allowNull: false },
    detalle: { type: DataTypes.STRING, allowNull: false },
}, {
    tableName: 'funciones', // Nombre de la tabla en minúsculas y plural
    timestamps: true, // Crea automáticamente los campos createdAt y updatedAt
});

module.exports = Funcion;

const Rol = require('./rol.model');

Funcion.belongsToMany(Rol, {
    through:"roles_funciones",
    foreignKey: "funcionId",
    otherKey: "rolId"
});