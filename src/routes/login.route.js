const loginCtrl = require('./../controllers/login.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();

const { body } = require('express-validator');
const { validarCampos } = require('../middlewares/validator.middleware');

router.post('/login', [
    body('email', 'El email es obligatorio y debe ser válido').isEmail(),
    body('password', 'La contraseña es obligatoria').notEmpty(),
    validarCampos
], loginCtrl.login);
router.post('/google', loginCtrl.googleLogin);

module.exports = router;