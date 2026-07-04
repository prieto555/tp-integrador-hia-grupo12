const express = require("express");
const router = express.Router();
const {
  crearProducto,
  obtenerProductos,
  obtenerProductoPorId,
  actualizarProducto,
  eliminarProducto,
} = require("../controllers/producto.controller.js");
const { verificarToken, verificarRol } = require("../middlewares/auth.middleware");

// GETs son públicos (para que los clientes vean el menú)
router.get("/", obtenerProductos);
router.get("/:id", obtenerProductoPorId);

// Modificaciones requieren ser Gerente (Admin)
router.post("/", verificarToken, verificarRol('Gerente'), crearProducto);
router.put("/:id", verificarToken, verificarRol('Gerente'), actualizarProducto);
router.delete("/:id", verificarToken, verificarRol('Gerente'), eliminarProducto);

module.exports = router;