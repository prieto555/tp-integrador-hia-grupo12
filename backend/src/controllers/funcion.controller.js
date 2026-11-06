const Funcion = require('./../models/funcion.model'); // Asegúrate de usar la ruta correcta a tu modelo
const funcionCtrl = {};
// Obtener todos los empleados
funcionCtrl.getFunciones = async (req, res) => {
    try {
        const funcion = await Funcion.findAll()
        res.json(funcion);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener los roles.' });
    }
};
// Crear un nuevo empleado
funcionCtrl.createFuncion = async (req, res) => {
    try {
        // Sequelize usa .create() para instanciar y guardar en un solo paso
        await Funcion.create(req.body);
        res.json({ status: '1', msg: 'Funcion guardada.' });
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando operacion.' });
    }
};

funcionCtrl.getFuncionId = async (req, res) => {
    try {
        // Buscamos por la clave primaria (id numérico)
        const funcion = await Funcion.findByPk(req.params.id);
        if (!funcion) {
            return res.status(404).json({ status: '0', msg: 'Funcion no encontrada.' });
        }
        res.json(funcion);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener el rol.' });
    }
};

funcionCtrl.updateFuncion = async (req, res) => {
    try {
        await Funcion.update(req.body, {
            where: { id: req.body.id }
        });
        res.json({ status: '1', msg: 'Funcion actualizada'});
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando la operacion' });
    }
}

funcionCtrl.deleteFuncion = async (req, res) => {
    try {
        const id = req.params.id;
        const deleted = await Funcion.destroy({
            where: { funcionId: id } // Using the PK
        });
        if (deleted) {
            res.json({ status: '1', msg: 'Funcion eliminada' });
        } else {
            res.status(404).json({ status: '0', msg: 'Funcion no encontrada' });
        }
    } catch (error) {
        console.error(error);
        res.status(400).json({ status: '0', msg: 'Error procesando la operacion' });
    }
};

module.exports = funcionCtrl