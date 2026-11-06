import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Qr } from './qr';

describe('Qr', () => {
  let component: Qr;
  let fixture: ComponentFixture<Qr>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Qr],
    }).compileComponents();

    fixture = TestBed.createComponent(Qr);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
