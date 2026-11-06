import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CocinaComponent } from './cocina.component';

describe('CocinaComponent', () => {
  let component: CocinaComponent;
  let fixture: ComponentFixture<CocinaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CocinaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CocinaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
