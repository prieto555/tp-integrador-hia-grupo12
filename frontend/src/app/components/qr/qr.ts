import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MesaService } from '../../services/mesa.service';
import { CarritoService } from '../../services/carrito.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-qr',
  standalone: true,
  imports: [],
  template: `<div class="d-flex justify-content-center align-items-center vh-100 text-white">
                <h4>Escaneando Mesa...</h4>
             </div>`,
})
export class QrComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mesaService: MesaService,
    private carritoService: CarritoService
  ) { }

  ngOnInit() {
    // leemos el numero de mesa de la URL
    const numMesaStr = this.route.snapshot.paramMap.get('idMesa');

    if (numMesaStr) {
      const numMesaDeseada = parseInt(numMesaStr, 10);

      // buscamos TODAS las mesas para encontrar la que tenga ese Numero de Mesa
      this.mesaService.getMesas().subscribe({
        next: (mesas: any[]) => {
          const mesaEncontrada = mesas.find(m => m.numMesa === numMesaDeseada);

          if (mesaEncontrada) {
            // guardamos la mesa en el carrito usando la funcion correcta (pasamos PK y Numero)
            this.carritoService.setMesa(mesaEncontrada.idMesa, mesaEncontrada.numMesa);
            // redirigimos al cliente al menu de platos
            this.router.navigate(['/platos']);
          } else {
            Swal.fire('Error', 'La mesa N° ' + numMesaDeseada + ' no existe en el sistema.', 'error');
            this.router.navigate(['/']);
          }
        },
        error: (err) => {
          Swal.fire('Error', 'Error de conexión con el sistema.', 'error');
          this.router.navigate(['/']);
        }
      });
    } else {
      this.router.navigate(['/']);
    }
  }
}
