const Rol = require('../src/models/rol.model');
const Funcion = require('../src/models/funcion.model');
const Usuario = require('../src/models/usuario.model');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
    try {
        // Verificar si ya existen roles
        const countRoles = await Rol.count();
        if (countRoles > 0) {
            console.log("Seed: La base de datos ya tiene roles. Omitiendo seed.");
            return;
        }

        console.log("Seed: Inicializando datos base...");

        // 1. Crear Funciones (Permisos)
        const funciones = {
            ver_mesas: await Funcion.create({ nombre: 'ver_mesas', detalle: 'Ver el mapa de mesas' }),
            crear_pedido: await Funcion.create({ nombre: 'crear_pedido', detalle: 'Crear pedidos nuevos' }),
            ver_pedidos_listos: await Funcion.create({ nombre: 'ver_pedidos_listos', detalle: 'Ver los pedidos para entregar' }),
            cobrar_pedido: await Funcion.create({ nombre: 'cobrar_pedido', detalle: 'Cobrar pedidos y abrir caja' }),
            gestionar_usuarios: await Funcion.create({ nombre: 'gestionar_usuarios', detalle: 'Crear o modificar usuarios y roles' }),
            ver_items_cocina: await Funcion.create({ nombre: 'ver_items_cocina', detalle: 'Ver los items pendientes de cocinar' }),
            cambiar_estado_item: await Funcion.create({ nombre: 'cambiar_estado_item', detalle: 'Marcar items como listos' })
        };

        // 2. Crear Roles
        const gerente = await Rol.create({ tipo: 'ADMIN', nombre: 'Gerente' });
        const cajero = await Rol.create({ tipo: 'STAFF', nombre: 'Cajero' });
        const mozo = await Rol.create({ tipo: 'STAFF', nombre: 'Mozo' });
        const cocina = await Rol.create({ tipo: 'STAFF', nombre: 'Cocina' });

        // 3. Asignar Permisos a los Roles (Roles_Funciones)
        // Gerente tiene TODO
        await gerente.addFuncions(Object.values(funciones));
        
        // Cajero
        await cajero.addFuncions([funciones.ver_pedidos_listos, funciones.cobrar_pedido]);
        
        // Mozo
        await mozo.addFuncions([funciones.ver_mesas, funciones.crear_pedido, funciones.ver_pedidos_listos]);
        
        // Cocina
        await cocina.addFuncions([funciones.ver_items_cocina, funciones.cambiar_estado_item]);

        // 4. Crear Usuario Administrador (Gerente) por defecto
        const adminPassword = process.env.ADMIN_PASSWORD;
        const adminEmail = process.env.ADMIN_EMAIL;
        const hash = await bcrypt.hash(adminPassword, 10);
        const admin = await Usuario.create({
            nombre: 'Admin',
            apellido: 'Sistema',
            dni: '00000000',
            email: adminEmail,
            password: hash
        });

        // 5. Asignar rol de Gerente al admin
        await admin.addRol(gerente);

        console.log(`Seed: ¡Base de datos poblada exitosamente con el usuario ${adminEmail}!`);

    } catch (error) {
        console.error("Seed Error: No se pudo poblar la base de datos.", error);
    }
};

module.exports = seedDatabase;
