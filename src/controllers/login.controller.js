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

        const passwordValida = await usuario.compararPassword(password);
        if (!passwordValida) {
            return res.status(401).json({ message: "Credenciales invalidas" });
        }

        let permisosSet = new Set();
        let rolesNombres = [];

        if (usuario.Rols) {
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

        const payload = {
            idUsuario: usuario.usuarioId || usuario.id,
            nombre: usuario.nombre,
            roles: rolesNombres,
            permisos: permisos
        };

        // Generar Token normal
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });
        res.json({ message: "Login exitoso", token, usuario: payload });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al iniciar sesion", error: error.message });
    }
};

const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '317530665710-rclujld7vo1j9vangvt5enqnghkilde4.apps.googleusercontent.com');

loginCtrl.googleLogin = async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ message: "El token de Google es obligatorio" });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID || '317530665710-rclujld7vo1j9vangvt5enqnghkilde4.apps.googleusercontent.com',
        });
        
        const payload = ticket.getPayload();
        const email = payload.email;
        const nombre = payload.given_name || payload.name || 'Usuario';
        const apellido = payload.family_name || 'Google';
        
        // Buscar si existe el usuario
        let usuario = await Usuario.findOne({ 
            where: { email },
            include: [{ model: Rol, include: [{ model: Funcion }] }]
        });

        // Si no existe, lo creamos como Cliente por defecto
        if (!usuario) {
            // Buscamos el rol de cliente
            let rolCliente = await Rol.findOne({ where: { nombre: 'Cliente' } });
            if (!rolCliente) {
                rolCliente = await Rol.create({ nombre: 'Cliente' });
            }
            
            const randomPassword = Math.random().toString(36).slice(-8);
            const hash = await bcrypt.hash(randomPassword, 10);
            
            usuario = await Usuario.create({
                email,
                nombre,
                apellido,
                password: hash,
                dni: null // DNI is now optional
            });
            await usuario.addRol(rolCliente);
            
            // Recargar con roles
            usuario = await Usuario.findByPk(usuario.usuarioId || usuario.id, {
                include: [{ model: Rol, include: [{ model: Funcion }] }]
            });
        }

        // Generar payload
        let permisosSet = new Set();
        let rolesNombres = [];

        if (usuario.Rols) {
            for (let rol of usuario.Rols) {
                rolesNombres.push(rol.nombre);
                if (rol.Funcions) {
                    for (let func of rol.Funcions) {
                        permisosSet.add(func.nombre);
                    }
                }
            }
        }

        const appPayload = {
            idUsuario: usuario.usuarioId || usuario.id,
            nombre: usuario.nombre,
            roles: rolesNombres,
            permisos: Array.from(permisosSet)
        };

        const jwtToken = jwt.sign(appPayload, process.env.JWT_SECRET, { expiresIn: "8h" });
        res.json({ message: "Google Login exitoso", token: jwtToken, usuario: appPayload });

    } catch (error) {
        console.error("Error validando token de Google:", error.message);
        res.status(401).json({ message: "Token de Google inválido" });
    }
};

module.exports = loginCtrl;