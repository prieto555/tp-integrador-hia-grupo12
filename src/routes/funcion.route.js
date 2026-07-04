//defino controlador para el manejo de CRUD
const funcionesCtrl = require('./../controllers/funcion.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();

router.get('/', funcionesCtrl.getFunciones);
router.post('/', funcionesCtrl.createFuncion);
router.get('/:id',  funcionesCtrl.getFuncionId)
router.put('/:id', funcionesCtrl.updateFuncion)
router.delete('/:id', funcionesCtrl.deleteFuncion)

module.exports = router;