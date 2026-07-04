const express = require("express");
const router = express.Router();
const { obtenerPedidos, obtenerPedidosCocina, obtenerPedidoPorId, crearPedido, cambiarEstado, cancelar } = require("../controllers/pedido.controller");
const { verificarToken, verificarRol } = require("../middlewares/auth.middleware");

// crearPedido es público (para el delivery/clientes)
router.post("/", crearPedido);

// Las demás requieren estar logueados (Staff o Gerente)
router.get("/", verificarToken, obtenerPedidos);
router.get("/cocina", verificarToken, verificarRol('Cocina', 'Gerente'), obtenerPedidosCocina);
router.get("/:id", verificarToken, obtenerPedidoPorId);
router.put("/:id/estado", verificarToken, cambiarEstado);
router.delete("/:id", verificarToken, cancelar);

module.exports = router;