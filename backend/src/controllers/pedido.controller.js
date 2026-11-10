const Pedido = require("../models/pedido.model");
const Mesa = require("../models/mesa.model");

// Techo de filas de cada listado. Sin un techo, un solo GET tumba el
// proceso: ver el comentario en obtenerPedidos.
const LIMITE_PEDIDOS = 100;
const LIMITE_PEDIDOS_MAX = 500;
const LIMITE_COCINA = 100;
const LIMITE_COCINA_MAX = 300;

// crearPedido (ahora soporta Detalles y tipoPedido)
const crearPedido = async (req, res) => {
  const { idMesa, tipoPedido, detalles, telefonoCliente, usuarioId } = req.body;
  // tipoPedido por defecto es LOCAL si no viene
  const tipo = tipoPedido || 'LOCAL';

  if (tipo === 'LOCAL' && !idMesa) {
    return res.status(400).json({ message: "El idMesa es obligatorio para crear un pedido LOCAL." });
  }

  if (!detalles || detalles.length === 0) {
    return res.status(400).json({ message: "El pedido debe contener al menos un producto (detalles)." });
  }

  try {
    // 1. Crear el Pedido (con total 0 inicialmente)
    const nuevoPedido = await Pedido.create({ 
      tipoPedido: tipo, 
      idMesa: tipo === 'LOCAL' ? idMesa : null, 
      usuarioId: usuarioId || null,
      total: 0
    });

    // 2. Si es LOCAL, pasar la mesa a OCUPADA
    if (tipo === 'LOCAL') {
      await Mesa.update({ estado: 'OCUPADA' }, { where: { idMesa: idMesa } });
    }

    // 3. Crear los Detalles y sumar el Total
    let totalGeneral = 0;
    const detallesPromises = detalles.map(async (item) => {
      // subTotal = precioUnitario * cantidad
      const subTotal = item.precioUnitario * item.cantidad;
      totalGeneral += subTotal;
      
      return require('../models/detallePedido.model').create({
        idPedido: nuevoPedido.idPedido,
        idProducto: item.idProducto,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subTotal: subTotal
      });
    });

    await Promise.all(detallesPromises);

    // 4. Actualizar el Total del Pedido
    await nuevoPedido.update({ total: totalGeneral });

    const pedidoCreado = await Pedido.findByPk(nuevoPedido.idPedido, {
      include: [
        { model: Mesa, as: "mesa" },
        { model: require('../models/detallePedido.model'), as: "detalles", include: ["producto"] }
      ]
    });

    res.status(201).json({ message: "Pedido creado correctamente", pedido: pedidoCreado });
  } catch (error) {
    res.status(500).json({ message: "Error al crear pedido", error: error.message });
  }
};

// obtenerPedidos 
const obtenerPedidos = async (req, res) => {
  try {
    // Antes esto no tenia limite. Con seis millones de pedidos, cada uno
    // con sus detalles y sus productos, Sequelize arma un objeto por fila
    // y el proceso muere con "JavaScript heap out of memory". Comprobado:
    // el contenedor del backend se reinicio solo.
    //
    // Ningun indice arregla esto. La consulta puede tardar un milisegundo
    // y el servidor morirse igual: el problema es cuantas filas devuelve.
    //
    // La respuesta sigue siendo un arreglo porque el frontend espera
    // any[]. Devolver metadatos de paginacion es la tarea E5-10.
    const limite = Math.min(
      parseInt(req.query.limite, 10) || LIMITE_PEDIDOS,
      LIMITE_PEDIDOS_MAX
    );
    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);

    const pedidos = await Pedido.findAll({
      include: [
        { model: Mesa, as: "mesa" },
        {
          model: require('../models/detallePedido.model'),
          as: "detalles",
          include: ["producto"]
        }
      ],
      order: [["idPedido", "DESC"]],
      limit: limite,
      offset: (pagina - 1) * limite,
    });
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener pedidos", error: error.message });
  }
};


// obtenerPedidoPorId
const obtenerPedidoPorId = async (req, res) => {
  try {
    const pedido = await Pedido.findByPk(req.params.id, {
      include: [{ model: Mesa, as: "mesa" }],
    });
    if (!pedido) return res.status(404).json({ message: "Pedido no encontrado" });
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el pedido", error: error.message });
  }
};

// obtenerPedidosCocina (solo pedidos PENDIENTES o EN_COCINA con items que requieran preparacion)
const obtenerPedidosCocina = async (req, res) => {
  try {
    const pedidos = await Pedido.findAll({
      where: {
        estado: ['PENDIENTE', 'EN_COCINA']
      },
      include: [
        { model: Mesa, as: "mesa" },
        { 
          model: require('../models/detallePedido.model'), 
          as: "detalles", 
          include: [{
            model: require('../models/producto.model'),
            as: "producto",
            where: {
              categoria: ['plato_principal', 'postre'] // Filtramos bebidas
            }
          }]
        }
      ],
      order: [['fechaCreacion', 'ASC']],
      // La cocina muestra lo que esta en preparacion, no el historico.
      // Sin limite son 1,33 millones de pedidos y el proceso se muere.
      limit: Math.min(
        parseInt(req.query.limite, 10) || LIMITE_COCINA,
        LIMITE_COCINA_MAX
      ),
    });

    // Sequelize inner join (where on include) might filter out orders completely if they only have drinks.
    // That is EXACTLY what we want: if an order is just 2 Coca-Colas, the kitchen shouldn't see it!
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener pedidos de cocina", error: error.message });
  }
};

// cambiarEstado actualiza el estado y libera la mesa si corresponde
const cambiarEstado = async (req, res) => {
  const estadosValidos = ["PENDIENTE", "EN_COCINA", "LISTO_PARA_ENTREGA", "ENTREGADO", "PAGADO", "CANCELADO"];
  const { estado } = req.body;

  if (!estadosValidos.includes(estado))
    return res.status(400).json({ message: "Estado inválido" });

  try {
    const pedido = await Pedido.findByPk(req.params.id);
    if (!pedido) return res.status(404).json({ message: "Pedido no encontrado" });

    await pedido.update({ estado });

    // Si se paga o se cancela, liberar la mesa
    if (["PAGADO", "CANCELADO"].includes(estado) && pedido.idMesa) {
      await Mesa.update({ estado: "LIBRE" }, { where: { idMesa: pedido.idMesa } });
    }

    res.json({ message: `Estado actualizado a ${estado}`, pedido });
  } catch (error) {
    res.status(500).json({ message: "Error al cambiar estado", error: error.message });
  }
};

// cancelar marca pedido como CANCELADO y libera la mesa
const cancelar = async (req, res) => {
  try {
    const pedido = await Pedido.findByPk(req.params.id);
    if (!pedido) return res.status(404).json({ message: "Pedido no encontrado" });

    if (pedido.estado === "PAGADO")
      return res.status(400).json({ message: "No se puede cancelar un pedido ya pagado" });

    await pedido.update({ estado: "CANCELADO" });

    if (pedido.idMesa) {
      await Mesa.update({ estado: "LIBRE" }, { where: { idMesa: pedido.idMesa } });
    }

    res.json({ message: "Pedido cancelado correctamente", pedido });
  } catch (error) {
    res.status(500).json({ message: "Error al cancelar pedido", error: error.message });
  }
};

module.exports = { obtenerPedidos, obtenerPedidosCocina, obtenerPedidoPorId, crearPedido, cambiarEstado, cancelar };