const express = require("express");
const router = express.Router();
const { agregarItem, obtenerDetallesPorPedido, actualizarCantidad, eliminarItem } = require("../controllers/detallePedido.controller");

router.get("/pedido/:idPedido", obtenerDetallesPorPedido);
router.post("/", agregarItem);
router.put("/:id", actualizarCantidad);
router.delete("/:id", eliminarItem);

module.exports = router;