const express = require("express");
const router = express.Router();
const { abrirCaja, obtenerCajaActiva, obtenerTodasLasCajas, cerrarCaja } = require("../controllers/caja.controller");
const { verificarToken, verificarRol } = require("../middlewares/auth.middleware");

// Aplicar middleware de autenticación a todas las rutas de caja
router.use(verificarToken);
router.use(verificarRol('Cajero', 'Gerente'));

router.post("/abrir", abrirCaja);
router.get("/activa", obtenerCajaActiva);
router.get("/", obtenerTodasLasCajas);
router.put("/cerrar", cerrarCaja);

module.exports = router;
