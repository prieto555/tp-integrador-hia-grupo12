import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'estadoPedido',
  standalone: true
})
export class EstadoPedidoPipe implements PipeTransform {
  transform(value: string | undefined | null): string {
    if (!value) return '';

    switch (value.toUpperCase()) {
      case 'PENDIENTE':
        return 'Pendiente 🕒';
      case 'EN_COCINA':
        return 'En Cocina 👨‍🍳';
      case 'LISTO_PARA_ENTREGA':
        return '¡Listo para Entregar! 🛎️';
      case 'ENTREGADO':
        return 'Entregado ✅';
      case 'PAGADO':
        return 'Pagado 💵';
      case 'CANCELADO':
        return 'Cancelado ❌';
      default:
        // Por si llega algo raro o sin formato
        return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
}
