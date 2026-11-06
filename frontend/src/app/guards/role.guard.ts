import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import Swal from 'sweetalert2';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const rolesPermitidos = route.data['roles'] as Array<string>;

  if (!rolesPermitidos || rolesPermitidos.length === 0) {
    return true; // Si no pide roles específicos, pasa
  }

  // Verificar si el usuario tiene al menos uno de los roles permitidos
  const tieneRol = rolesPermitidos.some(rol => authService.tieneRol(rol));

  if (tieneRol) {
    return true;
  }

  Swal.fire({
    title: 'Acceso Restringido',
    text: 'No tenés los permisos necesarios para ver esta pantalla.',
    icon: 'error',
    confirmButtonColor: '#dc3545',
    background: '#1a1a1a',
    color: '#fff'
  });

  router.navigate(['/home']);
  return false;
};
