const { DataTypes } = require('sequelize');
const sequelize = require('./../../config/database');
const Usuario = require('./usuario.model');

const Historial = sequelize.define('Historial', {
    idHistorial: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    metodo: { type: DataTypes.STRING, allowNull: false }, // ej: 'EMAIL' o 'GOOGLE'
    fechaHora: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    ip: { type: DataTypes.STRING, allowNull: true }
}, {
    tableName: 'historial_accesos',
    timestamps: false,
    indexes: [
        {
            fields: ['fechaHora']
        }
    ]
});

// Relacion: Un Usuario tiene muchos registros en el Historial
Usuario.hasMany(Historial, { foreignKey: 'usuarioId' });
Historial.belongsTo(Usuario, { foreignKey: 'usuarioId' });

module.exports = Historial;
