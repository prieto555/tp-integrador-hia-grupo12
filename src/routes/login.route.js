const loginCtrl = require('./../controllers/login.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();

router.post('/login', loginCtrl.login);
router.post('/google', loginCtrl.googleLogin);

module.exports = router;