import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadCreatePageComponent } from './upload-create-page.component';

describe('PdfCreatePageComponent', () => {
  let component: UploadCreatePageComponent;
  let fixture: ComponentFixture<UploadCreatePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadCreatePageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(UploadCreatePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
