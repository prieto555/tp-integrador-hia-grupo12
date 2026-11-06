/**
 * Scrip para porbar datos de prueba para el dashboard
 */
require("dotenv").config();
const sequelize = require("../config/database");
const Mesa = require("../src/models/mesa.model");
const Producto = require("../src/models/producto.model");
const Pedido = require("../src/models/pedido.model");
const DetallePedido = require("../src/models/detallePedido.model");
const Pago = require("../src/models/pago.model");
const Caja = require("../src/models/caja.model");

const METODOS_PAGO = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "MERCADOPAGO"];

function fechaHaceNDias(n) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - n);
  fecha.setHours(12, Math.floor(Math.random() * 60), 0, 0); // hora random del mediodia
  return fecha;
}

function elegirAlAzar(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function seedDashboardTestData() {
  try {
    await sequelize.authenticate();
    console.log("Conectado a la base. Generando datos de prueba");

    const mesas = await Mesa.findAll();
    const productos = await Producto.findAll();

    if (mesas.length === 0 || productos.length === 0) {
      console.error("No hay mesas o productos en la base. Corré primero el servidor (npm run dev) para que el seed.js normal los cree");
      process.exit(1);
    }

    // Buscamos una caja abierta, o creamos una para poder asociar los pagos
    let caja = await Caja.findOne({ where: { estado: "ABIERTA" } });
    if (!caja) {
      caja = await Caja.create({ montoInicial: 5000, estado: "ABIERTA" });
      console.log("Se creó una caja de prueba (ABIERTA) para asociar los pagos");
    }

    let pedidosCreados = 0;
    let pagosCreados = 0;

    // Generamos entre 1 y 4 pedidos pagados por cada uno de los ultimos 14 dias
    for (let diasAtras = 13; diasAtras >= 0; diasAtras--) {
      const cantidadPedidosDelDia = 1 + Math.floor(Math.random() * 4);

      for (let i = 0; i < cantidadPedidosDelDia; i++) {
        const fecha = fechaHaceNDias(diasAtras);
        const mesa = elegirAlAzar(mesas);

        // Elegimos entre 1 y 3 productos distintos para este pedido
        const cantidadItems = 1 + Math.floor(Math.random() * 3);
        const itemsElegidos = [];
        for (let j = 0; j < cantidadItems; j++) {
          itemsElegidos.push(elegirAlAzar(productos));
        }

        const pedido = await Pedido.create({
          idMesa: mesa.idMesa,
          tipoPedido: "LOCAL",
          estado: "PAGADO",
          fechaCreacion: fecha,
          total: 0,
        });

        let totalPedido = 0;
        for (const producto of itemsElegidos) {
          const cantidad = 1 + Math.floor(Math.random() * 3);
          const subTotal = producto.precio * cantidad;
          totalPedido += subTotal;

          await DetallePedido.create({
            idPedido: pedido.idPedido,
            idProducto: producto.idProducto,
            cantidad,
            precioUnitario: producto.precio,
            subTotal,
          });
        }

        await pedido.update({ total: totalPedido });
        pedidosCreados++;

        await Pago.create({
          idPedido: pedido.idPedido,
          idCaja: caja.idCaja,
          metodoPago: elegirAlAzar(METODOS_PAGO),
          monto: totalPedido,
          fechaPago: fecha,
        });
        pagosCreados++;
      }
    }

    console.log(`Listo! Se crearon ${pedidosCreados} pedidos y ${pagosCreados} pagos de prueba distribuidos en los ultimos 14 dias.`);
    process.exit(0);
  } catch (error) {
    console.error("Error generando datos de prueba:", error);
    process.exit(1);
  }
}

seedDashboardTestData();
