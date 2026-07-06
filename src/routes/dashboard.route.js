const express = require("express");
const router = express.Router();
const {
    obtenerResumen,
    ventasPorDia,
    ventasPorMetodoPago,
    productosMasVendidos
} = require("../controllers/dashboard.controller");
const { verificarToken, verificarRol } = require("../middlewares/auth.middleware");

// Solo el Gerente ve el dashboard
router.use(verificarToken);
router.use(verificarRol("Gerente"));

router.get("/resumen", obtenerResumen);
router.get("/ventas-por-dia", ventasPorDia);
router.get("/ventas-por-metodo-pago", ventasPorMetodoPago);
router.get("/productos-mas-vendidos", productosMasVendidos);

module.exports = router;