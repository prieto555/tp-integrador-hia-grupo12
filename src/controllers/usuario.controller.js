const Usuario = require('./../models/usuario.model');
const Rol = require('./../models/rol.model');
const bcrypt = require("bcryptjs");

const usuarioCtrl = {};

// Obtener todos los usuarios con sus roles (y paginacion opcional)
usuarioCtrl.getUsuarios = async (req, res) => {
    try {
        const { page, size } = req.query;

        if (page !== undefined && size !== undefined) {
            const limit = parseInt(size, 10);
            const offset = parseInt(page, 10) * limit;

            const { count, rows } = await Usuario.findAndCountAll({
                include: [{ model: Rol }],
                limit,
                offset
            });

            return res.json({
                totalItems: count,
                data: rows,
                totalPages: Math.ceil(count / limit),
                currentPage: parseInt(page, 10)
            });
        }

        const usuarios = await Usuario.findAll({
            include: [{ model: Rol }]
        });
        res.json(usuarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: '0', msg: 'Error al obtener los usuarios.' });
    }
};

// Crear un nuevo usuario y asignarle un rol
usuarioCtrl.createUsuario = async (req, res) => {
    try {
        const { email, password, rolId } = req.body;

        const existe = await Usuario.findOne({ where: { email } });
        if (existe) {
            return res.status(400).json({ status: '0', msg: 'Ya existe el email.' });
        }

        const hash = await bcrypt.hash(password, 10);
        const nuevoUsuario = await Usuario.create({ ...req.body, password: hash });

        // Si se envió un rol, se lo asignamos
        if (rolId) {
            await nuevoUsuario.addRol(rolId);
        }

        res.json({ status: '1', msg: 'Usuario guardado exitosamente.' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: '0', msg: 'Error procesando operacion.' });
    }
};

// Obtener un usuario por ID
usuarioCtrl.getUsuarioId = async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.params.id, {
            include: [{ model: Rol }]
        });
        if (!usuario) {
            return res.status(404).json({ status: '0', msg: 'Usuario no encontrado.' });
        }
        res.json(usuario);
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: '0', msg: 'Error al obtener el usuario.' });
    }
};

// Actualizar un usuario y su rol
usuarioCtrl.updateUsuario = async (req, res) => {
    try {
        const id = req.params.id; // Se usa req.params.id para la URL PUT /:id
        const { rolId, password } = req.body;

        const updateData = { ...req.body };
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        } else {
            delete updateData.password; // Si no manda password, no la tocamos
        }

        await Usuario.update(updateData, {
            where: { usuarioId: id } // Se usa usuarioId
        });

        // Actualizar rol
        if (rolId !== undefined) {
            const usuarioModificado = await Usuario.findByPk(id);
            if (usuarioModificado) {
                if (rolId === null) {
                    await usuarioModificado.setRols([]); // Quitar todos los roles
                } else {
                    await usuarioModificado.setRols([rolId]); // Reemplazar rol
                }
            }
        }

        res.json({ status: '1', msg: 'Usuario actualizado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: '0', msg: 'Error procesando la operacion' });
    }
};

// Eliminar un usuario
usuarioCtrl.deleteUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        await Usuario.destroy({
            where: { usuarioId: id }
        });
        res.json({ status: '1', msg: 'Usuario eliminado' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: '0', msg: 'Error al eliminar usuario' });
    }
};

module.exports = usuarioCtrl;