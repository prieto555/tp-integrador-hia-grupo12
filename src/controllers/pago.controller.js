const Pago = require("../models/pago.model");
const Pedido = require("../models/pedido.model");
const Caja = require("../models/caja.model");
const Mesa = require("../models/mesa.model");
const Usuario = require("../models/usuario.model");
const sequelize = require("../../config/database");
const nodemailer = require('nodemailer');
// SDK de MercadoPago
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
//correo
// Configuración del transportador de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});
// registrarPago
const registrarPago = async (req, res) => {
  const { idPedido, metodoPago, referenciaExterna } = req.body;

  if (!idPedido || !metodoPago) {
    return res.status(400).json({ message: "idPedido y metodoPago son obligatorios" });
  }

  const t = await sequelize.transaction();

  try {
    //  verificar Pedido
    const pedido = await Pedido.findByPk(idPedido, { transaction: t });
    if (!pedido) {
      await t.rollback();
      return res.status(404).json({ message: "Pedido no encontrado" });
    }

    if (["PAGADO", "CANCELADO"].includes(pedido.estado)) {
      await t.rollback();
      return res.status(400).json({ message: `El pedido ya está ${pedido.estado}` });
    }

    // verificar Caja Abierta
    const cajaAbierta = await Caja.findOne({ where: { estado: "ABIERTA" }, transaction: t });
    if (!cajaAbierta) {
      await t.rollback();
      return res.status(400).json({ message: "No hay una caja abierta para registrar el pago" });
    }

    //  MERCADOPAGO
    if (metodoPago === "MERCADOPAGO") {
      await t.rollback(); // solo generamos el link

      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const preference = new Preference(client);

      const response = await preference.create({
        body: {
          items: [
            {
              id: idPedido.toString(),
              title: `Pedido Nro ${idPedido} - RestoYa`,
              quantity: 1,
              unit_price: Number(pedido.total || 0)
            }
          ],
          external_reference: idPedido.toString(),
          notification_url: `${process.env.NGROK_URL}/api/pagos/webhook`
        }
      });

      return res.status(200).json({
        message: "Link de MercadoPago generado. El pago se registrará cuando el cliente pague.",
        init_point: response.init_point,
        sandbox_init_point: response.sandbox_init_point
      });
    }

    // efectivo, tarjeta, transferencia, etc
    const nuevoPago = await Pago.create({
      idPedido,
      idCaja: cajaAbierta.idCaja,
      metodoPago,
      monto: pedido.total || 0,
      referenciaExterna
    }, { transaction: t });

    // actualizar Estado Pedido (pero NO liberamos la mesa, eso se hace manual cuando el cliente se va)
    await pedido.update({ estado: "PAGADO" }, { transaction: t });

    await t.commit();
    res.status(201).json({ message: "Pago registrado correctamente", pago: nuevoPago });

  } catch (error) {
    try {
      await t.rollback();
    } catch (rollbackError) {
      // Ignore "already finished" error
    }
    console.error("Error real en registrarPago:", error);
    res.status(500).json({ message: "Error al registrar pago", error: error.message });
  }
};

