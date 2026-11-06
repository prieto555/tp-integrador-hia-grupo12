import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MesaService } from '../../services/mesa.service';
import { CarritoService } from '../../services/carrito.service';
import { AuthService } from '../../services/auth.service';
import { PedidoService } from '../../services/pedido.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mesa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mesa.component.html',
  styleUrl: './mesa.component.css',
})
export class MesaComponent implements OnInit {
  mesas: any[] = [];
  cargando: boolean = true;

  nuevaMesa = {
    numMesa: null,
    capacidad: null
  };

  esAdmin: boolean = false;

  constructor(
    private mesaService: MesaService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private carritoService: CarritoService,
    private authService: AuthService,
    private pedidoService: PedidoService
  ) { }

  ngOnInit(): void {
    this.esAdmin = this.authService.tienePermiso('gestionar_usuarios');
    this.cargarMesas();
  }
  atenderMesa(idMesa: number, numMesa: number): void {
    // guardamos la mesa seleccionada en el estado global (Carrito)
    this.carritoService.setMesa(idMesa, numMesa);

    // navegamos al layout de pedidos (defecto platos)
    this.router.navigate(['/platos']);
  }

  cargarMesas(): void {
    this.cargando = true;
    this.mesaService.getMesas().subscribe({
      next: (data) => {
        this.mesas = data.sort((a: any, b: any) => a.numMesa - b.numMesa);
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error(error);
        this.cargando = false;
      }
    });
  }

  crearMesa(): void {
    if (!this.nuevaMesa.numMesa || !this.nuevaMesa.capacidad) {
      Swal.fire('Atención', 'Por favor complete todos los campos.', 'warning');
      return;
    }

    if (this.nuevaMesa.numMesa <= 0 || this.nuevaMesa.capacidad <= 0) {
      Swal.fire('Atención', 'El número de mesa y la capacidad deben ser mayores a 0.', 'warning');
      return;
    }

    this.mesaService.crearMesa(this.nuevaMesa as any).subscribe({
      next: () => {
        Swal.fire('¡Éxito!', 'Mesa creada correctamente.', 'success');
        this.nuevaMesa = { numMesa: null, capacidad: null };
        this.cargarMesas();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || "Error al crear la mesa.", 'error');
      }
    });
  }

  cambiarEstado(idMesa: number, estadoActual: string): void {
    // si esta libre, la pasamos a ocupada. si esta ocupada, a libre
    const nuevoEstado = estadoActual === 'LIBRE' ? 'OCUPADA' : 'LIBRE';

    this.mesaService.cambiarEstado(idMesa, nuevoEstado).subscribe({
      next: () => this.cargarMesas(),
      error: (err) => Swal.fire('Error', err.error?.message || "Error al cambiar estado", 'error')
    });
  }

  liberarMesa(idMesa: number): void {
    Swal.fire({
      title: '¿Liberar Mesa?',
      text: '¿Confirmás que el cliente ya pagó y se retiró? La mesa quedará LIBRE.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, liberar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.mesaService.liberarMesa(idMesa).subscribe({
          next: () => this.cargarMesas(),
          error: (err) => Swal.fire('Error', err.error?.message || "Error al liberar la mesa", 'error')
        });
      }
    });
  }

  eliminarMesa(idMesa: number): void {
    Swal.fire({
      title: '¿Eliminar Mesa?',
      text: '¿Estás seguro que querés eliminar esta mesa?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.mesaService.eliminarMesa(idMesa).subscribe({
          next: () => {
            Swal.fire('¡Eliminada!', 'Mesa eliminada.', 'success');
            this.cargarMesas();
          },
          error: (err) => Swal.fire('Error', err.error?.message || "Error al eliminar la mesa.", 'error')
        });
      }
    });
  }

  verPedido(idMesa: number): void {
    Swal.fire({ title: 'Buscando pedido...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    this.pedidoService.obtenerPedidos().subscribe({
      next: (pedidos) => {
        const pedidoMesa = pedidos.find(p => p.idMesa === idMesa && p.estado !== 'PAGADO' && p.estado !== 'CANCELADO');
        
        if (!pedidoMesa) {
          Swal.fire('Sin Pedidos', 'Esta mesa está ocupada pero aún no tiene ningún pedido activo asociado.', 'info');
          return;
        }

        let detallesHtml = '<ul class="list-group list-group-flush text-start mt-3">';
        let total = 0;
        for (let det of pedidoMesa.detalles) {
          detallesHtml += `<li class="list-group-item d-flex justify-content-between align-items-center bg-transparent text-dark border-secondary">
            <div>
              <span class="badge bg-secondary me-2">${det.cantidad}</span> ${det.producto.nombre}
            </div>
            <span>$${det.precioUnitario * det.cantidad}</span>
          </li>`;
          total += (det.precioUnitario * det.cantidad);
        }
        detallesHtml += `</ul><div class="mt-3 text-end fw-bold fs-5">Total: $${total}</div>`;

        Swal.fire({
          title: `Comanda - Mesa ${pedidoMesa.mesa?.numMesa || idMesa}`,
          html: detallesHtml,
          confirmButtonText: 'Cerrar',
          confirmButtonColor: '#009ee3',
          width: '500px'
        });
      },
      error: (err) => {
        Swal.fire('Error', 'No se pudieron obtener los pedidos.', 'error');
      }
    });
  }

  // --- LÓGICA DE EDICIÓN ---
  mostrarModal: boolean = false;
  mesaIdAEditar: number | null = null;
  mesaAEditar = { numMesa: null, capacidad: null };

  abrirModalEditar(mesa: any): void {
    this.mostrarModal = true;
    this.mesaIdAEditar = mesa.idMesa;
    this.mesaAEditar = { numMesa: mesa.numMesa, capacidad: mesa.capacidad };
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.mesaIdAEditar = null;
    this.mesaAEditar = { numMesa: null, capacidad: null };
  }

  guardarMesaEditada(): void {
    if (!this.mesaAEditar.numMesa || !this.mesaAEditar.capacidad) {
      Swal.fire('Atención', 'Por favor complete todos los campos.', 'warning');
      return;
    }

    if (this.mesaAEditar.numMesa <= 0 || this.mesaAEditar.capacidad <= 0) {
      Swal.fire('Atención', 'El número de mesa y la capacidad deben ser mayores a 0.', 'warning');
      return;
    }

    this.mesaService.actualizarMesa(this.mesaIdAEditar!, this.mesaAEditar as any).subscribe({
      next: () => {
        Swal.fire('¡Éxito!', 'Mesa actualizada correctamente.', 'success');
        this.cerrarModal();
        this.cargarMesas();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || "Error al actualizar la mesa.", 'error');
      }
    });
  }
}
