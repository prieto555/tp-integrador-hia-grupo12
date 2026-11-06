const Caja = require("../models/caja.model");
const Pago = require("../models/pago.model");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const exportarCajaPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const caja = await Caja.findByPk(id);

    if (!caja) {
      return res.status(404).json({ message: "Caja no encontrada" });
    }

    const pagos = await Pago.findAll({ where: { idCaja: id } });

    // configurar cabeceras de respuesta para forzar la descarga del PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_caja_${id}.pdf`);

    // crear el documento PDF
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res); // enviar directamente al cliente

    // titulo
    doc.fontSize(20).text('RestoYa - Reporte de Caja', { align: 'center' });
    doc.moveDown();
    
    // informacion de la caja
    doc.fontSize(12).text(`Caja ID: ${caja.idCaja}`);
    doc.text(`Estado: ${caja.estado}`);
    doc.text(`Monto Inicial: $${caja.montoInicial}`);
    doc.text(`Monto Final: $${caja.montoFinal || 'N/A'}`);
    doc.text(`Fecha de Apertura: ${new Date(caja.fechaApertura).toLocaleString('es-AR')}`);
    doc.moveDown();

    // tabla de pagos
    doc.fontSize(14).text('Detalle de Pagos:', { underline: true });
    doc.moveDown(0.5);

    if (pagos.length === 0) {
      doc.fontSize(12).text('No se registraron pagos en esta caja.');
    } else {
      let totalRecaudado = 0;
      pagos.forEach(pago => {
        doc.fontSize(12).text(`- Pedido #${pago.idPedido} | Método: ${pago.metodoPago} | Monto: $${pago.monto}`);
        totalRecaudado += Number(pago.monto);
      });
      doc.moveDown();
      doc.fontSize(14).text(`Total Recaudado en Pagos: $${totalRecaudado}`, { bold: true });
    }

    doc.end(); // finalizar y enviar el PDF

  } catch (error) {
    console.error("Error al exportar PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error al generar el reporte PDF" });
    }
  }
};

const exportarCajaExcel = async (req, res) => {
  try {
    const { id } = req.params;
    const caja = await Caja.findByPk(id);

    if (!caja) {
      return res.status(404).json({ message: "Caja no encontrada" });
    }

    const pagos = await Pago.findAll({ where: { idCaja: id } });

    // configurar cabeceras de respuesta para descargar el Excel
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_caja_${id}.xlsx`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Caja');

    // estilo general para la hoja
    worksheet.columns = [
      { header: 'ID Pago', key: 'idPago', width: 10 },
      { header: 'ID Pedido', key: 'idPedido', width: 15 },
      { header: 'Método de Pago', key: 'metodoPago', width: 20 },
      { header: 'Monto', key: 'monto', width: 15 },
      { header: 'Fecha', key: 'fecha', width: 25 },
    ];

    // dar estilo a la cabecera
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF000000' } // fondo negro
    };

    let totalPagos = 0;

    // agregar filas
    pagos.forEach(pago => {
      worksheet.addRow({
        idPago: pago.idPago,
        idPedido: pago.idPedido,
        metodoPago: pago.metodoPago,
        monto: pago.monto,
        fecha: new Date(pago.createdAt).toLocaleString('es-AR')
      });
      totalPagos += Number(pago.monto);
    });

    // fila de total
    worksheet.addRow({}); // fila vacía
    const filaTotal = worksheet.addRow({
      metodoPago: 'TOTAL RECAUDADO:',
      monto: totalPagos
    });
    filaTotal.font = { bold: true };

    // formato de moneda para la columna monto
    worksheet.getColumn('monto').numFmt = '$#,##0.00';

    // escribir en el stream de respuesta
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Error al exportar Excel:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error al generar el reporte Excel" });
    }
  }
};

module.exports = {
  exportarCajaPDF,
  exportarCajaExcel
};
