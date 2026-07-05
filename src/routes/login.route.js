const loginCtrl = require('./../controllers/login.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();

const { body } = require('express-validator');
const { validarCampos } = require('../middlewares/validator.middleware');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Inicia sesión en el sistema
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve JWT
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Credenciales incorrectas
 */
router.post('/login', [
    body('email', 'El email es obligatorio y debe ser válido').isEmail(),
    body('password', 'La contraseña es obligatoria').notEmpty(),
    validarCampos
], loginCtrl.login);
router.post('/google', loginCtrl.googleLogin);

module.exports = router;