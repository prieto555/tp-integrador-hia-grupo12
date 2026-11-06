import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UsuarioService } from '../../services/usuario.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-usuario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './usuario.html',
  styleUrl: './usuario.css',
})
export class Usuario implements OnInit {
  usuarios: any[] = [];
  loading: boolean = true;
  currentPage: number = 0;
  pageSize: number = 15;
  totalPages: number = 0;
  totalItems: number = 0;

  constructor(
    private usuarioService: UsuarioService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.loading = true;
    this.usuarioService.getUsuarios(this.currentPage, this.pageSize).subscribe({
      next: (res) => {
        // Soporte tanto para respuesta paginada (data) como cruda (arreglo directo, retrocompatibilidad)
        if (res && res.data) {
          this.usuarios = res.data;
          this.totalPages = res.totalPages;
          this.totalItems = res.totalItems;
        } else {
          this.usuarios = res;
          this.totalPages = 1;
          this.totalItems = res.length;
        }
        
        this.loading = false;
        this.cdr.detectChanges(); // FORZAR DIBUJADO DE ANGULAR
      },
      error: (err) => {
        console.error('Error cargando usuarios:', err);
        this.loading = false;
        this.cdr.detectChanges(); // FORZAR DIBUJADO
        Swal.fire('Error', 'Error al cargar los usuarios: ' + err.message, 'error');
      }
    });
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina >= 0 && nuevaPagina < this.totalPages) {
      this.currentPage = nuevaPagina;
      this.cargarUsuarios();
    }
  }

  crearUsuario(): void {
    this.router.navigate(['/usuario-form']);
  }

  editarUsuario(usuarioId: number): void {
    this.router.navigate(['/usuario-form', usuarioId]);
  }

  eliminarUsuario(usuarioId: number): void {
    Swal.fire({
      title: '¿Eliminar Usuario?',
      text: '¿Está seguro de eliminar este usuario?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.usuarioService.deleteUsuario(usuarioId).subscribe({
          next: (res) => {
            this.cargarUsuarios();
            Swal.fire('Eliminado', 'El usuario ha sido eliminado', 'success');
          },
          error: (err) => {
            console.error('Error eliminando', err);
            Swal.fire('Error', 'Error al eliminar usuario', 'error');
          }
        });
      }
    });
  }
}

