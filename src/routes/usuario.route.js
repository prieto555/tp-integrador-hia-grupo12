//defino controlador para el manejo de CRUD
const usuarioCtrl = require('./../controllers/usuario.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();

router.get('/', usuarioCtrl.getUsuarios);
router.post('/', usuarioCtrl.createUsuario);
router.get('/:id',  usuarioCtrl.getUsuarioId)
router.put('/:id', usuarioCtrl.updateUsuario)

module.exports = router;