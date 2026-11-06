import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoutPedidoComponent } from './layout-pedido.component';

describe('LayoutPedidoComponent', () => {
  let component: LayoutPedidoComponent;
  let fixture: ComponentFixture<LayoutPedidoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutPedidoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutPedidoComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
