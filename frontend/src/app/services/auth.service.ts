import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://proybackendgrupo13-9bp9.onrender.com/api/auth';
  
  // Guardamos el estado del usuario para que los componentes se enteren si hay sesión
  private usuarioSubject = new BehaviorSubject<any>(this.getUsuarioDesdeStorage());
  public usuario$ = this.usuarioSubject.asObservable();

  constructor(private http: HttpClient) { }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(res => {
        if (res.token) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('usuario', JSON.stringify(res.usuario));
          this.usuarioSubject.next(res.usuario);
        }
      })
    );
  }

  googleLogin(token: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/google`, { token }).pipe(
      tap(res => {
        if (res.token) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('usuario', JSON.stringify(res.usuario));
          this.usuarioSubject.next(res.usuario);
        }
      })
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this.usuarioSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  estaAutenticado(): boolean {
    return !!this.getToken();
  }

  tienePermiso(permiso: string): boolean {
    const usuario = this.usuarioSubject.value;
    if (!usuario || !usuario.permisos) return false;
    return usuario.permisos.includes(permiso);
  }

  tieneRol(rol: string): boolean {
    const usuario = this.usuarioSubject.value;
    if (!usuario || !usuario.roles) return false;
    return usuario.roles.includes(rol);
  }

  private getUsuarioDesdeStorage() {
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      try {
        return JSON.parse(usuarioStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}
