import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, Router } from '@angular/router';
import { CarritoService, ItemCarrito } from '../../services/carrito.service';
import { PedidoService } from '../../services/pedido.service';
import { MesaService } from '../../services/mesa.service';
import { PagoService } from '../../services/pago.service';
import { forkJoin } from 'rxjs';

import Swal from 'sweetalert2';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-layout-pedido',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './layout-pedido.component.html',
  styleUrl: './layout-pedido.component.css',
})
export class LayoutPedidoComponent implements OnInit {
  mesaActiva: { idMesa: number, numMesa: number } | null = null;
  items: ItemCarrito[] = [];
  total: number = 0;

  // Variables del Clima
  llueve: boolean = false;
  climaMensaje: string = 'Día lluvioso en la ciudad 🌧️ El delivery puede tener demoras. ¡Gracias por tu paciencia!';

  constructor(
    private carritoService: CarritoService,
    private pedidoService: PedidoService,
    private mesaService: MesaService,
    private pagoService: PagoService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    this.verificarClima();

    this.carritoService.mesaActiva$.subscribe(mesa => {
      this.mesaActiva = mesa;
    });

    this.carritoService.items$.subscribe(items => {
      this.items = items;
      this.total = this.carritoService.getTotal();
    });
  }

  async verificarClima() {
    try {
      // Coordenadas de San Salvador de Jujuy
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-24.1833&longitude=-65.3316&current_weather=true');
      const data = await res.json();
      const code = data.current_weather.weathercode;

      // Códigos de lluvia (llovizna, lluvia, tormenta en Open-Meteo)
      if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) {
        this.llueve = true;
        this.climaMensaje = 'Día lluvioso en la ciudad 🌧️ El delivery puede tener demoras. ¡Gracias por tu paciencia!';
      }
    } catch (e) {
      console.log('Error obteniendo clima:', e);
    }
  }

  sumarItem(item: ItemCarrito) {
    this.carritoService.agregarProducto(item);
  }

  restarItem(idProducto: number) {
    this.carritoService.restarProducto(idProducto);
  }

  eliminarItem(idProducto: number) {
    this.carritoService.eliminarProducto(idProducto);
  }

  vaciarCarrito() {
    this.carritoService.vaciarCarrito();
  }

  confirmarPedido(metodoElegido: string) {
    const tipoPedido = this.mesaActiva ? 'LOCAL' : 'DELIVERY';
    const idMesa = this.mesaActiva ? this.mesaActiva.idMesa : null;

    if (this.items.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Carrito Vacío',
        text: '¡Agregá productos primero antes de confirmar!',
        confirmButtonColor: '#ffc107'
      });
      return;
    }

    if (!this.authService.estaAutenticado()) {
      Swal.fire({
        title: '¡Iniciá sesión para pedir!',
        html: `
          <p class="mb-4 text-muted">Para confirmar tu pedido (${tipoPedido.toLowerCase()}), necesitás iniciar sesión primero.</p>
          <div id="google-btn-container" class="d-flex justify-content-center"></div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        didOpen: () => {
          // Cargar script de Google dinámicamente si no existe
          if (!document.getElementById('google-jssdk')) {
            const script = document.createElement('script');
            script.id = 'google-jssdk';
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => this.renderGoogleButton(idMesa, tipoPedido, metodoElegido);
            document.head.appendChild(script);
          } else {
            this.renderGoogleButton(idMesa, tipoPedido, metodoElegido);
          }
        }
      });
    } else {
      this.procesarPedidoEnBackend(idMesa, tipoPedido, metodoElegido);
    }
  }

  private renderGoogleButton(idMesa: number | null, tipoPedido: string, metodoElegido: string) {
    // @ts-ignore
    window.google.accounts.id.initialize({
      client_id: '317530665710-rclujld7vo1j9vangvt5enqnghkilde4.apps.googleusercontent.com', // Cliente ID Real
      callback: (response: any) => {
        Swal.fire({ title: 'Autenticando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        this.procesarLoginGoogle(response.credential, idMesa, tipoPedido, metodoElegido);
      }
    });

    // @ts-ignore
    window.google.accounts.id.renderButton(
      document.getElementById('google-btn-container'),
      { theme: 'outline', size: 'large' }
    );
  }

  private procesarLoginGoogle(token: string, idMesa: number | null, tipoPedido: string, metodoElegido: string) {
    this.authService.googleLogin(token).subscribe({
      next: () => {
        Swal.close();
        this.procesarPedidoEnBackend(idMesa, tipoPedido, metodoElegido);
      },
      error: (err) => {
        Swal.fire('Error', 'Fallo la autenticación con Google', 'error');
      }
    });
  }

  private procesarPedidoEnBackend(idMesa: number | null, tipoPedido: string, metodoElegido: string) {
    const detallesBackend = this.items.map(item => ({
      idProducto: item.idProducto,
      cantidad: item.cantidad,
      precioUnitario: item.precio
    }));

    const usuarioStr = localStorage.getItem('usuario');
    let usuarioId = null;
    if (usuarioStr) {
      const usuario = JSON.parse(usuarioStr);
      usuarioId = usuario.idUsuario || usuario.id || null;
    }

    this.pedidoService.crearPedido(idMesa, tipoPedido, detallesBackend, usuarioId).subscribe({
      next: (resPedido) => {
        const idPedido = resPedido.pedido.idPedido;

        if (metodoElegido === 'MERCADOPAGO') {
          // Pagar con Mercado Pago (Tanto Delivery como Local)
          Swal.fire({
            title: 'Generando link de pago...',
            text: 'Aguardá un instante por favor',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });

          this.pagoService.crearPreferenciaPago(idPedido).subscribe({
            next: (resPago) => {
              this.carritoService.limpiarCarrito();
              // redirigir al cliente a MercadoPago
              window.location.href = resPago.init_point;
            },
            error: (err) => {
              const mensajeError = err.error?.message || err.message || 'Error desconocido';
              Swal.fire('Error al procesar pago', mensajeError, 'error');
              this.carritoService.limpiarCarrito();
            }
          });

        } else {
          // EFECTIVO / TRANSFERENCIA (El pago se registra manual después)
          Swal.fire({
            icon: 'success',
            title: '¡Pedido Confirmado!',
            text: tipoPedido === 'DELIVERY' 
                  ? 'El delivery fue enviado. Podrás pagar en efectivo o transferencia al recibirlo.' 
                  : 'El pedido fue enviado a la cocina. ¡Podés pagarlo más tarde!',
            confirmButtonColor: '#ffc107'
          });
          
          this.carritoService.limpiarCarrito();
          this.router.navigate(['/home']);
        }
      },
      error: (err) => {
        Swal.fire('Error', 'No se pudo crear el pedido: ' + err.message, 'error');
      }
    });
  }
}
