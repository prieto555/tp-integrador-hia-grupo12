//defino controlador para el manejo de CRUD
const rolCtrl = require('../controllers/rol.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();

router.get('/', rolCtrl.getRol);
router.post('/', rolCtrl.createRol);
router.get('/:id',  rolCtrl.getRolId)
router.put('/:id', rolCtrl.updateRol)
router.delete('/:id', rolCtrl.deleteRol)

module.exports = router;