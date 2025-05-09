import { CommonModule } from '@angular/common';
import { Component, inject, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { tap } from 'rxjs';
import { UploadItemsComponent, UploadItemsStatus } from '../../_components/upload-items/upload-items.component';

import { JwtAuthProvider } from '../../_services/auth/providers/jwt-auth-provider.service';
import { RouterHelperService } from '../../_services/route-helper';
import { UploadService } from '../../_services/web-api/upload.service';

@Component({
  selector: 'app-upload-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UploadItemsComponent],
  template: `
    <div class="upload-buttons">
      <lib-upload-items #uploads (statusChanged)="uploadItemsChanged($event)" [showDragArea]="true"></lib-upload-items>
    </div>
  `,
  styleUrl: './upload-create-page.component.css',
})
export class UploadCreatePageComponent {
  uploads = viewChild<UploadItemsComponent>('uploads');
  docService = inject(UploadService);
  router = inject(RouterHelperService);
  jwtAuthProvider = inject(JwtAuthProvider);
  groupId: string | null = null;
  constructor() {
    toObservable(this.uploads).subscribe((uploads) => {
      if (uploads) {
        uploads.fileService = (file: File) => {
          return this.docService.create(file, this.groupId!);
        };
        uploads.prepService = () => {
          return this.docService.createGroup().pipe(
            tap((g) => {
              this.groupId = g.groupId;
            })
          );
        };
      }
    });
  }

  uploadItemsChanged(status: UploadItemsStatus) {
    if (!status.uploading) {
      this.router.goView(this.groupId!);
    }
    // this.isBusy.set(status.uploading);
    // this.statusChanged.emit(status);
  }
}
