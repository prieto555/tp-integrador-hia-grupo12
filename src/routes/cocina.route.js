const express = require("express");
const router = express.Router();
const { obtenerComandas, actualizarEstadoPedido } = require("../controllers/cocina.controller");


router.get("/", obtenerComandas);


router.patch("/estado/:idPedido", actualizarEstadoPedido);

module.exports = router;