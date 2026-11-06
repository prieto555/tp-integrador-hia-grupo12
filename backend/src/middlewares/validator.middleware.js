const { validationResult } = require('express-validator');

const validarCampos = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Error de validación de datos',
            errores: errors.array()
        });
    }
    next();
};

module.exports = { validarCampos };
