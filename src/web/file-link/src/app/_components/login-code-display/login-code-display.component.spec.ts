import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginCodeDisplayComponent } from './login-code-display.component';

describe('LoginCodeDisplayComponent', () => {
  let component: LoginCodeDisplayComponent;
  let fixture: ComponentFixture<LoginCodeDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginCodeDisplayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginCodeDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
