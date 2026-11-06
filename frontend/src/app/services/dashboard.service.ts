import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VentaPorDia } from '../models/venta-por-dia';
import { VentaPorMetodoPago } from '../models/venta-por-metodo-pago';
import { ProductoMasVendido } from '../models/producto-mas-vendido';
import { ResumenDashboard } from '../models/resumen-dashboard';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {

  private apiUrl = 'https://proybackendgrupo13-9bp9.onrender.com/api/dashboard';

  constructor(private http: HttpClient) { }

  obtenerResumen(): Observable<ResumenDashboard> {
    return this.http.get<ResumenDashboard>(`${this.apiUrl}/resumen`);
  }

  obtenerVentasPorDia(dias: number = 14): Observable<VentaPorDia[]> {
    return this.http.get<VentaPorDia[]>(`${this.apiUrl}/ventas-por-dia?dias=${dias}`);
  }

  obtenerVentasPorMetodoPago(): Observable<VentaPorMetodoPago[]> {
    return this.http.get<VentaPorMetodoPago[]>(`${this.apiUrl}/ventas-por-metodo-pago`);
  }

  obtenerProductosMasVendidos(limite: number = 10): Observable<ProductoMasVendido[]> {
    return this.http.get<ProductoMasVendido[]>(`${this.apiUrl}/productos-mas-vendidos?limite=${limite}`);
  }

}
