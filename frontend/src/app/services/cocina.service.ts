import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CocinaService {
  private apiUrl = environment.apiUrl + '/cocina';

  constructor(private http: HttpClient) { }

  obtenerComidas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/comandas`);
  }

  actualizarEstadoCocina(idPedido: number, nuevoEstado: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/pedido/${idPedido}`, { nuevoEstado });
  }
}
