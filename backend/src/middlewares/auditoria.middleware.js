const Historial = require('../models/historial.model');

const auditarAccion = async (req, res, next) => {
    // Solo auditamos las acciones de escritura/borrado
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        // Escuchamos cuando la respuesta termine de procesarse
        res.on('finish', async () => {
            // Solo registramos si la accion fue exitosa (status 200-299)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    // Ignoramos el POST de login/registro ya que eso es historial de accesos normal
                    if (req.originalUrl.includes('/api/auth/login')) return;

                    const detalleAccion = `AUDITORIA: ${req.method} en ${req.originalUrl}`;
                    
                    await Historial.create({
                        // Si el usuario esta logueado, auth.middleware le inyecta req.usuario
                        usuarioId: req.usuario ? req.usuario.idUsuario : null,
                        metodo: detalleAccion,
                        ip: req.ip || req.connection.remoteAddress
                    });
                } catch (error) {
                    console.error("Error al auditar acción:", error);
                    require('fs').appendFileSync('audit_error.log', error.toString() + '\n');
                }
            }
        });
    }
    next();
};

module.exports = auditarAccion;
