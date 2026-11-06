import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { BebidasComponent } from './components/bebidas/bebidas.component';
import { FavoritosComponent } from './components/favoritos/favoritos.component';
import { MesaComponent } from './components/mesa/mesa.component';
import { CajaComponent } from './components/caja/caja.component';
import { PlatosComponent } from './components/platos/platos.component';
import { PostresComponent } from './components/postres/postres.component';
import { LayoutPedidoComponent } from './components/layout-pedido/layout-pedido.component';
import { QrComponent } from './components/qr/qr';
import { CocinaComponent } from './components/cocina/cocina.component';
import { Login } from './components/login/login';
import { Usuario } from './components/usuario/usuario';
import { UsuarioForm } from './components/usuario-form/usuario-form';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { AdminProductosComponent } from './components/admin-productos/admin-productos';
import { HistorialAccesos } from './components/historial-accesos/historial-accesos';
import { Dashboard } from './components/dashboard/dashboard';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'login', component: Login },
    { path: 'favoritos', component: FavoritosComponent },

    { path: 'usuario', component: Usuario, canActivate: [authGuard, roleGuard], data: { roles: ['Gerente'] } },
    { path: 'usuario-form', component: UsuarioForm, canActivate: [authGuard, roleGuard], data: { roles: ['Gerente'] } },
    { path: 'usuario-form/:id', component: UsuarioForm, canActivate: [authGuard, roleGuard], data: { roles: ['Gerente'] } },
    
    // Nueva ruta de Administración de Menú
    { path: 'admin/productos', component: AdminProductosComponent, canActivate: [authGuard, roleGuard], data: { roles: ['Gerente'] } },
    { path: 'admin/historial', component: HistorialAccesos, canActivate: [authGuard, roleGuard], data: { roles: ['Gerente'] } },

    { path: 'qr/:idMesa', component: QrComponent },
    {
        path: '', component: LayoutPedidoComponent,
        children: [   
            { path: 'bebidas', component: BebidasComponent },
            { path: 'platos', component: PlatosComponent },
            { path: 'postres', component: PostresComponent },
            { path: 'home', component: HomeComponent },
            
            // Rutas Privadas del Staff
            { path: 'mesa', component: MesaComponent, canActivate: [authGuard, roleGuard], data: { roles: ['Mozo', 'Gerente'] } },
            { path: 'caja', component: CajaComponent, canActivate: [authGuard, roleGuard], data: { roles: ['Cajero', 'Gerente'] } },
            { path: 'cocina', component: CocinaComponent, canActivate: [authGuard, roleGuard], data: { roles: ['Cocina', 'Gerente'] } },
            { path: 'dashboard', component: Dashboard, canActivate: [authGuard, roleGuard], data: { roles: ['Gerente'] } },
        ],
    }
];
