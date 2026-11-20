//defino controlador para el manejo de CRUD
const rolCtrl = require('../controllers/rol.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

// Hallazgo D-01, y es el peor de los cinco archivos. DELETE /:id borraba un
// rol sin identificarse, y usuario_roles tiene ON DELETE CASCADE: borrar el
// rol Gerente dejaba el sistema SIN NADIE que pudiera administrarlo. La
// cuenta de administrador seguia existiendo, pero sin rol.
//
// Leer la lista la necesita la pantalla de alta de usuarios para llenar el
// desplegable, asi que alcanza con tener sesion. Crear, modificar o borrar un
// rol es administracion pura.
router.use(verificarToken);

router.get('/', rolCtrl.getRol);
router.get('/:id', rolCtrl.getRolId);

router.post('/', verificarRol('Gerente'), rolCtrl.createRol);
router.put('/:id', verificarRol('Gerente'), rolCtrl.updateRol);
router.delete('/:id', verificarRol('Gerente'), rolCtrl.deleteRol);

module.exports = router;