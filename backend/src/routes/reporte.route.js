const express = require("express");
const router = express.Router();
const { exportarCajaPDF, exportarCajaExcel } = require("../controllers/reporte.controller");

router.get("/caja/:id/pdf", exportarCajaPDF);
router.get("/caja/:id/excel", exportarCajaExcel);

module.exports = router;
