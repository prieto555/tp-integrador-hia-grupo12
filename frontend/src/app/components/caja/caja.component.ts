import { environment } from '../../../environments/environment';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CajaService } from '../../services/caja.service';
import { PedidoService } from '../../services/pedido.service';
import { PagoService } from '../../services/pago.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './caja.component.html',
  styleUrl: './caja.component.css'
})
export class CajaComponent implements OnInit {
  cajaActiva: any = null;
  montoInicial: number = 0;
  pedidosPendientes: any[] = [];
  pedidoSeleccionado: any = null;
  totalPedidoSeleccionado: number = 0;

  // variable para ROL 
  esAdminOCajero: boolean = true;

  constructor(
    private cajaService: CajaService, 
    private pedidoService: PedidoService,
    private pagoService: PagoService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.verificarCaja();
  }

  verificarCaja(): void {
    this.cajaService.obtenerCajaActiva().subscribe({
      next: (data) => {
        this.cajaActiva = data;
        this.cargarPedidosPendientes();
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.status === 404) {
          this.cajaActiva = null;
          this.pedidosPendientes = [];
          this.cdr.detectChanges();
        } else {
          console.error("Error al obtener caja:", err);
        }
      }
    });
  }

  cargarPedidosPendientes(): void {
    this.pedidoService.obtenerPedidos().subscribe({
      next: (pedidos) => {
        // Filtramos solo los pedidos que no estan pagados ni cancelados
        this.pedidosPendientes = pedidos.filter((p: any) => p.estado !== 'PAGADO' && p.estado !== 'CANCELADO');
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error("Error obteniendo pedidos", err)
    });
  }

  abrirCaja(): void {
    if (this.montoInicial < 0) {
      Swal.fire('Error', 'El monto no puede ser negativo', 'error');
      return;
    }

    this.cajaService.abrirCaja(this.montoInicial).subscribe({
      next: () => {
        Swal.fire('¡Éxito!', 'Caja abierta exitosamente', 'success');
        this.verificarCaja();
      },
      error: (err) => Swal.fire('Error', err.error?.message || "Error al abrir la caja", 'error')
    });
  }

  cerrarCaja(): void {
    Swal.fire({
      title: '¿Cerrar Caja?',
      text: '¿Estas seguro que queres cerrar la caja del turno?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.cajaService.cerrarCaja().subscribe({
          next: (res) => {
            Swal.fire('Caja Cerrada', `Monto final: $${res.caja.montoFinal}`, 'info');
            this.verificarCaja();
          },
          error: (err) => Swal.fire('Error', err.error?.message || "Error al cerrar la caja", 'error')
        });
      }
    });
  }

  abrirTicket(pedido: any): void {
    this.pedidoSeleccionado = pedido;
    this.totalPedidoSeleccionado = pedido.detalles.reduce((acc: number, det: any) => acc + (det.cantidad * det.precioUnitario), 0);
  }

  cerrarTicket(): void {
    this.pedidoSeleccionado = null;
  }

  confirmarCobroEfectivo(): void {
    if (!this.pedidoSeleccionado) return;

    this.pagoService.registrarPago({
      idPedido: this.pedidoSeleccionado.idPedido,
      metodoPago: 'EFECTIVO'
    }).subscribe({
      next: () => {
        Swal.fire('¡Cobro Exitoso!', 'El pago fue registrado, la ganancia se sumó a la caja y la mesa fue liberada automáticamente.', 'success');
        this.cerrarTicket();
        this.verificarCaja(); // Recarga la caja y los pedidos
      },
      error: (err: any) => {
        Swal.fire('Error al cobrar', err.error?.message || 'Hubo un problema al registrar el pago.', 'error');
      }
    });
  }

  descargarPDF(idCaja: number): void {
    this.descargarReporte(idCaja, 'pdf', `cierre-caja-${idCaja}.pdf`);
  }

  descargarExcel(idCaja: number): void {
    this.descargarReporte(idCaja, 'excel', `cierre-caja-${idCaja}.xlsx`);
  }

  // Antes esto era window.open, que abre una pestana nueva y deja que el
  // navegador haga la peticion por su cuenta. El problema es que esa peticion
  // NO pasa por el interceptor, asi que va sin la cabecera Authorization: al
  // proteger la ruta de reportes, la descarga devolvia 401 y se veia como una
  // pestana en blanco, sin ningun mensaje.
  //
  // Pidiendolo con HttpClient el token viaja, y el archivo se baja armando un
  // enlace temporal con el contenido ya recibido.
  private descargarReporte(idCaja: number, formato: 'pdf' | 'excel', nombre: string): void {
    this.cajaService.descargarReporte(idCaja, formato).subscribe({
      next: (archivo: Blob) => {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombre;
        enlace.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        Swal.fire('No se pudo descargar', 'El reporte no se pudo generar. Probá cerrar la caja y volver a intentar.', 'error');
      }
    });
  }
}
