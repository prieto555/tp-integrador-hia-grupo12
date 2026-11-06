const Producto = require("../models/producto.model");

// crearProducto
const crearProducto = async (req, res) => {
  const { nombre, categoria, precioCosto, porcentajeGanancia, descripcion, imagenUrl } = req.body;

  if (!nombre || !categoria || precioCosto == null || porcentajeGanancia == null) {
    return res.status(400).json({ message: "Los campos nombre, categoria, precioCosto y porcentajeGanancia son obligatorios" });
  }

  try {
    // El controller calcula el precio de venta a partir del costo y el porcentaje
    const precio = precioCosto + (precioCosto * porcentajeGanancia / 100);

    const nuevoProducto = await Producto.create({
      nombre,
      descripcion,
      imagenUrl,
      categoria,
      precioCosto,
      porcentajeGanancia,
      precio,
    });

    res.status(201).json({ message: "Producto creado correctamente", producto: nuevoProducto });
  } catch (error) {
    res.status(500).json({ message: "Error al crear producto", error: error.message });
  }
};

// obtenerProductos (opcionalmente filtra por ?categoria=plato_principal) con paginacion
const obtenerProductos = async (req, res) => {
  try {
    const { categoria, page, size } = req.query;
    const where = categoria ? { categoria } : {};

    // Si se envía page y size, se usa findAndCountAll. Si no, findAll simple para retrocompatibilidad
    if (page !== undefined && size !== undefined) {
      const limit = parseInt(size, 10);
      const offset = parseInt(page, 10) * limit;
      
      const { count, rows } = await Producto.findAndCountAll({ where, limit, offset });
      return res.json({
        totalItems: count,
        data: rows,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page, 10)
      });
    }

    const productos = await Producto.findAll({ where });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener productos", error: error.message });
  }
};

// obtenerProductoPorId
const obtenerProductoPorId = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ message: "Producto no encontrado" });

    res.json(producto);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener el producto", error: error.message });
  }
};

// actualizarProducto — recalcula el precio si cambia el costo o el porcentaje
const actualizarProducto = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ message: "Producto no encontrado" });

    const { precioCosto, porcentajeGanancia } = req.body;

    // Si viene costo o porcentaje nuevo, recalcula el precio
    if (precioCosto != null || porcentajeGanancia != null) {
      const costo = precioCosto ?? producto.precioCosto;
      const porcentaje = porcentajeGanancia ?? producto.porcentajeGanancia;
      req.body.precio = costo + (costo * porcentaje / 100);
    }

    await producto.update(req.body);
    res.json({ message: "Producto actualizado correctamente", producto });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar producto", error: error.message });
  }
};

// eliminarProducto
const eliminarProducto = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ message: "Producto no encontrado" });

    await producto.destroy();
    res.json({ message: "Producto eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar producto", error: error.message });
  }
};

module.exports = {
  crearProducto,
  obtenerProductos,
  obtenerProductoPorId,
  actualizarProducto,
  eliminarProducto,
};