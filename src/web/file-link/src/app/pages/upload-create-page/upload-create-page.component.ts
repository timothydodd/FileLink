import { CommonModule } from '@angular/common';
import { Component, inject, signal, viewChild } from '@angular/core';

import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ModalContainerService, SkeletonComponent, ToastService } from '@rd-ui';
import { switchMap, tap } from 'rxjs';
import { UploadItemsComponent, UploadItemsStatus } from '../../_components/upload-items/upload-items.component';

import { LocalFilesModalComponent } from '../../_components/local-file-modal/local-files-modal.component';
import { JwtAuthProvider } from '../../_services/auth/providers/jwt-auth-provider.service';
import { RouterHelperService } from '../../_services/route-helper';
import { UploadChunkService } from '../../_services/web-api/upload-chunk.service';
import { LocalFile, UploadService } from '../../_services/web-api/upload.service';

@Component({
  selector: 'app-upload-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UploadItemsComponent, SkeletonComponent],
  template: `
    @if (isLoading()) {
      <rd-skeleton width="600px" height="388px"></rd-skeleton>
    } @else {
      <div class="upload-buttons">
        <app-upload-items
          #uploads
          (statusChanged)="uploadItemsChanged($event)"
          [showDragArea]="true"
          [allowCloudFiles]="localFilesEnabled()"
          (attachCloudClicked)="openLocalFilesModal()"
        ></app-upload-items>
      </div>
    }
  `,
  styleUrl: './upload-create-page.component.css',
})
export class UploadCreatePageComponent {
  uploads = viewChild<UploadItemsComponent>('uploads');
  uploadService = inject(UploadService);
  chunkService = inject(UploadChunkService);
  router = inject(RouterHelperService);
  jwtAuthProvider = inject(JwtAuthProvider);
  modalContainerService = inject(ModalContainerService);
  toastr = inject(ToastService);
  groupId: string | null = null;
  localFilesEnabled = signal(false);
  isLoading = signal(true);
  constructor() {
    toObservable(this.uploads)
      .pipe(takeUntilDestroyed())
      .subscribe((uploads) => {
        if (uploads) {
          uploads.fileService = (file: File, relativePath?: string) => {
            return this.chunkService.create(file, this.groupId!, relativePath);
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
    this.uploadService
      .getLocalInfo()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (x) => {
          this.localFilesEnabled.set(x.hasLocalPaths);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  uploadItemsChanged(status: UploadItemsStatus) {
    if (!status.uploading) {
      this.router.goView(this.groupId!);
    }
    // this.isBusy.set(status.uploading);
    // this.statusChanged.emit(status);
  }

  openLocalFilesModal() {
    const modalRef = this.modalContainerService.openComponent(LocalFilesModalComponent);
    modalRef.onClose.subscribe((items: LocalFile[] | undefined) => {
      if (items && items.length > 0) {
        this.attachItems(items);
      }
    });
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
      .subscribe({
        next: () => {
          this.router.goView(this.groupId!);
        },
        error: () => {
          this.toastr.error('Failed to attach files');
        },
      });
  }
}
