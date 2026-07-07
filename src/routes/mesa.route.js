const express = require("express");
const router = express.Router();
const { obtenerMesas, obtenerMesaPorId, crearMesa, liberarMesa, cambiarEstado, eliminarMesa, actualizarMesa } = require("../controllers/mesa.controller");
const { verificarToken, verificarRol } = require("../middlewares/auth.middleware");

// Rutas públicas (necesarias para que los clientes escaneen QRs sin iniciar sesión)
router.get("/", obtenerMesas);
router.get("/:id", obtenerMesaPorId);

// Aplicar middleware de autenticación al resto de las rutas (para empleados)
router.use(verificarToken);
router.use(verificarRol('Mozo', 'Gerente', 'Cajero')); // Cajero puede necesitar ver las mesas

router.post("/", verificarRol('Gerente'), crearMesa); // Solo admin crea mesas
router.put("/:id", verificarRol('Gerente'), actualizarMesa); // Admin edita mesa
router.put("/:id/liberar", liberarMesa);
router.put("/:id/estado", cambiarEstado);
router.delete("/:id", verificarRol('Gerente'), eliminarMesa);

module.exports = router;