const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Mesa = sequelize.define("Mesa", {
  idMesa: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  numMesa: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    validate: { min: 1 }
  },
  capacidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2, //defecto 2 mesas
    validate: { min: 1 }
  },
  estado: {
    type: DataTypes.ENUM("LIBRE", "OCUPADA", "RESERVADA"),
    defaultValue: "LIBRE",
  },
}, {
  tableName: "mesas",
  timestamps: false,
});

module.exports = Mesa;