import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ProductoService } from '../../services/producto.service';
import { Producto } from '../../models/producto.model';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import { CarritoService } from '../../services/carrito.service';

@Component({
  selector: 'app-platos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './platos.component.html',
  styleUrl: './platos.component.css',
})
export class PlatosComponent implements OnInit {
  productos: Producto[] = [];
  cargando: boolean = true;

  constructor(
    private listaProductos: ProductoService,
    private carritoService: CarritoService,
    private cdr: ChangeDetectorRef
  ) { }
  
  ngOnInit() {
    this.listaProductos.obtenerProductos('plato_principal').subscribe({
      next: (data) => {
        this.productos = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Error cargando platos", err);
        this.cargando = false;
      }
    });
  }

  agregarAlCarrito(producto: Producto) {
    this.carritoService.agregarProducto(producto);
  }
}
