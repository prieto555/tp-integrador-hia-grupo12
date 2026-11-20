//defino controlador para el manejo de CRUD
const funcionesCtrl = require('./../controllers/funcion.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

// Hallazgo D-01. PUT /:id reescribia un permiso del sistema sin identificarse.
// Las funciones son las ocho que definen que puede hacer cada rol: tocarlas
// cambia los permisos de todo el mundo a la vez.
//
// Leerlas alcanza con tener sesion -la pantalla de roles las muestra para
// marcar cuales tiene cada uno-; modificarlas es solo del gerente.
router.use(verificarToken);

router.get('/', funcionesCtrl.getFunciones);
router.get('/:id', funcionesCtrl.getFuncionId);

router.post('/', verificarRol('Gerente'), funcionesCtrl.createFuncion);
router.put('/:id', verificarRol('Gerente'), funcionesCtrl.updateFuncion);
router.delete('/:id', verificarRol('Gerente'), funcionesCtrl.deleteFuncion);

module.exports = router;