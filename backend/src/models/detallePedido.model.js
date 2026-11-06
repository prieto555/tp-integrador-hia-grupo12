const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const Pedido = require("./pedido.model");
const Producto = require("./producto.model");

const DetallePedido = sequelize.define("DetallePedido", {
  idDetalle: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  precioUnitario: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  subTotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
}, {
  tableName: "detalle_pedidos",
  timestamps: false,
});

// calcularSubTotal: precioUnitario * cantidad, lo persiste y lo devuelve
DetallePedido.prototype.calcularSubTotal = async function () {
  this.subTotal = this.precioUnitario * this.cantidad;
  await this.save();
  return this.subTotal;
};

// detalle Pedido
DetallePedido.belongsTo(Pedido, { foreignKey: "idPedido", as: "pedido" });
Pedido.hasMany(DetallePedido, { foreignKey: "idPedido", as: "detalles" });

// detalle Producto
DetallePedido.belongsTo(Producto, { foreignKey: "idProducto", as: "producto" });
Producto.hasMany(DetallePedido, { foreignKey: "idProducto", as: "detalles" });

module.exports = DetallePedido;