import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ItemCarrito {
  idProducto: number;
  nombre: string;
  precio: number;
  cantidad: number;
}

@Injectable({
  providedIn: 'root'
})
export class CarritoService {

  // Estado de la Mesa Activa 
  private mesaActivaSource = new BehaviorSubject<{ idMesa: number, numMesa: number } | null>(null);
  mesaActiva$ = this.mesaActivaSource.asObservable();

  // Estado de los items agregados al pedido
  private itemsSource = new BehaviorSubject<ItemCarrito[]>([]);
  items$ = this.itemsSource.asObservable();

  constructor() { }

  // Setear la mesa cuando hacemos click en la grilla
  setMesa(idMesa: number, numMesa: number) {
    this.mesaActivaSource.next({ idMesa, numMesa });
    // Al setear una nueva mesa, limpiamos el carrito por seguridad
    this.itemsSource.next([]);
  }

  getMesaActiva() {
    return this.mesaActivaSource.getValue();
  }

  // Agregar producto al carrito
  agregarProducto(producto: any) {
    const items = this.itemsSource.getValue();
    const itemExistente = items.find(i => i.idProducto === producto.idProducto);

    if (itemExistente) {
      itemExistente.cantidad += 1;
      this.itemsSource.next([...items]); // Emitir copia actualizada
    } else {
      const nuevoItem: ItemCarrito = {
        idProducto: producto.idProducto,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1
      };
      this.itemsSource.next([...items, nuevoItem]);
    }
  }

  getTotal(): number {
    return this.itemsSource.getValue().reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  }

  restarProducto(idProducto: number) {
    let items = this.itemsSource.getValue();
    const itemIndex = items.findIndex(i => i.idProducto === idProducto);
    
    if (itemIndex > -1) {
      if (items[itemIndex].cantidad > 1) {
        items[itemIndex].cantidad -= 1;
      } else {
        items.splice(itemIndex, 1);
      }
      this.itemsSource.next([...items]);
    }
  }

  eliminarProducto(idProducto: number) {
    let items = this.itemsSource.getValue();
    items = items.filter(i => i.idProducto !== idProducto);
    this.itemsSource.next([...items]);
  }

  vaciarCarrito() {
    this.itemsSource.next([]);
  }

  // Limpiar carrito (incluye mesa)
  limpiarCarrito() {
    this.itemsSource.next([]);
    this.mesaActivaSource.next(null);
  }

  // Obtener array crudo de items
  getItems() {
    return this.itemsSource.getValue();
  }
}
