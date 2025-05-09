import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
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
import { ShareLinkDisplayComponent } from '../../_components/share-link-display/share-link-display.component';
import {
  IUploadItem,
  UploadItemsComponent,
  UploadItemsStatus,
} from '../../_components/upload-items/upload-items.component';
import { AuthService } from '../../_services/auth/auth.service';
import { TokenUser } from '../../_services/auth/token-user';
import { FileTypeIconService } from '../../_services/file-icon.service';
import { ToolbarService } from '../../_services/toolbar.service';
import { UserPreferenceService } from '../../_services/user-prefrences.service';
import { UploadItemResponse, UploadService } from '../../_services/web-api/upload.service';

@Component({
  standalone: true,
  imports: [CommonModule, ShareLinkDisplayComponent, LucideAngularModule, UploadItemsComponent],
  template: `
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
      @if (this.isEditor()) {
        <button class="btn-no-border" (click)="upload()">
          <div class="item add-button">
            <lucide-angular name="plus" [size]="48"></lucide-angular>
          </div>
        </button>
      }
    </div>
    @if (this.isEditor()) {
      <lib-upload-items
        #uploads
        [(attachments)]="attachments"
        (statusChanged)="uploadItemsChanged($event)"
        [showDragArea]="false"
      ></lib-upload-items>
    }

    <ng-template #sharedLink>
      <app-share-link-display [groupId]="groupId()"></app-share-link-display>
    </ng-template>
  `,
  styleUrl: './upload-view-page.component.css',
})
export class UploadViewPageComponent implements OnDestroy, AfterViewInit {
  elementRef = inject(ElementRef);
  toolbarService = inject(ToolbarService);
  fileTypeIconService = inject(FileTypeIconService);
  authService = inject(AuthService);
  userPref = inject(UserPreferenceService);
  activeRoute = inject(ActivatedRoute);
  uploadService = inject(UploadService);
  destroyRef = inject(DestroyRef);
  uploads = viewChild<UploadItemsComponent>('uploads');
  sharedLink = viewChild<TemplateRef<any>>('sharedLink');
  files = signal<UploadItemResponse[]>([]);
  ImageType = ImageType;
  attachments = signal<IUploadItem[]>([]);
  tokenUser = signal<TokenUser | null>(null);
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
        })
      )
      .subscribe();
  }
  ngAfterViewInit(): void {
    Fancybox.bind(this.elementRef.nativeElement, '[data-fancybox]');
  }
  ngOnDestroy(): void {
    this.toolbarService.clearToolbarContent();
  }
  upload() {
    this.uploads()?.Upload((file: File) => {
      return this.uploadService.create(file, this.groupId()!);
    });
  }
  uploadItemsChanged(status: UploadItemsStatus) {
    if (!status.uploading) {
      this.attachments.set([]);
    }
    if (this.groupId === null) {
      throw new Error('Group ID is null');
    }
    this.uploadService.getUploads(this.groupId()!).subscribe((files) => {
      this.files.set(files);
    });
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
