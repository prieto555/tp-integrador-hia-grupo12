import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PedidoService } from '../../services/pedido.service';
import { EstadoPedidoPipe } from '../../pipes/estado-pedido.pipe';

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [CommonModule, EstadoPedidoPipe],
  templateUrl: './cocina.component.html',
  styleUrl: './cocina.component.css',
})
export class CocinaComponent implements OnInit {
  comandas: any[] = [];

  constructor(
    private pedidoService: PedidoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarComandas();
  }

  cargarComandas() {
    this.pedidoService.obtenerPedidosCocina().subscribe(res => {
      this.comandas = res;
      this.cdr.detectChanges();
    });
  }

  cambiarEstado(id: number, estado: string) {
    this.pedidoService.cambiarEstado(id, estado).subscribe(() => {
      this.cargarComandas(); // Refrescar lista
    });
  }
}
