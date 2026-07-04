const express = require("express");
const router = express.Router();
const { obtenerMesas, obtenerMesaPorId, crearMesa, liberarMesa, cambiarEstado, eliminarMesa } = require("../controllers/mesa.controller");
const { verificarToken, verificarRol } = require("../middlewares/auth.middleware");

// Aplicar middleware de autenticación a todas las rutas de mesa
router.use(verificarToken);
router.use(verificarRol('Mozo', 'Gerente', 'Cajero')); // Cajero puede necesitar ver las mesas

router.get("/", obtenerMesas);
router.get("/:id", obtenerMesaPorId);
router.post("/", verificarRol('Gerente'), crearMesa); // Solo admin crea mesas
router.put("/:id/liberar", liberarMesa);
router.put("/:id/estado", cambiarEstado);
router.delete("/:id", verificarRol('Gerente'), eliminarMesa);

module.exports = router;