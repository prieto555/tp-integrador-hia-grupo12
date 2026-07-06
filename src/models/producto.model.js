const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

// Mapea cada categoria a si pasa o no por cocina.
// Cocina usa esto para filtrar y mostrar SOLO comida, nunca bebidas.
const PRODUCTO_REQUIERE_PREPARACION = {
  plato_principal: true,
  postre: true,
  bebida: false,
};

const Producto = sequelize.define("Producto", {
  idProducto: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  precioCosto: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  porcentajeGanancia: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  precio: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  imagenUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  categoria: {
    type: DataTypes.ENUM("plato_principal", "bebida", "postre"),
    allowNull: false,
  },
}, {
  tableName: "productos",
  timestamps: false,
});

// requierePreparacion: true si este producto debe aparecer en el panel de cocina
Producto.prototype.requierePreparacion = function () {
  return PRODUCTO_REQUIERE_PREPARACION[this.categoria] ?? true;
};

module.exports = Producto;
module.exports.PRODUCTO_REQUIERE_PREPARACION = PRODUCTO_REQUIERE_PREPARACION;