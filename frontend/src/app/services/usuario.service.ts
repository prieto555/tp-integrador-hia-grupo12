import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UsuarioService {
  urlApi: string = "https://proybackendgrupo13-9bp9.onrender.com/api/usuarios/";

  constructor(private http: HttpClient) { }

  public getUsuarios(page?: number, size?: number): Observable<any> {
    let url = this.urlApi;
    if (page !== undefined && size !== undefined) {
      url += `?page=${page}&size=${size}`;
    }
    return this.http.get<any>(url);
  }

  public getUsuario(id: number): Observable<any> {
    return this.http.get<any>(this.urlApi + id);
  }

  public createUsuario(usuario: any): Observable<any> {
    return this.http.post<any>(this.urlApi, usuario);
  }

  public updateUsuario(id: number, usuario: any): Observable<any> {
    return this.http.put<any>(this.urlApi + id, usuario);
  }

  public deleteUsuario(id: number): Observable<any> {
    return this.http.delete<any>(this.urlApi + id);
  }
}
