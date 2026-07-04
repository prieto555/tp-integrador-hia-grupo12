const jwt = require("jsonwebtoken");

// verificarToken: valida el JWT y agrega los datos del usuario a req.usuario
const verificarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Token no proporcionado" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_seguro_123');
        req.usuario = payload; // payload: { idUsuario, email, roles, permisos }
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token invalido o expirado" });
    }
};

// verificarPermiso: exige que el usuario tenga al menos uno de los permisos dados
const verificarPermiso = (...permisosRequeridos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ message: "No autenticado" });
        }

        const permisosDelUsuario = req.usuario.permisos || [];
        const tienePermiso = permisosRequeridos.some((p) => permisosDelUsuario.includes(p));

        if (!tienePermiso) {
            return res.status(403).json({
                message: `Acceso denegado. No tenes permisos suficientes para esta accion.`,
            });
        }
        next();
    };
};

// verificarRol: exige que el usuario tenga al menos uno de los roles dados
const verificarRol = (...rolesRequeridos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ message: "No autenticado" });
        }

        const rolesDelUsuario = req.usuario.roles || [];
        const tieneRol = rolesRequeridos.some((r) => rolesDelUsuario.includes(r));

        if (!tieneRol) {
            return res.status(403).json({
                message: `Acceso denegado. Se requiere rol: ${rolesRequeridos.join(' o ')}`,
            });
        }
        next();
    };
};

module.exports = { verificarToken, verificarPermiso, verificarRol };