// webhook para recibir notificaciones de MercadoPago
const recibirWebhookMP = async (req, res) => {

  let paymentId = null;

  // MP manda notificaciones de distintas formas (Webhooks en el body, o IPN en la URL)
  if (req.body && req.body.action === "payment.created" && req.body.data && req.body.data.id) {
    paymentId = req.body.data.id;
  } else if (req.query && req.query.topic === "payment" && req.query.id) {
    // Formato IPN detectado (es el que te está enviando MP)
    paymentId = req.query.id;
  } else if (req.body && req.body.type === "payment" && req.body.data && req.body.data.id) {
    // Otra variante que a veces manda MP
    paymentId = req.body.data.id;
  } else if (req.body && req.body.idPedido) {
    // Por las dudas, dejo el soporte para la simulación manual de tu compañero
    paymentId = "SIMULACION";
  }

  // MercadoPago espera siempre un status 200 rápido, sino reintenta enviar el mensaje
  if (!paymentId) {
    return res.status(200).json({ message: "Evento ignorado (no es un pago nuevo o formato desconocido)" });
  }

  const t = await sequelize.transaction();

  try {
    let idPedido;
    let monto = 0;
    
    if (paymentId === "SIMULACION") {
      idPedido = req.body.idPedido;
    } else {
      // Nos conectamos a MercadoPago 
      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const payment = new Payment(client);
      const paymentData = await payment.get({ id: paymentId });
      
      // external_reference guarda el idPedido original
      idPedido = paymentData.external_reference;
      monto = paymentData.transaction_amount;
    }

    if (!idPedido) {
      await t.rollback();
      return res.status(200).json({ message: "El pago no tiene idPedido asociado" });
    }

    const pedido = await Pedido.findByPk(idPedido, { include: [{ model: Usuario, as: 'usuario' }], transaction: t });
    if (!pedido || pedido.estado === "PAGADO") {
      await t.rollback();
      return res.status(200).json({ message: "Pedido no válido o ya pagado" });
    }

    const cajaAbierta = await Caja.findOne({ where: { estado: "ABIERTA" }, transaction: t });
    if (!cajaAbierta) {
      await t.rollback();
      return res.status(400).json({ message: "No hay caja abierta" });
    }

    if (paymentId === "SIMULACION") {
        monto = pedido.total || 0;
    }

    // Guardamos el ingreso de plata en la Caja
    await Pago.create({
      idPedido: pedido.idPedido,
      idCaja: cajaAbierta.idCaja,
      metodoPago: "MERCADOPAGO",
      monto: monto,
      referenciaExterna: paymentId.toString()
    }, { transaction: t });

    // actualizamos pedido (la mesa queda OCUPADA hasta que el cliente se vaya físicamente)
    await pedido.update({ estado: "PAGADO" }, { transaction: t });

    await t.commit();
    //_____________________________________correo_____________________________
    const emailDestino = pedido.usuario.email; 
    const nombreUsuario = pedido.usuario.nombre;
console.log("Enviando mail a:", emailDestino);
// Configuramos el contenido del correo
const mailOptions = {
  from: `"RestoYa" <${process.env.GMAIL_USER}>`,
  to: emailDestino, // ← ¡Acá ahora va a funcionar CUALQUIER mail dinámico de la BD!
  subject: `🍽️ ¡Tu pedido N° ${pedido.idPedido} ha sido pagado! - RestoYa`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #ff4757; text-align: center;">¡Muchas gracias por tu compra, ${nombreUsuario}!</h2>
      <p style="font-size: 16px; color: #333;">Te confirmamos que hemos recibido tu pago con éxito.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 14px; color: #777; text-align: center;">Este es un correo automático de la simulación del sistema RestoYa.</p>
    </div>
  `
};

// Enviamos el mail a través de Gmail
await transporter.sendMail(mailOptions);
console.log(`📧 Correo enviado con éxito vía Gmail a: ${emailDestino}`);

    res.status(200).json({ message: "Webhook procesado con éxito. Pago registrado." });

  } catch (error) {
    try {
      await t.rollback();
    } catch (rollbackError) {
    }
    console.log("❌ ERROR CRÍTICO EN EL WEBHOOK:", error);
    res.status(500).json({ message: "Error en Webhook", error: error.message });
  }
};
//-------------------------------------------------------------
// obtenerPagos
const obtenerPagos = async (req, res) => {
  try {
    const pagos = await Pago.findAll({
      include: [
        { model: Pedido, as: "pedido" },
        { model: Caja, as: "caja" }
      ]
    });
    res.json(pagos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener pagos", error: error.message });
  }
};

const updatePago = async (req, res) => {
  try {
    const id = req.params.id;
    await Pago.update(req.body, {
      where: { idPago: id }
    });
    res.json({ message: "Pago actualizado exitosamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar pago", error: error.message });
  }
};

const deletePago = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Pago.destroy({
      where: { idPago: id }
    });
    if (deleted) {
      res.json({ message: "Pago eliminado exitosamente" });
    } else {
      res.status(404).json({ message: "Pago no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar pago", error: error.message });
  }
};

module.exports = { registrarPago, recibirWebhookMP, obtenerPagos, updatePago, deletePago };
