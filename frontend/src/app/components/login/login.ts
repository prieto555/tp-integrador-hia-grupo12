import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  loginForm: FormGroup;
  isLoading = false;
  errorMsg = '';

  constructor(
    private authService: AuthService, 
    private router: Router,
    private fb: FormBuilder
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMsg = '';

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.redirigirPorRol();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      }
    });
  }

  redirigirPorRol() {
    if (this.authService.tienePermiso('cobrar_pedido') || this.authService.tienePermiso('abrir_caja')) {
      this.router.navigate(['/caja']);
    } else if (this.authService.tienePermiso('gestionar_usuarios')) {
      this.router.navigate(['/usuario']);
    } else if (this.authService.tienePermiso('ver_items_cocina')) {
      this.router.navigate(['/cocina']);
    } else {
      this.router.navigate(['/mesa']);
    }
  }
}
