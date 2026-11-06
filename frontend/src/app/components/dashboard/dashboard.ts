import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { ResumenDashboard } from '../../models/resumen-dashboard';
import { CommonModule } from '@angular/common';
import { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {

  cargando = true;

  resumen: ResumenDashboard = {
    ventasHoy: 0,
    pedidosHoy: 0,
    mesasOcupadas: 0,
    ticketPromedio: 0,
  };

  lineChartData: ChartData<'line'> = { labels: [], datasets: [{ data: [], label: 'Ventas ($)' }] };
  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#ffffff' } } },
    scales: {
      x: { ticks: { color: '#adb5bd' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#adb5bd' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  };

  pieChartData: ChartData<'pie'> = { labels: [], datasets: [{ data: [] }] };
  pieChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#ffffff', boxWidth: 12, font: { size: 11 } } } },
  };

  barChartData: ChartData<'bar'> = { labels: [], datasets: [{ data: [], label: 'Unidades vendidas' }] };
  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#ffffff' } } },
    scales: {
      x: { ticks: { color: '#adb5bd' }, grid: { display: false } },
      y: { ticks: { color: '#adb5bd' }, grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  };

  constructor(private dashboardService: DashboardService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.cargarResumen();
    this.cargarVentasPorDia();
    this.cargarVentasPorMetodoPago();
    this.cargarProductosMasVendidos();
  }

  cargarResumen() {
    this.dashboardService.obtenerResumen().subscribe({
      next: (data) => {
        this.resumen = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar el resumen del dashboard', err);
        this.cargando = false;
      },
    });
  }

  cargarVentasPorDia() {
    this.dashboardService.obtenerVentasPorDia(14).subscribe({
      next: (data) => {
        this.lineChartData = {
          labels: data.map((item) => item.fecha),
          datasets: [{
            data: data.map((item) => Number(item.total)),
            label: 'Ventas ($)',
            borderColor: '#ffc107',
            backgroundColor: 'rgba(255, 193, 7, 0.15)',
            tension: 0.3,
            fill: true,
          }]
        };
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar ventas por dia', err),
    });
  }

  cargarVentasPorMetodoPago() {
    this.dashboardService.obtenerVentasPorMetodoPago().subscribe({
      next: (data) => {
        this.pieChartData = {
          labels: data.map((item) => item.metodoPago),
          datasets: [{
            data: data.map((item) => Number(item.total)),
            backgroundColor: ['#198754', '#0dcaf0', '#ffc107', '#0d6efd'],
          }],
        };
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar ventas por metodo de pago', err),
    });
  }

  cargarProductosMasVendidos() {
    this.dashboardService.obtenerProductosMasVendidos(10).subscribe({
      next: (data) => {
        this.barChartData = {
          labels: data.map((item) => item.producto.nombre),
          datasets: [{
            data: data.map((item) => Number(item.totalVendido)),
            label: 'Unidades vendidas',
            backgroundColor: '#0dcaf0',
          }],
        };
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al cargar productos mas vendidos', err),
    });
  }

}
