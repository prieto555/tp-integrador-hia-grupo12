const DetallePedido = require("../models/detallePedido.model");
const Producto = require("../models/producto.model");
const Pedido = require("../models/pedido.model");

// recalcularTotalPedido: suma todos los subtotales de un pedido y lo persiste
const recalcularTotalPedido = async (idPedido) => {
  const detalles = await DetallePedido.findAll({ where: { idPedido } });
  const total = detalles.reduce((acc, d) => acc + Number(d.subTotal), 0);
  await Pedido.update({ total }, { where: { idPedido } });
  return total;
};

// agregarItem agrega un producto al pedido y recalcula el total del pedido
const agregarItem = async (req, res) => {
  const { idPedido, idProducto, cantidad } = req.body;

  if (!idPedido || !idProducto || !cantidad) {
    return res.status(400).json({ message: "Los campos idPedido, idProducto y cantidad son obligatorios" });
  }

  try {
    const pedido = await Pedido.findByPk(idPedido);
    if (!pedido) return res.status(404).json({ message: "Pedido no encontrado" });

    const producto = await Producto.findByPk(idProducto);
    if (!producto) return res.status(404).json({ message: "Producto no encontrado" });

    const nuevoDetalle = await DetallePedido.create({
      idPedido,
      idProducto,
      cantidad,
      precioUnitario: producto.precio,
      subTotal: producto.precio * cantidad,
    });

    const totalActualizado = await recalcularTotalPedido(idPedido);

    res.status(201).json({ message: "Item agregado correctamente", detalle: nuevoDetalle, totalPedido: totalActualizado });
  } catch (error) {
    res.status(500).json({ message: "Error al agregar item", error: error.message });
  }
};

// obtenerDetallesPorPedido lista todos los items de un pedido
const obtenerDetallesPorPedido = async (req, res) => {
  try {
    const detalles = await DetallePedido.findAll({
      where: { idPedido: req.params.idPedido },
      include: [{ model: Producto, as: "producto" }],
    });
    res.json(detalles);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener detalles", error: error.message });
  }
};

// actualizarCantidad cambia la cantidad de un item y recalcula todo
const actualizarCantidad = async (req, res) => {
  const { cantidad } = req.body;

  try {
    const detalle = await DetallePedido.findByPk(req.params.id);
    if (!detalle) return res.status(404).json({ message: "Detalle no encontrado" });

    detalle.cantidad = cantidad;
    await detalle.calcularSubTotal();
    const totalActualizado = await recalcularTotalPedido(detalle.idPedido);

    res.json({ message: "Cantidad actualizada correctamente", detalle, totalPedido: totalActualizado });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar cantidad", error: error.message });
  }
};

// eliminarItem quita un item del pedido y recalcula el total
const eliminarItem = async (req, res) => {
  try {
    const detalle = await DetallePedido.findByPk(req.params.id);
    if (!detalle) return res.status(404).json({ message: "Detalle no encontrado" });

    const idPedido = detalle.idPedido;
    await detalle.destroy();
    const totalActualizado = await recalcularTotalPedido(idPedido);

    res.json({ message: "Item eliminado correctamente", totalPedido: totalActualizado });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar item", error: error.message });
  }
};

module.exports = { agregarItem, obtenerDetallesPorPedido, actualizarCantidad, eliminarItem };