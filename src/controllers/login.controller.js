const Usuario = require('./../models/usuario.model');
const Rol = require('./../models/rol.model');
const Funcion = require('./../models/funcion.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const loginCtrl = {};

loginCtrl.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Los campos email y password son obligatorios" });
    }

    try {
        // Buscar el usuario, incluyendo sus Roles y las Funciones de cada Rol
        const usuario = await Usuario.findOne({
            where: { email },
            include: [{
                model: Rol,
                include: [{
                    model: Funcion
                }]
            }]
        });

        if (!usuario) {
            return res.status(401).json({ message: "Credenciales invalidas" });
        }

        // Validar contraseña
        const passwordValida = await usuario.compararPassword(password);
        if (!passwordValida) {
            return res.status(401).json({ message: "Credenciales invalidas" });
        }

        // Extraer todos los permisos (funciones) de todos los roles del usuario
        let permisosSet = new Set();
        let rolesNombres = [];

        if (usuario.Rols) { // Sequelize asocia con plural by default o el nombre definido
            for (let rol of usuario.Rols) {
                rolesNombres.push(rol.nombre);
                if (rol.Funcions) {
                    for (let func of rol.Funcions) {
                        permisosSet.add(func.nombre);
                    }
                }
            }
        }

        const permisos = Array.from(permisosSet);

        // Crear payload
        const payload = {
            idUsuario: usuario.usuarioId || usuario.id, // Depende de cómo haya quedado la PK
            nombre: usuario.nombre,
            roles: rolesNombres,
            permisos: permisos
        };

        // Generar Token
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secreto_super_seguro_123', { expiresIn: "8h" });

        res.json({ message: "Login exitoso", token, usuario: payload });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al iniciar sesion", error: error.message });
    }
};

module.exports = loginCtrl;