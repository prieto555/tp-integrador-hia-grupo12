import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { UsuarioService } from '../../services/usuario.service';
import { RolService } from '../../services/rol.service';
import Swal from 'sweetalert2';

// Custom Validator: Validar DNI exacto de 8 dígitos numéricos
export function dniValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null; 
    const isValid = /^[0-9]{8}$/.test(value);
    return isValid ? null : { dniInvalido: true };
  };
}

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './usuario-form.html',
  styleUrl: './usuario-form.css',
})
export class UsuarioForm implements OnInit {
  usuarioForm!: FormGroup;
  roles: any[] = [];
  isEdit: boolean = false;
  loading: boolean = false;
  saving: boolean = false;
  usuarioIdAEditar: number | null = null;

  constructor(
    private fb: FormBuilder,
    private usuarioService: UsuarioService,
    private rolService: RolService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.crearFormulario();
  }

  crearFormulario() {
    this.usuarioForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      apellido: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      dni: ['', [dniValidator()]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rolId: [null]
    });
  }

  ngOnInit(): void {
    this.cargarRoles();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.usuarioIdAEditar = Number(id);
      this.usuarioForm.get('password')?.clearValidators();
      this.usuarioForm.get('password')?.updateValueAndValidity();
      this.cargarUsuario(this.usuarioIdAEditar);
    }
  }

  cargarRoles(): void {
    this.rolService.getRoles().subscribe({
      next: (res) => {
        // Filtramos para que no aparezca el rol 'CLIENTE' ya que esto es Gestión de Personal (Empleados)
        this.roles = res.filter((rol: any) => rol.nombre.toUpperCase() !== 'CLIENTE');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando roles', err);
        this.cdr.detectChanges();
      }
    });
  }

  cargarUsuario(id: number): void {
    this.loading = true;
    this.usuarioService.getUsuario(id).subscribe({
      next: (res) => {
        let rolId = null;
        if (res.Rols && res.Rols.length > 0) {
          rolId = res.Rols[0].rolId;
        }
        
        this.usuarioForm.patchValue({
          nombre: res.nombre,
          apellido: res.apellido,
          dni: res.dni,
          email: res.email,
          password: '', 
          rolId: rolId
        });

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error', err);
        Swal.fire('Error', 'Error al cargar el usuario', 'error');
        this.loading = false;
        this.router.navigate(['/usuario']);
        this.cdr.detectChanges();
      }
    });
  }

  guardar(): void {
    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      Swal.fire('Atención', 'Por favor revise los errores en el formulario', 'warning');
      return;
    }

    this.saving = true;

    const dataToSend = { ...this.usuarioForm.value };
    if (this.isEdit && !dataToSend.password) {
      delete dataToSend.password;
    }

    if (this.isEdit && this.usuarioIdAEditar) {
      this.usuarioService.updateUsuario(this.usuarioIdAEditar, dataToSend).subscribe({
        next: (res) => {
          this.saving = false;
          this.cdr.detectChanges();
          this.router.navigate(['/usuario']);
        },
        error: (err) => {
          console.error(err);
          Swal.fire('Error', 'Error al actualizar el usuario', 'error');
          this.saving = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.usuarioService.createUsuario(dataToSend).subscribe({
        next: (res) => {
          if (res.status === '0') {
            Swal.fire('Atención', res.msg, 'warning'); 
            this.saving = false;
            this.cdr.detectChanges();
          } else {
            this.saving = false;
            this.cdr.detectChanges();
            this.router.navigate(['/usuario']);
          }
        },
        error: (err) => {
          console.error(err);
          Swal.fire('Error', 'Error al crear el usuario', 'error');
          this.saving = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  cancelar(): void {
    this.router.navigate(['/usuario']);
  }

  eliminar(): void {
    if(!this.usuarioIdAEditar) return;

    Swal.fire({
      title: '¿Eliminar Usuario?',
      text: '¿Está seguro de eliminar este usuario? Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.saving = true;
        this.usuarioService.deleteUsuario(this.usuarioIdAEditar!).subscribe({
          next: (res) => {
            this.saving = false;
            this.cdr.detectChanges();
            this.router.navigate(['/usuario']);
          },
          error: (err) => {
            console.error('Error eliminando', err);
            Swal.fire('Error', 'Error al eliminar usuario', 'error');
            this.saving = false;
            this.cdr.detectChanges();
          }
        });
      }
    });
  }
}

