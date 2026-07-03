const Rol = require('./../models/rol.model');

const rolCtrl = {};

// Obtener todos los roles
rolCtrl.getRol = async (req, res) => {
    try {
        const roles = await Rol.findAll();
        res.json(roles);
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: '0', msg: 'Error al obtener los roles.' });
    }
};

// Crear un nuevo rol
rolCtrl.createRol = async (req, res) => {
    try {
        await Rol.create(req.body);
        res.json({ status: '1', msg: 'Rol guardado.' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: '0', msg: 'Error procesando operacion.' });
    }
};

// Obtener un rol por ID
rolCtrl.getRolId = async (req, res) => {
    try {
        const rol = await Rol.findByPk(req.params.id);
        if (!rol) {
            return res.status(404).json({ status: '0', msg: 'Rol no encontrado.' });
        }
        res.json(rol);
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: '0', msg: 'Error al obtener el rol.' });
    }
};

// Actualizar un rol
rolCtrl.updateRol = async (req, res) => {
    try {
        const id = req.params.id; // URL parameter
        await Rol.update(req.body, {
            where: { rolId: id } // Using rolId as PK
        });
        res.json({ status: '1', msg: 'Rol actualizado' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: '0', msg: 'Error procesando la operacion' });
    }
};

module.exports = rolCtrl;