import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CarritoService } from '../../services/carrito.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit {
  cantidadCarrito: number = 0;

  constructor(
    public authService: AuthService, 
    private router: Router,
    private carritoService: CarritoService
  ) {}

  ngOnInit() {
    this.carritoService.items$.subscribe(items => {
      this.cantidadCarrito = items.reduce((total, item) => total + item.cantidad, 0);
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
