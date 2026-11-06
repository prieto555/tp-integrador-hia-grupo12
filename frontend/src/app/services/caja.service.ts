import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CajaService {
  private apiUrl = 'https://proybackendgrupo13-9bp9.onrender.com/api/caja';

  constructor(private http: HttpClient) { }

  abrirCaja(montoInicial: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/abrir`, { montoInicial });
  }

  obtenerCajaActiva(): Observable<any> {
    return this.http.get(`${this.apiUrl}/activa`);
  }

  obtenerHistorial(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  cerrarCaja(): Observable<any> {
    return this.http.put(`${this.apiUrl}/cerrar`, {});
  }
}
