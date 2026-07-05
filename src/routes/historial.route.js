const express = require('express');
const router = express.Router();
const { obtenerHistorial } = require('../controllers/historial.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

// Solo el Gerente puede ver la auditoria
router.get('/', verificarToken, verificarRol('Gerente'), obtenerHistorial);

module.exports = router;
