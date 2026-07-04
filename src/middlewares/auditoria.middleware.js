const LogAuditoria = require("../models/log-auditoria.model");

const auditoriaMiddleware = async (req, res, next) => {
    // Escuchar el evento "finish" de la respuesta para loguear solo si la operación fue exitosa (opcional)
    res.on('finish', async () => {
        // Solo registrar acciones sensibles (POST, PUT, DELETE) y que hayan sido exitosas (2xx)
        if (['POST', 'PUT', 'DELETE'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
            
            const usuarioId = req.usuario ? req.usuario.idUsuario : null;
            const accion = `${req.method} ${req.originalUrl}`;
            const detalles = JSON.stringify(req.body);

            try {
                await LogAuditoria.create({
                    usuarioId,
                    accion,
                    detalles
                });
            } catch (err) {
                console.error("Error al registrar auditoria:", err.message);
            }
        }
    });

    next();
};

module.exports = auditoriaMiddleware;
