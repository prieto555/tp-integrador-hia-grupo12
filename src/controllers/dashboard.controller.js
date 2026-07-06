const { Op, fn, col, literal } = require("sequelize");
const Pedido = require("../models/pedido.model");
const Pago = require("../models/pago.model");
const DetallePedido = require("../models/detallePedido.model");
const Producto = require("../models/producto.model");
const Mesa = require("../models/mesa.model");

// GET /api/dashboard/resumen
const obtenerResumen = async (req, res) => {
    try {
        const inicioHoy = new Date();
        inicioHoy.setHours(0, 0, 0, 0);

        const [ventasHoy, pedidosHoy, mesasOcupadas, pedidosPagados] = await Promise.all([
            Pago.sum("monto", { where: { fechaPago: { [Op.gte]: inicioHoy } } }),
            Pedido.count({ where: { fechaCreacion: { [Op.gte]: inicioHoy } } }),
            Mesa.count({ where: { estado: "OCUPADA" } }),
            Pedido.findAll({ where: { estado: "PAGADO" }, attributes: ["total"] })
        ]);

        const totalHistorico = pedidosPagados.reduce((acc, p) => acc + Number(p.total), 0);
        const ticketPromedio = pedidosPagados.length > 0 ? totalHistorico / pedidosPagados.length : 0;

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

        const resultado = await Pago.findAll({
            attributes: [
                [fn("DATE", col("fechaPago")), "fecha"],
                [fn("SUM", col("monto")), "total"]
            ],
            where: { fechaPago: { [Op.gte]: desde } },
            group: [fn("DATE", col("fechaPago"))],
            order: [[fn("DATE", col("fechaPago")), "ASC"]],
            raw: true
        });

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener ventas por dia", error: error.message });
    }
};

// GET /api/dashboard/ventas-por-metodo-pago
const ventasPorMetodoPago = async (req, res) => {
    try {
        const resultado = await Pago.findAll({
            attributes: [
                "metodoPago",
                [fn("SUM", col("monto")), "total"]
            ],
            group: ["metodoPago"],
            raw: true
        });

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener ventas por metodo de pago", error: error.message });
    }
};

// GET /api/dashboard/productos-mas-vendidos?limite=10
const productosMasVendidos = async (req, res) => {
    try {
        const limite = parseInt(req.query.limite) || 10;

        const resultado = await DetallePedido.findAll({
            attributes: [
                [col("DetallePedido.idProducto"), "idProducto"],
                [fn("SUM", col("DetallePedido.cantidad")), "totalVendido"]
            ],
            include: [{ model: Producto, as: "producto", attributes: ["nombre"] }],
            group: ["DetallePedido.idProducto", "producto.idProducto", "producto.nombre"],
            order: [[literal('"totalVendido"'), "DESC"]],
            limit: limite,
            raw: true,
            nest: true
        });

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener productos mas vendidos", error: error.message });
    }
};

module.exports = { obtenerResumen, ventasPorDia, ventasPorMetodoPago, productosMasVendidos };