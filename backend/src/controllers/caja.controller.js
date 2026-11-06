const Caja = require("../models/caja.model");
const Pago = require("../models/pago.model");

// abrirCaja
const abrirCaja = async (req, res) => {
  const { montoInicial } = req.body;

  try {
    // verificar si ya hay una caja abierta
    const cajaAbierta = await Caja.findOne({ where: { estado: "ABIERTA" } });
    if (cajaAbierta) {
      return res.status(400).json({ message: "Ya existe una caja abierta en este momento" });
    }

    const nuevaCaja = await Caja.create({ 
      montoInicial: montoInicial || 0,
      estado: "ABIERTA" 
    });

    res.status(201).json({ message: "Caja abierta correctamente", caja: nuevaCaja });
  } catch (error) {
    res.status(500).json({ message: "Error al abrir caja", error: error.message });
  }
};

// obtenerCajaActiva
const obtenerCajaActiva = async (req, res) => {
  try {
    const caja = await Caja.findOne({ 
      where: { estado: "ABIERTA" },
      include: [{ model: Pago, as: "pagos" }]
    });

    if (!caja) return res.status(404).json({ message: "No hay ninguna caja abierta" });
    res.json(caja);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener caja activa", error: error.message });
  }
};

// obtenerTodasLasCajas
const obtenerTodasLasCajas = async (req, res) => {
  try {
    const cajas = await Caja.findAll({
      order: [['fechaApertura', 'DESC']]
    });
    res.json(cajas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener historial de cajas", error: error.message });
  }
};

// cerrarCaja
const cerrarCaja = async (req, res) => {
  try {
    const caja = await Caja.findOne({ 
      where: { estado: "ABIERTA" },
      include: [{ model: Pago, as: "pagos" }]
    });

    if (!caja) return res.status(404).json({ message: "No hay ninguna caja abierta para cerrar" });

    // calcular monto final
    let totalPagos = 0;
    if (caja.pagos && caja.pagos.length > 0) {
      totalPagos = caja.pagos.reduce((sum, pago) => sum + pago.monto, 0);
    }
    
    const montoFinalCalculado = caja.montoInicial + totalPagos;

    await caja.update({ 
      estado: "CERRADA",
      montoFinal: montoFinalCalculado,
      fechaCierre: new Date()
    });

    res.json({ message: "Caja cerrada correctamente", caja });
  } catch (error) {
    res.status(500).json({ message: "Error al cerrar caja", error: error.message });
  }
};

module.exports = { abrirCaja, obtenerCajaActiva, obtenerTodasLasCajas, cerrarCaja };
