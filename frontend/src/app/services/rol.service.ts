import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RolService {

  urlApi: string = "https://proybackendgrupo13-9bp9.onrender.com/api/roles/";

  constructor(private http: HttpClient) { }

  public getRoles(): Observable<any> {
    return this.http.get<any>(this.urlApi);
  }

}
