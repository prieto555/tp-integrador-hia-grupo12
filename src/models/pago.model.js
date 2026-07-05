const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const Pedido = require("./pedido.model");
const Caja = require("./caja.model");
const Usuario = require("./usuario.model");
const Pago = sequelize.define("Pago", {
  idPago: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  metodoPago: {
    type: DataTypes.ENUM("EFECTIVO", "TARJETA", "TRANSFERENCIA", "MERCADOPAGO"),
    allowNull: false,
  },
  monto: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  referenciaExterna: {
    type: DataTypes.STRING,
    allowNull: true, // Para guardar el ID de transacción de MercadoPago si se usa
  },
  fechaPago: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: "pagos",
  timestamps: false,
});


Pago.belongsTo(Pedido, { foreignKey: "idPedido", as: "pedido" });
Pedido.hasMany(Pago, { foreignKey: "idPedido", as: "pagos" });

Pago.belongsTo(Caja, { foreignKey: "idCaja", as: "caja" });
Caja.hasMany(Pago, { foreignKey: "idCaja", as: "pagos" });

Pedido.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

module.exports = Pago;
