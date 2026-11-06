import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ProductoService } from '../../services/producto.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Producto } from '../../models/producto.model';
import { CarritoService } from '../../services/carrito.service';

@Component({
  selector: 'app-postres',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './postres.component.html',
  styleUrl: './postres.component.css',
})
export class PostresComponent implements OnInit{
  postres: Producto[] = [];
  cargando: boolean = true;

  constructor(
    private listaProductos: ProductoService,
    private carritoService: CarritoService,
    private cdr: ChangeDetectorRef
  ) { }
  
  ngOnInit() {
    this.listaProductos.obtenerProductos('postre').subscribe({
      next: (data) => {
        this.postres = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Error cargando postres", err);
        this.cargando = false;
      }
    });
  }

  agregarAlCarrito(producto: Producto) {
    this.carritoService.agregarProducto(producto);
  }
}
