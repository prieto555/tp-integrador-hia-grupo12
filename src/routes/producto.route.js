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

const { body } = require('express-validator');
const { validarCampos } = require('../middlewares/validator.middleware');

// Modificaciones requieren ser Gerente (Admin)
router.post("/", [
    verificarToken, 
    verificarRol('Gerente'),
    body('nombre', 'El nombre es obligatorio').notEmpty(),
    body('precio', 'El precio es obligatorio y debe ser un número').isNumeric(),
    body('categoria', 'La categoría es obligatoria').notEmpty(),
    validarCampos
], crearProducto);

router.put("/:id", [
    verificarToken, 
    verificarRol('Gerente'),
    body('nombre', 'El nombre es obligatorio').notEmpty(),
    body('precio', 'El precio es obligatorio y debe ser un número').isNumeric(),
    body('categoria', 'La categoría es obligatoria').notEmpty(),
    validarCampos
], actualizarProducto);

router.delete("/:id", verificarToken, verificarRol('Gerente'), eliminarProducto);

module.exports = router;