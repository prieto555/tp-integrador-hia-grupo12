import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CajaService {
  private apiUrl = environment.apiUrl + '/caja';

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

  // El cierre de caja en PDF o Excel.
  //
  // Se pide con HttpClient y no con window.open, aunque window.open sea una
  // sola linea. El motivo: el interceptor que agrega la cabecera Authorization
  // solo toca las peticiones que salen por HttpClient. Una pestana abierta con
  // window.open es una peticion suelta del navegador, sin token, asi que
  // dejaria de funcionar en cuanto la ruta pida autenticacion.
  descargarReporte(idCaja: number, formato: 'pdf' | 'excel'): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/reportes/caja/${idCaja}/${formato}`, {
      responseType: 'blob'
    });
  }
}
