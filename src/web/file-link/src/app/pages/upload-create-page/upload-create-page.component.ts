import { CommonModule } from '@angular/common';
import { Component, inject, signal, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { switchMap, tap } from 'rxjs';
import { UploadItemsComponent, UploadItemsStatus } from '../../_components/upload-items/upload-items.component';

import { SkeletonComponent } from '../../_components/common/skeleton/skeleton';
import { LocalFilesModalComponent } from '../../_components/local-file-modal/local-files-modal.component';
import { JwtAuthProvider } from '../../_services/auth/providers/jwt-auth-provider.service';
import { RouterHelperService } from '../../_services/route-helper';
import { UploadChunkService } from '../../_services/web-api/upload-chunk.service';
import { LocalFile, UploadService } from '../../_services/web-api/upload.service';

@Component({
  selector: 'app-upload-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UploadItemsComponent, LocalFilesModalComponent, SkeletonComponent],
  template: `
    @if (isLoading()) {
      <lib-skeleton width="600px" height="388px"></lib-skeleton>
    } @else {
      <div class="upload-buttons">
        <app-upload-items
          #uploads
          (statusChanged)="uploadItemsChanged($event)"
          [showDragArea]="true"
          [allowCloudFiles]="localFilesEnabled()"
          (attachCloudClicked)="localFilesModal()!.show()"
        ></app-upload-items>
        @if (localFilesEnabled()) {
          <app-local-files-modal #localFilesModal (attachFilesEvent)="attachItems($event)"></app-local-files-modal>
        }
      </div>
    }
  `,
  styleUrl: './upload-create-page.component.css',
})
export class UploadCreatePageComponent {
  localFilesModal = viewChild<LocalFilesModalComponent>('localFilesModal');
  uploads = viewChild<UploadItemsComponent>('uploads');
  uploadService = inject(UploadService);
  chunkService = inject(UploadChunkService);
  router = inject(RouterHelperService);
  jwtAuthProvider = inject(JwtAuthProvider);
  groupId: string | null = null;
  localFilesEnabled = signal(false);
  isLoading = signal(true);
  constructor() {
    toObservable(this.uploads).subscribe((uploads) => {
      if (uploads) {
        uploads.fileService = (file: File) => {
          return this.chunkService.create(file, this.groupId!);
        };
        uploads.prepService = () => {
          return this.uploadService.createGroup().pipe(
            tap((g) => {
              this.groupId = g.groupId;
            })
          );
        };
      }
    });
    this.uploadService.getLocalInfo().subscribe((x) => {
      this.localFilesEnabled.set(x.hasLocalPaths);
      this.isLoading.set(false);
    });
  }

  uploadItemsChanged(status: UploadItemsStatus) {
    if (!status.uploading) {
      this.router.goView(this.groupId!);
    }
    // this.isBusy.set(status.uploading);
    // this.statusChanged.emit(status);
  }
  attachItems(items: LocalFile[]) {
    if (items.length === 0) return;
    return this.uploadService
      .createGroup()
      .pipe(
        switchMap((g) => {
          this.groupId = g.groupId;
          if (!g.groupId) throw new Error('Group ID is null');

          return this.uploadService.attachLocalFile(g.groupId!, items);
        })
      )
      .subscribe(() => {
        this.router.goView(this.groupId!);
      });
  }
}
