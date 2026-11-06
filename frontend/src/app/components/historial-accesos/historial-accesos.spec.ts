import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistorialAccesos } from './historial-accesos';

describe('HistorialAccesos', () => {
  let component: HistorialAccesos;
  let fixture: ComponentFixture<HistorialAccesos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistorialAccesos],
    }).compileComponents();

    fixture = TestBed.createComponent(HistorialAccesos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
