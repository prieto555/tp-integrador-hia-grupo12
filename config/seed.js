const Rol = require('../src/models/rol.model');
const Funcion = require('../src/models/funcion.model');
const Usuario = require('../src/models/usuario.model');
const Producto = require('../src/models/producto.model');
const Mesa = require('../src/models/mesa.model');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
    try {
        console.log("Seed: Inicializando datos base...");

        // 0. Crear Productos por defecto si no hay
        const countProductos = await Producto.count();
        if (countProductos === 0) {
            await Producto.bulkCreate([
                { nombre: 'Hamburguesa Clasica', descripcion: 'Doble carne, cheddar, bacon y papas', precio: 8500, categoria: 'plato_principal', imagenUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80' },
                { nombre: 'Pizza Margarita', descripcion: 'Salsa de tomate, mozzarella y albahaca fresca', precio: 12000, categoria: 'plato_principal', imagenUrl: 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=500&q=80' },
                { nombre: 'Coca Cola 1.5L', descripcion: 'Gaseosa linea Coca Cola', precio: 3000, categoria: 'bebida', imagenUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&q=80' },
                { nombre: 'Volcan de Chocolate', descripcion: 'Con centro liquido y bocha de helado de crema', precio: 4500, categoria: 'postre', imagenUrl: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=500&q=80' }
            ]);
            console.log(`Seed: Productos por defecto insertados!`);
        }

        // 0.5 Crear Mesas por defecto si no hay
        const countMesas = await Mesa.count();
        if (countMesas === 0) {
            await Mesa.bulkCreate([
                { numMesa: 1, capacidad: 2, estado: 'LIBRE' },
                { numMesa: 2, capacidad: 2, estado: 'LIBRE' },
                { numMesa: 3, capacidad: 4, estado: 'LIBRE' },
                { numMesa: 4, capacidad: 4, estado: 'LIBRE' },
                { numMesa: 5, capacidad: 4, estado: 'LIBRE' },
                { numMesa: 6, capacidad: 6, estado: 'LIBRE' },
                { numMesa: 7, capacidad: 6, estado: 'LIBRE' }
            ]);
            console.log(`Seed: 7 Mesas por defecto insertadas!`);
        }

        // Verificar si ya existen roles
        const countRoles = await Rol.count();
        if (countRoles > 0) {
            console.log("Seed: La base de datos ya tiene roles. Omitiendo seed de usuarios.");
            return;
        }

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

        console.log(`Seed: ¡Base de datos poblada exitosamente con el usuario ${adminEmail} y productos por defecto!`);

    } catch (error) {
        console.error("Seed Error: No se pudo poblar la base de datos.", error);
    }
};

module.exports = seedDatabase;
