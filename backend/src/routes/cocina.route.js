const express = require("express");
const router = express.Router();
const { obtenerComandas, actualizarEstadoPedido } = require("../controllers/cocina.controller");
const { verificarToken, verificarRol } = require("../middlewares/auth.middleware");

// Hallazgo D-01. PATCH /estado/:idPedido cambiaba el estado de CUALQUIER
// pedido sin identificarse: se podia marcar como entregado algo que nunca
// salio de la cocina.
//
// Los dos permisos no son iguales a proposito. Ver las comandas lo necesitan
// tambien el mozo y el gerente para saber como viene el salon; cambiarles el
// estado es trabajo de cocina.
router.use(verificarToken);

router.get("/", verificarRol("Cocina", "Mozo", "Gerente"), obtenerComandas);

router.patch("/estado/:idPedido", verificarRol("Cocina", "Gerente"), actualizarEstadoPedido);

module.exports = router;