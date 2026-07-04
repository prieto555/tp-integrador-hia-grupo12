const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const Mesa = require("./mesa.model");

const Pedido = sequelize.define("Pedido", {
  idPedido: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  estado: {
    type: DataTypes.ENUM("PENDIENTE", "EN_COCINA", "LISTO_PARA_ENTREGA", "ENTREGADO", "PAGADO", "CANCELADO"),
    defaultValue: "PENDIENTE",
  },
  tipoPedido: {
    type: DataTypes.ENUM("LOCAL", "DELIVERY"),
    defaultValue: "LOCAL",
    allowNull: false,
  },
  fechaCreacion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  total: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
}, {
  tableName: "pedidos",
  timestamps: false,
});


// pedido mesa
Pedido.belongsTo(Mesa, { foreignKey: "idMesa", as: "mesa" });
Mesa.hasMany(Pedido, { foreignKey: "idMesa", as: "pedidos" });

module.exports = Pedido;