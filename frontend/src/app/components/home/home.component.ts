import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ClimaService } from '../../services/clima.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, HttpClientModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  clima: any = null;
  iconoClima: string = 'thermostat';
  descripcionClima: string = 'Cargando clima...';

  constructor(
    private router: Router, 
    private climaService: ClimaService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.obtenerClima();
  }

  obtenerClima() {
    this.climaService.obtenerClimaActual().subscribe({
      next: (data: any) => {
        // La data puede venir directo de la caché o parseada del primer HTTP
        if (data.current_observation) {
            this.clima = {
                temperature: data.current_observation.condition.temperature,
                code: data.current_observation.condition.code
            };
        } else {
            // Si vino de la caché (o del catchError), ya tiene el formato final
            this.clima = data;
        }

        this.interpretarClimaYahoo(this.clima.code, this.clima.temperature);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error obteniendo clima:', err);
        this.descripcionClima = 'Clima no disponible';
        this.iconoClima = 'cloud_off';
        this.cdr.detectChanges();
      }
    });
  }

  interpretarClimaYahoo(code: number, temperature: number) {
    if ((code >= 0 && code <= 12) || (code >= 35 && code <= 40) || code >= 45) {
      this.iconoClima = 'rainy';
      this.descripcionClima = 'Día lluvioso... ¡ideal para pedir delivery!';
    } else if ((code >= 13 && code <= 18) || (code >= 41 && code <= 43)) {
      this.iconoClima = 'ac_unit';
      this.descripcionClima = '¡Mucho frío a la vista! Pedí desde la comodidad de tu casa.';
    } else if (temperature < 15) {
      this.iconoClima = 'ac_unit';
      this.descripcionClima = 'Hace un poco de frío. ¡Ideal para pedir algo calentito!';
    } else if (temperature > 30) {
      this.iconoClima = 'local_fire_department';
      this.descripcionClima = '¡Día de mucho calor! Refrescate con nuestras bebidas frías.';
    } else if (code >= 31 && code <= 34) {
      this.iconoClima = 'sunny';
      this.descripcionClima = '¡Día espectacular para comer al aire libre!';
    } else if (code >= 26 && code <= 30) {
      this.iconoClima = 'partly_cloudy_day';
      this.descripcionClima = 'Lindo día para unas buenas hamburguesas.';
    } else if (code >= 19 && code <= 22) {
      this.iconoClima = 'foggy';
      this.descripcionClima = 'Poca visibilidad, mejor pedir delivery.';
    } else {
      this.iconoClima = 'cloud';
      this.descripcionClima = '¡El clima ideal para una buena comida!';
    }
  }

  hacerPedido() {
    this.router.navigate(['/platos']);
  }
}
