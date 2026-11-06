import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ProductoService } from '../../services/producto.service';
import { Producto } from '../../models/producto.model';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CarritoService } from '../../services/carrito.service';

@Component({
  selector: 'app-bebidas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bebidas.component.html',
  styleUrl: './bebidas.component.css'
})
export class BebidasComponent implements OnInit{

  bebidas: Producto[] = [];
  cargando: boolean = true;

  constructor(
    private listaProductos: ProductoService,
    private carritoService: CarritoService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.listaProductos.obtenerProductos('bebida').subscribe({
      next: (data) => {
        this.bebidas = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Error cargando bebidas", err);
        this.cargando = false;
      }
    });
  }

  agregarAlCarrito(producto: Producto) {
    this.carritoService.agregarProducto(producto);
  }
}
