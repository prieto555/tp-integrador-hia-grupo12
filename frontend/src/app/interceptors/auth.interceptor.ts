import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  let modifiedReq = req;
  if (token) {
    // Clonamos la request para agregarle el header de Authorization
    modifiedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Dejamos pasar la petición, pero nos "suscribimos" a los posibles errores que devuelva el servidor
  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el Backend nos devuelve 401 (Unauthorized) porque pasaron las 8 horas y expiró...
      if (error.status === 401) {
        authService.logout(); // Borramos el token vencido de la memoria
        router.navigate(['/login']); // Lo pateamos a la pantalla de login
      }
      return throwError(() => error);
    })
  );
};
