import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadViewPageComponent } from './upload-view-page.component';

describe('PdfViewComponent', () => {
  let component: UploadViewPageComponent;
  let fixture: ComponentFixture<UploadViewPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadViewPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UploadViewPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
