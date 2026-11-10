const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../../config/database");
const Pedido = require("../models/pedido.model");
const Pago = require("../models/pago.model");
const Mesa = require("../models/mesa.model");

// GET /api/dashboard/resumen
const obtenerResumen = async (req, res) => {
    try {
        const inicioHoy = new Date();
        inicioHoy.setHours(0, 0, 0, 0);

        const [ventasHoy, pedidosHoy, mesasOcupadas, historico] = await Promise.all([
            Pago.sum("monto", { where: { fechaPago: { [Op.gte]: inicioHoy } } }),
            Pedido.count({ where: { fechaCreacion: { [Op.gte]: inicioHoy } } }),
            Mesa.count({ where: { estado: "OCUPADA" } }),
            // El ticket promedio paso por tres versiones:
            //
            //   1. findAll({ where: { estado: "PAGADO" } }) y un reduce en
            //      JavaScript. Dos millones de filas viajando de la base a
            //      Node para devolver un numero. Tumbaba el proceso.
            //   2. AVG() en la base: 171 ms, sin transferir nada. Ningun
            //      indice la mejora, porque el 33% de la tabla esta en PAGADO
            //      y hay que leerla igual.
            //   3. la que esta abajo: leer el promedio ya calculado de
            //      mv_resumen_historico. 1,4 ms.
            //
            // Las otras tres cifras siguen en vivo a proposito: son las de hoy.
            sequelize.query(
                'SELECT ticket_promedio FROM mv_resumen_historico WHERE id = 1',
                { type: QueryTypes.SELECT, plain: true }
            )
        ]);

        const ticketPromedio = Number(historico && historico.ticket_promedio) || 0;

        res.json({
            ventasHoy: ventasHoy || 0,
            pedidosHoy,
            mesasOcupadas,
            ticketPromedio: Number(ticketPromedio.toFixed(2))
        });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener el resumen", error: error.message });
    }
};

// GET /api/dashboard/ventas-por-dia?dias=30
const ventasPorDia = async (req, res) => {
    try {
        const dias = parseInt(req.query.dias) || 30;
        const desde = new Date();
        desde.setDate(desde.getDate() - dias);
        desde.setHours(0, 0, 0, 0);

        // Sale de la vista materializada mv_ventas_por_dia en lugar de agrupar
        // seis millones de pagos en cada visita: 136 ms contra menos de uno.
        // El costo es que los numeros son los del ultimo refresco; para las
        // ventas del dia de hoy, que si tienen que estar al segundo, el
        // dashboard sigue consultando la tabla (ver obtenerResumen).
        const resultado = await sequelize.query(
            `SELECT fecha, total
               FROM mv_ventas_por_dia
              WHERE fecha >= :desde
              ORDER BY fecha ASC`,
            { replacements: { desde }, type: QueryTypes.SELECT }
        );

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener ventas por dia", error: error.message });
    }
};

// GET /api/dashboard/ventas-por-metodo-pago
const ventasPorMetodoPago = async (req, res) => {
    try {
        // Era la segunda consulta mas cara del sistema: un GROUP BY sobre los
        // seis millones de pagos, sin ningun filtro, cada vez que alguien
        // abria el dashboard. 553 ms. Ahora sale de la vista: 2 ms.
        const resultado = await sequelize.query(
            `SELECT "metodoPago", total
               FROM mv_ventas_por_metodo
              ORDER BY total DESC`,
            { type: QueryTypes.SELECT }
        );

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener ventas por metodo de pago", error: error.message });
    }
};

// GET /api/dashboard/productos-mas-vendidos?limite=10
const productosMasVendidos = async (req, res) => {
    try {
        const limite = parseInt(req.query.limite) || 10;

        // La consulta mas cara del sistema: 581 ms agregando las seis millones
        // de lineas de detalle. Ahora sale de mv_ventas_por_producto en 3 ms.
        //
        // La forma de la respuesta es la de antes a proposito: el componente
        // del dashboard lee item.producto.nombre y item.totalVendido.
        const filas = await sequelize.query(
            `SELECT "idProducto", nombre, unidades
               FROM mv_ventas_por_producto
              ORDER BY unidades DESC
              LIMIT :limite`,
            { replacements: { limite }, type: QueryTypes.SELECT }
        );

        const resultado = filas.map((f) => ({
            idProducto: f.idProducto,
            totalVendido: f.unidades,
            producto: { nombre: f.nombre }
        }));

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener productos mas vendidos", error: error.message });
    }
};

module.exports = { obtenerResumen, ventasPorDia, ventasPorMetodoPago, productosMasVendidos };