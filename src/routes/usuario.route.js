//defino controlador para el manejo de CRUD
const usuarioCtrl = require('./../controllers/usuario.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();

const { verificarToken, verificarPermiso } = require('../middlewares/auth.middleware');

router.get('/', verificarToken, verificarPermiso('gestionar_usuarios'), usuarioCtrl.getUsuarios);
router.post('/', verificarToken, verificarPermiso('gestionar_usuarios'), usuarioCtrl.createUsuario);
router.get('/:id', verificarToken, verificarPermiso('gestionar_usuarios'), usuarioCtrl.getUsuarioId);
router.put('/:id', verificarToken, verificarPermiso('gestionar_usuarios'), usuarioCtrl.updateUsuario);
router.delete('/:id', verificarToken, verificarPermiso('gestionar_usuarios'), usuarioCtrl.deleteUsuario);

module.exports = router;