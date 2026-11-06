const express = require("express");
const router = express.Router();
const { registrarPago, obtenerPagos, recibirWebhookMP, updatePago, deletePago } = require("../controllers/pago.controller");

router.post("/", registrarPago);
router.get("/", obtenerPagos);
router.post("/webhook", recibirWebhookMP);
router.put("/:id", updatePago);
router.delete("/:id", deletePago);

module.exports = router;
