const express = require("express");
const router = express.Router();
const { obtenerPedidos, obtenerPedidosCocina, obtenerPedidoPorId, crearPedido, cambiarEstado, cancelar } = require("../controllers/pedido.controller");
const { verificarToken, verificarRol } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Pedidos
 *   description: API para gestión de pedidos y comandas
 */

/**
 * @swagger
 * /api/pedidos:
 *   post:
 *     summary: Crear un nuevo pedido
 *     tags: [Pedidos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idMesa:
 *                 type: integer
 *               detalles:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     idProducto:
 *                       type: integer
 *                     cantidad:
 *                       type: integer
 *                     precioUnitario:
 *                       type: number
 *     responses:
 *       201:
 *         description: Pedido creado
 */
// crearPedido es público (para el delivery/clientes)
router.post("/", crearPedido);

// Las demás requieren estar logueados (Staff o Gerente)
router.get("/", verificarToken, obtenerPedidos);
router.get("/cocina", verificarToken, verificarRol('Cocina', 'Gerente'), obtenerPedidosCocina);
router.get("/:id", verificarToken, obtenerPedidoPorId);
router.put("/:id/estado", verificarToken, cambiarEstado);
router.delete("/:id", verificarToken, cancelar);

module.exports = router;