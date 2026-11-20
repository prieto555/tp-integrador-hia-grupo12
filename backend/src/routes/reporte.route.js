const express = require("express");
const router = express.Router();
const { exportarCajaPDF, exportarCajaExcel } = require("../controllers/reporte.controller");
const { verificarToken, verificarRol } = require("../middlewares/auth.middleware");

// Hallazgo D-01. El cierre de caja en PDF y en Excel se podia bajar sin
// identificarse, sabiendo nada mas el numero de caja: los montos del turno,
// a cualquiera que probara numeros.
//
// OJO AL ARREGLAR ESTO. El frente bajaba los dos archivos con window.open,
// que abre una pestana nueva y deja que el navegador pida solo. Esa peticion
// NO pasa por el interceptor de Angular, asi que iba sin token y con esta
// proteccion empezaba a dar 401 con una pestana en blanco, sin mensaje. Se
// cambio por una descarga con HttpClient (caja.service.ts), que si lleva la
// cabecera. Tocar una sin la otra rompe la pantalla de caja.
router.use(verificarToken);
router.use(verificarRol("Cajero", "Gerente"));

router.get("/caja/:id/pdf", exportarCajaPDF);
router.get("/caja/:id/excel", exportarCajaExcel);

module.exports = router;
