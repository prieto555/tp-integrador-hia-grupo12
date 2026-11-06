import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HistorialService } from '../../services/historial.service';

@Component({
  selector: 'app-historial-accesos',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './historial-accesos.html',
  styleUrl: './historial-accesos.css'
})
export class HistorialAccesos implements OnInit {
  historial: any[] = [];
  paginatedHistorial: any[] = [];
  cargando: boolean = true;
  error: string = '';

  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 15;
  totalPages: number = 1;

  constructor(private historialService: HistorialService) { }

  ngOnInit(): void {
    this.cargarHistorial();
  }

  cargarHistorial() {
    this.cargando = true;

    this.historialService.obtenerHistorial().subscribe({
      next: (data) => {
        this.historial = data;
        this.totalPages = Math.ceil(this.historial.length / this.itemsPerPage);
        if (this.totalPages === 0) this.totalPages = 1;
        this.updatePagination();
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando historial', err);
        this.error = 'No se pudo cargar el historial de accesos';
        this.cargando = false;
      }
    });
  }

  updatePagination() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedHistorial = this.historial.slice(startIndex, endIndex);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }
}
