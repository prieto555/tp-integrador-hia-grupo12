const Mesa = require("../models/mesa.model");
const Pedido = require("../models/pedido.model");

// obtenerMesas
const obtenerMesas = async (req, res) => {
  try {
    const mesas = await Mesa.findAll();
    res.json(mesas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener mesas", error: error.message });
  }
};

// obtenerMesaPorId
const obtenerMesaPorId = async (req, res) => {
  try {
    const mesa = await Mesa.findByPk(req.params.id);
    if (!mesa) return res.status(404).json({ message: "Mesa no encontrada" });
    res.json(mesa);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener la mesa", error: error.message });
  }
};

// crearMesa
const crearMesa = async (req, res) => {
  const { numMesa, capacidad } = req.body;

  if (!numMesa || !capacidad)
    return res.status(400).json({ message: "numMesa y capacidad son obligatorios" });

  try {
    const nueva = await Mesa.create({ numMesa, capacidad });
    res.status(201).json({ message: "Mesa creada correctamente", mesa: nueva });
  } catch (error) {
    // numMesa duplicado
    if (error.name === "SequelizeUniqueConstraintError")
      return res.status(400).json({ message: `Ya existe la mesa número ${numMesa}` });
    res.status(500).json({ message: "Error al crear mesa", error: error.message });
  }
};

// liberarMesa — pone la mesa en LIBRE y cierra pedidos activos
const liberarMesa = async (req, res) => {
  try {
    const mesa = await Mesa.findByPk(req.params.id);
    if (!mesa) return res.status(404).json({ message: "Mesa no encontrada" });

    if (mesa.estado === "LIBRE")
      return res.status(400).json({ message: "La mesa ya está libre" });

    // 1. Cerrar todos los pedidos activos de esta mesa para que no queden "fantasmas"
    const { Op } = require("sequelize");
    await Pedido.update(
      { estado: "PAGADO" },
      { where: { 
          idMesa: mesa.idMesa, 
          estado: { [Op.notIn]: ["PAGADO", "CANCELADO"] } 
        } 
      }
    );

    // 2. Liberar la mesa
    await mesa.update({ estado: "LIBRE" });
    res.json({ message: "Mesa liberada y pedidos cerrados", mesa });
  } catch (error) {
    res.status(500).json({ message: "Error al liberar mesa", error: error.message });
  }
};

// cambiarEstado — cambia el estado de la mesa manualmente
const cambiarEstado = async (req, res) => {
  const estadosValidos = ["LIBRE", "OCUPADA", "RESERVADA"];
  const { estado } = req.body;

  if (!estadosValidos.includes(estado))
    return res.status(400).json({ message: "Estado inválido. Usá: LIBRE, OCUPADA o RESERVADA" });

  try {
    const mesa = await Mesa.findByPk(req.params.id);
    if (!mesa) return res.status(404).json({ message: "Mesa no encontrada" });

    await mesa.update({ estado });
    res.json({ message: `Estado de mesa actualizado a ${estado}`, mesa });
  } catch (error) {
    res.status(500).json({ message: "Error al cambiar estado", error: error.message });
  }
};

// eliminarMesa
const eliminarMesa = async (req, res) => {
  try {
    const mesa = await Mesa.findByPk(req.params.id);
    if (!mesa) return res.status(404).json({ message: "Mesa no encontrada" });

    if (mesa.estado === "OCUPADA")
      return res.status(400).json({ message: "No se puede eliminar una mesa ocupada" });

    await mesa.destroy();
    res.json({ message: "Mesa eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar mesa", error: error.message });
  }
};

module.exports = { obtenerMesas, obtenerMesaPorId, crearMesa, liberarMesa, cambiarEstado, eliminarMesa };