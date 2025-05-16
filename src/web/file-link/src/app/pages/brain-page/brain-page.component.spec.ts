import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrainPageComponent } from './brain-page.component';

describe('BrainPageComponent', () => {
  let component: BrainPageComponent;
  let fixture: ComponentFixture<BrainPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrainPageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BrainPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
