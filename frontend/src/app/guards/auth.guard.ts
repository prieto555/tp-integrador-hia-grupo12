import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import Swal from 'sweetalert2';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaAutenticado()) {
    return true;
  }

  Swal.fire({
    title: 'Acceso Denegado',
    text: 'Debés iniciar sesión para acceder a esta sección.',
    icon: 'warning',
    confirmButtonColor: '#ffc107',
    background: '#1a1a1a',
    color: '#fff'
  });

  router.navigate(['/login']);
  return false;
};
