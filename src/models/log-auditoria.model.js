const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const LogAuditoria = sequelize.define("LogAuditoria", {
  idLog: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Puede ser null si la acción no tiene un usuario asignado (por ejemplo, login fallido externo)
  },
  accion: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  detalles: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "logs_auditoria",
  timestamps: false,
});

module.exports = LogAuditoria;
