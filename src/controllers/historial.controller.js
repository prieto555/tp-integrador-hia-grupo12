const Historial = require('../models/historial.model');
const Usuario = require('../models/usuario.model');

const obtenerHistorial = async (req, res) => {
    try {
        const accesos = await Historial.findAll({
            include: [{
                model: Usuario,
                attributes: ['nombre', 'apellido', 'email'] // Solo traemos datos publicos
            }],
            order: [['fechaHora', 'DESC']], // Los mas recientes primero
            limit: 100 // Limite por seguridad
        });
        res.json(accesos);
    } catch (error) {
        console.error("Error al obtener historial:", error);
        res.status(500).json({ message: "Error al obtener historial de accesos", error: error.message });
    }
};

module.exports = { obtenerHistorial };
