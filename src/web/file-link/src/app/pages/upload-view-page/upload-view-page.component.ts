import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Fancybox } from '@fancyapps/ui';
import { LucideAngularModule } from 'lucide-angular';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SkeletonComponent } from '../../_components/common/skeleton/skeleton';
import { LocalFilesModalComponent } from '../../_components/local-file-modal/local-files-modal.component';
import { ShareLinkDisplayComponent } from '../../_components/share-link-display/share-link-display.component';
import {
  IUploadItem,
  UploadItemsComponent,
  UploadItemsStatus,
} from '../../_components/upload-items/upload-items.component';
import { AuthService } from '../../_services/auth/auth.service';
import { TokenUser } from '../../_services/auth/token-user';
import { FileTypeIconService } from '../../_services/file-icon.service';
import { SignalRService } from '../../_services/signalr.service';
import { ToolbarService } from '../../_services/toolbar.service';
import { UserPreferenceService } from '../../_services/user-prefrences.service';
import { UploadChunkService } from '../../_services/web-api/upload-chunk.service';
import { LocalFile, UploadItemResponse, UploadService } from '../../_services/web-api/upload.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ShareLinkDisplayComponent,
    LucideAngularModule,
    UploadItemsComponent,
    LocalFilesModalComponent,
    SkeletonComponent,
  ],
  template: `
    @if (this.files()) {
      <div class="buttons">
        @for (item of cardButtons(); track $index) {
          <div class="card-down" [ngClass]="{ image: item.mediaType === mediaType.Image }">
            @if (item.imageType === ImageType.Image) {
              <a
                class="item img-wrap"
                [href]="item.url"
                [attr.data-fancybox]="item.mediaType === mediaType.Image ? 'gallery' : undefined"
              >
                @if (item.mediaType === mediaType.Image) {
                  <img [src]="item.imageSrc!" [alt]="item.title" />
                } @else {
                  <img [src]="item.imageSrc!" [alt]="item.title" />
                }
                <div class="overlay">
                  <lucide-angular
                    [name]="item.mediaType === mediaType.Image ? 'eye' : 'download'"
                    size="60"
                  ></lucide-angular>
                </div>
              </a>
              <div class="info-panel">
                <div class="flex-row">
                  <div class="title">{{ item.title }}</div>
                </div>
                @if (item.title2) {
                  <div class="title2">{{ item.title2 }}</div>
                }
                @if (item.year) {
                  <div class="flex-row justify-content-between">
                    <div class="info">{{ item.year }}</div>
                  </div>
                }
                @if (item.season && item.episode) {
                  <div class="flex-row" style="gap: 3px;">
                    <div class="info">S{{ item.season }}</div>
                    <div class="info">-</div>
                    <div class="info">E{{ item.episode }}</div>
                  </div>
                }
                <div class="flex-row justify-content-between">
                  <div class="info small">{{ item.size }}</div>
                </div>
              </div>
            } @else if (item.imageType === ImageType.Icon) {
              <a class="item icon-wrap" [href]="item.url" target="_blank" rel="noreferrer">
                <lucide-angular [name]="item.imageSrc!" [size]="48"></lucide-angular>
                <div class="overlay">
                  <lucide-angular name="download" size="60"></lucide-angular>
                </div>
              </a>
              <div class="flex-row">
                <div class="title">{{ item.title }}</div>
              </div>
              <div class="flex-row justify-content-between">
                <div class="info small">{{ item.size }}</div>
              </div>
            }
          </div>
        }
      </div>
      @if (isEditor()) {
        <app-upload-items
          #uploads
          [(attachments)]="attachments"
          (statusChanged)="uploadItemsChanged($event)"
          [showDragArea]="false"
        ></app-upload-items>
        @if (localFilesEnabled()) {
          <app-local-files-modal #localFilesModal (attachFilesEvent)="attachItems($event)"></app-local-files-modal>
        }
      }

      <ng-template #sharedLink>
        <app-share-link-display [groupId]="groupId()">
          <div class="sep"></div>
          <div class="flex-row gap10">
            <button class="btn btn-icon" (click)="upload()">
              <lucide-angular name="cloud-upload" title="Upload File" [size]="18"></lucide-angular>
            </button>
            @if (localFilesEnabled()) {
              <button class="btn btn-icon" title="Attach Host File" (click)="localFiles()!.show()">
                <lucide-angular name="paperclip" [size]="18"></lucide-angular>
              </button>
            }
          </div>
        </app-share-link-display>
      </ng-template>
    } @else {
      <div class="buttons">
        <lib-skeleton width="165px" height="247px"></lib-skeleton>
        <lib-skeleton width="165px" height="247px"></lib-skeleton>
        <lib-skeleton width="165px" height="247px"></lib-skeleton>
        <lib-skeleton width="165px" height="247px"></lib-skeleton>
      </div>
    }
  `,
  styleUrl: './upload-view-page.component.scss',
})
export class UploadViewPageComponent implements OnDestroy, AfterViewInit {
  elementRef = inject(ElementRef);
  toolbarService = inject(ToolbarService);
  fileTypeIconService = inject(FileTypeIconService);
  authService = inject(AuthService);
  userPref = inject(UserPreferenceService);
  activeRoute = inject(ActivatedRoute);
  uploadService = inject(UploadService);
  chunkService = inject(UploadChunkService);
  destroyRef = inject(DestroyRef);
  uploads = viewChild<UploadItemsComponent>('uploads');
  localFiles = viewChild<LocalFilesModalComponent>('localFilesModal');
  sharedLink = viewChild<TemplateRef<any>>('sharedLink');
  files = signal<UploadItemResponse[] | null>(null);
  ImageType = ImageType;
  attachments = signal<IUploadItem[]>([]);
  tokenUser = signal<TokenUser | null>(null);
  srService = inject(SignalRService);
  isEditor = computed(() => {
    return this.tokenUser()?.role === 'Editor' || this.tokenUser()?.role === 'Owner';
  });
  groupId = signal<string | null>(null);
  mediaType = MediaType;
  cardButtons = computed(() => {
    return this.files()?.map((x) => {
      var title = x.metadata?.seriesName ?? x.metadata?.title ?? x.name;
      var title2 = !!x.metadata?.seriesName ? x.metadata?.title : '';
      var mediaType = x.metadata?.mediaType ?? MediaType.File;
      return {
        title: title,
        title2: title2,
        imageType: !!x.metadata?.poster ? ImageType.Image : ImageType.Icon,
        imageSrc: this.getSourceImage(x),
        year: x.metadata?.year,
        size: this.formatFileSize(x?.size),
        season: x.metadata?.season,
        episode: x.metadata?.episode,
        url: environment.apiUrl + x.url,
        mediaType: mediaType,
      } as Download;
    });
  });
  localFilesEnabled = signal(false);
  constructor() {
    effect(() => {
      var sharedLink = this.sharedLink();

      var isEditor = this.isEditor();
      if (isEditor && sharedLink) {
        this.toolbarService.setToolbarContent(sharedLink);
      }
    });
    this.activeRoute.params.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (params['groupId']) {
        var groupId = params['groupId'];
        this.groupId.set(groupId);
        if (groupId) {
          this.uploadService.getUploads(groupId).subscribe((files) => {
            this.files.set(files);
          });
        }
      }
    });

    this.authService
      .getUserOnce()
      .pipe(
        tap((x) => {
          this.tokenUser.set(x);
          var isEditor = this.isEditor();
          if (isEditor) {
            this.initEditorServices();
          }
        })
      )
      .subscribe();
  }
  initEditorServices() {
    this.uploadService.getLocalInfo().subscribe((x) => {
      this.localFilesEnabled.set(x.hasLocalPaths);
    });
    this.srService.uploadItemChanged.subscribe((z) => {
      if (!z || z.groupId !== this.groupId()) return;
      var files = this.files();
      if (files) {
        // find index of item and replace it
        var index = files.findIndex((x) => x.id === z.id);
        if (index !== -1) {
          files[index] = z;
          this.files.update(() => {
            return [...files!];
          });
        } else {
          // add new item
          files.push(z);
          this.files.update(() => {
            return [...files!];
          });
        }
      }
    });
  }
  ngAfterViewInit(): void {
    Fancybox.bind(this.elementRef.nativeElement, '[data-fancybox]');
  }
  ngOnDestroy(): void {
    this.toolbarService.clearToolbarContent();
  }
  upload() {
    this.uploads()?.Upload((file: File) => {
      return this.chunkService.create(file, this.groupId()!);
    });
  }
  attachItems(items: LocalFile[]) {
    if (items.length === 0) return;
    this.uploadService.attachLocalFile(this.groupId()!, items).subscribe(() => {
      this.uploadService.getUploads(this.groupId()!).subscribe((files) => {
        this.files.set(files);
      });
    });
  }
  uploadItemsChanged(status: UploadItemsStatus) {
    if (!status.uploading) {
      this.attachments.set([]);
      if (this.groupId === null) {
        throw new Error('Group ID is null');
      }
      this.uploadService.getUploads(this.groupId()!).subscribe((files) => {
        this.files.set(files);
      });
    }
  }
  getSourceImage(item: UploadItemResponse) {
    if (item.metadata?.seriesPoster) return environment.apiUrl + '/' + item.metadata.seriesPoster;
    if (item.metadata?.poster) return environment.apiUrl + '/' + item.metadata.poster;
    return this.fileTypeIconService.getIconForFile(item.name);
  }
  formatFileSize(bytes: number | null): string {
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;

    if (bytes === null) return '';
    if (bytes >= GB) {
      return (bytes / GB).toFixed(2) + ' GB';
    } else if (bytes >= MB) {
      return (bytes / MB).toFixed(2) + ' MB';
    } else if (bytes >= KB) {
      return (bytes / KB).toFixed(2) + ' KB';
    } else {
      return bytes + ' bytes';
    }
  }
}
export interface Download {
  imageSrc: string | null | undefined;
  title: string;
  title2: string | null | undefined;
  imageType: ImageType;
  year?: number | null;
  size?: string | null;
  season?: number | null;
  episode?: number | null;
  url: string;
  mediaType: MediaType;
}
export enum ImageType {
  Image = 1,
  Icon = 2,
}
export enum MediaType {
  Movie = 'movie',
  Series = 'series',
  Image = 'image',
  Music = 'music',
  Video = 'video',
  File = 'file',
}
