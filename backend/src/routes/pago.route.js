const express = require("express");
const router = express.Router();
const { registrarPago, obtenerPagos, recibirWebhookMP, updatePago, deletePago } = require("../controllers/pago.controller");
const { verificarToken, verificarRol } = require("../middlewares/auth.middleware");

// Hallazgo D-01. Este archivo no importaba el middleware de autenticacion ni
// una sola vez, asi que cualquiera podia registrar o borrar un pago sin estar
// identificado. Es el mismo dominio que caja.route.js -la plata- y aquel si
// estaba protegido: no era un criterio, era un olvido.
//
// NO se usa router.use() para todo el archivo, y esa es la decision que
// importa: /webhook lo llama MercadoPago desde afuera, no una persona con
// sesion iniciada. Protegerlo con token romperia el aviso de pago y el
// pedido quedaria sin acreditar.

router.post("/", verificarToken, verificarRol("Cajero", "Gerente"), registrarPago);
router.get("/", verificarToken, verificarRol("Cajero", "Gerente"), obtenerPagos);

// Sin token a proposito: lo llama MercadoPago, no un usuario.
router.post("/webhook", recibirWebhookMP);

router.put("/:id", verificarToken, verificarRol("Gerente"), updatePago);
router.delete("/:id", verificarToken, verificarRol("Gerente"), deletePago);

module.exports = router;
