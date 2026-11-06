import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MesaService {
  private apiUrl = 'https://proybackendgrupo13-9bp9.onrender.com/api/mesas';

  constructor(private http: HttpClient) { }

  getMesas(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  crearMesa(mesa: { numMesa: number, capacidad: number }): Observable<any> {
    return this.http.post(this.apiUrl, mesa);
  }

  obtenerMesaPorId(idMesa: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${idMesa}`);
  }

  cambiarEstado(idMesa: number, estado: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${idMesa}/estado`, { estado });
  }

  liberarMesa(idMesa: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${idMesa}/liberar`, {});
  }

  eliminarMesa(idMesa: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${idMesa}`);
  }

  actualizarMesa(idMesa: number, mesa: { numMesa: number, capacidad: number }): Observable<any> {
    return this.http.put(`${this.apiUrl}/${idMesa}`, mesa);
  }
}
