const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Caja = sequelize.define("Caja", {
  idCaja: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  montoInicial: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  montoFinal: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  estado: {
    type: DataTypes.ENUM("ABIERTA", "CERRADA"),
    defaultValue: "ABIERTA",
  },
  fechaApertura: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  fechaCierre: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: "cajas",
  timestamps: false,
});

module.exports = Caja;
