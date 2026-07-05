//defino controlador para el manejo de CRUD
const usuarioCtrl = require('./../controllers/usuario.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();

const { verificarToken, verificarPermiso } = require('../middlewares/auth.middleware');

const { body } = require('express-validator');
const { validarCampos } = require('../middlewares/validator.middleware');

router.get('/', verificarToken, verificarPermiso('gestionar_usuarios'), usuarioCtrl.getUsuarios);
router.post('/', [
    verificarToken, 
    verificarPermiso('gestionar_usuarios'),
    body('nombre', 'El nombre es obligatorio').notEmpty(),
    body('apellido', 'El apellido es obligatorio').notEmpty(),
    body('dni', 'El DNI debe tener al menos 7 caracteres').optional({ checkFalsy: true }).isLength({ min: 7 }),
    body('email', 'El email debe ser válido').isEmail(),
    body('password', 'El password debe tener al menos 6 caracteres').isLength({ min: 6 }),
    validarCampos
], usuarioCtrl.createUsuario);

router.get('/:id', verificarToken, verificarPermiso('gestionar_usuarios'), usuarioCtrl.getUsuarioId);

router.put('/:id', [
    verificarToken, 
    verificarPermiso('gestionar_usuarios'),
    body('nombre', 'El nombre es obligatorio').notEmpty(),
    body('apellido', 'El apellido es obligatorio').notEmpty(),
    body('dni', 'El DNI debe tener al menos 7 caracteres').optional({ checkFalsy: true }).isLength({ min: 7 }),
    body('email', 'El email debe ser válido').isEmail(),
    validarCampos
], usuarioCtrl.updateUsuario);

router.delete('/:id', verificarToken, verificarPermiso('gestionar_usuarios'), usuarioCtrl.deleteUsuario);

module.exports = router;