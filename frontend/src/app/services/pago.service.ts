import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private apiUrl = 'https://proybackendgrupo13-9bp9.onrender.com/api/pagos';

  constructor(private http: HttpClient) { }

  crearPreferenciaPago(idPedido: number): Observable<any> {
    return this.http.post(this.apiUrl, {
      idPedido: idPedido,
      metodoPago: 'MERCADOPAGO'
    });
  }

  registrarPago(data: { idPedido: number, metodoPago: string }): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }
}
