import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductoService } from '../../services/producto.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-productos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-productos.html',
  styleUrl: './admin-productos.css'
})
export class AdminProductosComponent implements OnInit {
  productos: any[] = [];
  paginatedProductos: any[] = [];
  cargando: boolean = true;
  productoForm!: FormGroup;
  modoEdicion: boolean = false;
  idEditando: number | null = null;
  mostrarModal: boolean = false;

  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 15;
  totalPages: number = 1;

  constructor(
    private fb: FormBuilder, 
    private productoService: ProductoService,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.cargarProductos();
  }

  initForm() {
    this.productoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: ['', Validators.required],
      categoria: ['plato_principal', Validators.required],
      precioCosto: [0, [Validators.required, Validators.min(0)]],
      porcentajeGanancia: [0, [Validators.required, Validators.min(0)]],
      imagenUrl: ['', Validators.required]
    });
  }

  cargarProductos() {
    this.cargando = true;
    this.productoService.obtenerProductos().subscribe({
      next: (data) => {
        this.productos = data;
        this.totalPages = Math.ceil(this.productos.length / this.itemsPerPage);
        if (this.totalPages === 0) this.totalPages = 1;
        this.updatePagination();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.cargando = false;
      }
    });
  }

  updatePagination() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedProductos = this.productos.slice(startIndex, endIndex);
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

  abrirModalNuevo() {
    this.modoEdicion = false;
    this.idEditando = null;
    this.productoForm.reset({ categoria: 'plato_principal', precioCosto: 0, porcentajeGanancia: 0 });
    this.mostrarModal = true;
  }

  abrirModalEditar(prod: any) {
    this.modoEdicion = true;
    this.idEditando = prod.idProducto;
    this.productoForm.patchValue({
      nombre: prod.nombre,
      descripcion: prod.descripcion,
      categoria: prod.categoria,
      precioCosto: prod.precioCosto,
      porcentajeGanancia: prod.porcentajeGanancia,
      imagenUrl: prod.imagenUrl
    });
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  guardarProducto() {
    if (this.productoForm.invalid) {
      Swal.fire('Error', 'Por favor, completá todos los campos correctamente. No se permiten valores negativos.', 'error');
      return;
    }

    const formValues = this.productoForm.value;
    // Calcular el precio final de venta basado en el costo y el margen de ganancia
    const precioCalculado = formValues.precioCosto * (1 + formValues.porcentajeGanancia / 100);
    
    const payload = { 
      ...formValues, 
      precio: precioCalculado 
    };

    if (this.modoEdicion && this.idEditando) {
      this.productoService.actualizarProducto(this.idEditando, payload).subscribe({
        next: () => {
          Swal.fire('¡Éxito!', 'Producto actualizado', 'success');
          this.cargarProductos();
          this.cerrarModal();
        },
        error: () => Swal.fire('Error', 'No se pudo actualizar', 'error')
      });
    } else {
      this.productoService.crearProducto(payload).subscribe({
        next: () => {
          Swal.fire('¡Éxito!', 'Producto creado', 'success');
          this.cargarProductos();
          this.cerrarModal();
        },
        error: () => Swal.fire('Error', 'No se pudo crear', 'error')
      });
    }
  }

  eliminarProducto(id: number) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.productoService.eliminarProducto(id).subscribe({
          next: () => {
            Swal.fire('¡Eliminado!', 'El producto ha sido eliminado.', 'success');
            this.cargarProductos();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }
}
