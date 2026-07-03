const Pedido = require("../models/pedido.model");
const DetallePedido = require("../models/detallePedido.model");
const Producto = require("../models/producto.model");

// 1. Listar las comidas que se deben preparar (lo que ya tenías)
const obtenerComandas = async (req, res) => {
  try {
    const comandas = await Pedido.findAll({
      where: {
        estado: ["PENDIENTE", "EN_COCINA"] 
      },
      include: [
        {
          model: DetallePedido,
          as: "detalles",
          include: [
            {
              model: Producto,
              as: "producto",
              attributes: ["nombre", "categoria", "descripcion"]
            }
          ]
        }
      ],
      order: [["idPedido", "ASC"]]
    });
    res.json(comandas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener comandas", error: error.message });
  }
};

// 2. NUEVO: Cambiar el estado del pedido (PENDIENTE -> EN_COCINA -> LISTO_PARA_ENTREGA)
const actualizarEstadoPedido = async (req, res) => {
  const { idPedido } = req.params;
  const { nuevoEstado } = req.body; // El frontend enviará "EN_COCINA" o "LISTO_PARA_ENTREGA"

  // Validamos que el estado que manden sea uno de los que acepta el ENUM de cocina
  const estadosValidos = ["PENDIENTE", "EN_COCINA", "LISTO_PARA_ENTREGA"];
  if (!estadosValidos.includes(nuevoEstado)) {
    return res.status(400).json({ message: "Estado de cocina no válido. Usar: PENDIENTE, EN_COCINA o LISTO_PARA_ENTREGA" });
  }

  try {
    const pedido = await Pedido.findByPk(idPedido);
    if (!pedido) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }

    // Actualizamos el estado del pedido madre
    pedido.estado = nuevoEstado;
    await pedido.save();

    res.json({ 
      message: `Pedido N°${idPedido} actualizado a ${nuevoEstado} correctamente`, 
      pedido 
    });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar el estado en cocina", error: error.message });
  }
};

module.exports = {
  obtenerComandas,
  actualizarEstadoPedido // ← Acordate de exportarlo
};