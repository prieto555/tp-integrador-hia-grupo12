const Usuario = require('./../models/usuario.model'); // Asegúrate de usar la ruta correcta a tu modelo
const loginCtrl = require('./login.controller');
const bcrypt = require("bcryptjs")
const usuarioCtrl = {};
// Obtener todos los usuarios
usuarioCtrl.getUsuarios = async (req, res) => {
    try {
        const usuario = await Usuario.findAll()
        res.json(usuario);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener los usuarios.' });
    }
};
// Crear un nuevo usuario
usuarioCtrl.createUsuario = async (req, res) => {
    try {
            const {email, password} = req.body

            const existe = await Usuario.findOne({
            where: {
                email: email
            }
        })
        if(existe)
            res.json({ status: '0', msg: 'Ya existe el email.' });
        else{
            const hash = await bcrypt.hash(password, 10);
            await Usuario.create({...req.body,password:hash});
            res.json({ status: '1', msg: 'Usuario guardado.' });
        }
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando operacion.' });
    }
};

usuarioCtrl.getUsuarioId = async (req, res) => {
    try {
        // Buscamos por la clave primaria (id numérico)
        const usuario = await Usuario.findByPk(req.params.id);
        if (!usuario) {
            return res.status(404).json({ status: '0', msg: 'Usuario no encontrado.' });
        }
        res.json(usuario);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener el usuario.' });
    }
};

usuarioCtrl.updateUsuario = async (req, res) => {
    try {
        await Usuario.update(req.body, {
            where: { id: req.body.id }
        });
        res.json({ status: '1', msg: 'Usuario actualizado' });
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando la operacion' });
    }
}

module.exports = usuarioCtrl