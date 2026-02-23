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
import { ModalContainerService, SkeletonComponent, ToastService } from '@rd-ui';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { HttpClient } from '@angular/common/http';
import { switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LocalFilesModalComponent } from '../../_components/local-file-modal/local-files-modal.component';
import { RenameModalComponent } from '../../_components/rename-modal/rename-modal.component';
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
import { LocalFile, UploadItemResponse, UploadService, GroupResponse } from '../../_services/web-api/upload.service';
import { getPreviewType, getViewUrl, PreviewType } from '../../_helpers/file-preview';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ShareLinkDisplayComponent,
    LucideAngularModule,
    UploadItemsComponent,
    SkeletonComponent,
  ],
  template: `
    @if (this.files()) {
      @if (cardButtons() && cardButtons()!.length > 4) {
        <div class="filter-sort-bar">
          <div class="sort-bar">
            <span class="sort-label">Sort by:</span>
            @for (opt of sortOptions; track opt.field) {
              <button
                class="sort-btn"
                [class.active]="sortField() === opt.field"
                (click)="setSort(opt.field)"
                [attr.aria-label]="'Sort by ' + opt.label"
              >
                {{ opt.label }}
                @if (sortField() === opt.field) {
                  <lucide-angular
                    [name]="sortDirection() === 'asc' ? 'arrow-up' : 'arrow-down'"
                    [size]="14"
                  ></lucide-angular>
                }
              </button>
            }
          </div>
          @if (cardButtons()!.length > 4) {
            <input
              class="search-bar"
              type="text"
              placeholder="Filter files..."
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
            />
          }
        </div>
      }
      @if (downloadAllUrl() && !isEditor()) {
        <div class="download-all-bar">
          <a class="btn btn-primary" [href]="getDownloadAllHref()">
            <lucide-angular name="file-archive" [size]="16"></lucide-angular>
            Download All
          </a>
        </div>
      }
      <div class="buttons">
        @for (item of filteredCardButtons(); track $index) {
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
                  @if (isEditor()) {
                    <button class="btn-icon-sm" title="Rename" aria-label="Rename file" (click)="openRenameModal(item, $event)">
                      <lucide-angular name="pencil" [size]="14"></lucide-angular>
                    </button>
                  }
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
                  @if (item.downloadCount > 0) {
                    <div class="info small flex-row" style="gap: 3px; align-items: center;">
                      <lucide-angular name="download" [size]="12"></lucide-angular>
                      {{ item.downloadCount }}
                    </div>
                  }
                </div>
              </div>
            } @else if (item.imageType === ImageType.Icon) {
              @if (item.previewType !== PreviewType.None && item.previewType !== PreviewType.Image) {
                <div class="item icon-wrap preview-item" (click)="onPreviewClick($event, item)">
                  <lucide-angular [name]="item.imageSrc!" [size]="48"></lucide-angular>
                  <div class="overlay">
                    <lucide-angular name="eye" size="60"></lucide-angular>
                  </div>
                </div>
              } @else {
                <a class="item icon-wrap" [href]="item.url" target="_blank" rel="noreferrer">
                  <lucide-angular [name]="item.imageSrc!" [size]="48"></lucide-angular>
                  <div class="overlay">
                    <lucide-angular name="download" size="60"></lucide-angular>
                  </div>
                </a>
              }
              <div class="flex-row">
                <div class="title">{{ item.title }}</div>
                @if (isEditor()) {
                  <button class="btn-icon-sm" title="Rename" aria-label="Rename file" (click)="openRenameModal(item, $event)">
                    <lucide-angular name="pencil" [size]="14"></lucide-angular>
                  </button>
                }
              </div>
              <div class="flex-row justify-content-between">
                <div class="info small">{{ item.size }}</div>
                @if (item.downloadCount > 0) {
                  <div class="info small flex-row" style="gap: 3px; align-items: center;">
                    <lucide-angular name="download" [size]="12"></lucide-angular>
                    {{ item.downloadCount }}
                  </div>
                }
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
      }

      <ng-template #sharedLink>
        <app-share-link-display [groupId]="groupId()">
          <div class="sep"></div>
          <div class="flex-row gap10">
            @if (downloadAllUrl()) {
              <a class="btn btn-icon" title="Download All as Zip" aria-label="Download all files as zip" [href]="getDownloadAllHref()">
                <lucide-angular name="file-archive" [size]="18"></lucide-angular>
              </a>
            }
            <button class="btn btn-icon" title="Upload File" aria-label="Upload file" (click)="upload()">
              <lucide-angular name="cloud-upload" [size]="18"></lucide-angular>
            </button>
            @if (localFilesEnabled()) {
              <button class="btn btn-icon" title="Attach Host File" aria-label="Attach host file" (click)="openLocalFilesModal()">
                <lucide-angular name="paperclip" [size]="18"></lucide-angular>
              </button>
            }
          </div>
        </app-share-link-display>
      </ng-template>

    } @else {
      <div class="buttons">
        <rd-skeleton width="165px" height="247px"></rd-skeleton>
        <rd-skeleton width="165px" height="247px"></rd-skeleton>
        <rd-skeleton width="165px" height="247px"></rd-skeleton>
        <rd-skeleton width="165px" height="247px"></rd-skeleton>
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
  modalContainerService = inject(ModalContainerService);
  toastr = inject(ToastService);
  http = inject(HttpClient);
  uploads = viewChild<UploadItemsComponent>('uploads');
  sharedLink = viewChild<TemplateRef<any>>('sharedLink');
  files = signal<UploadItemResponse[] | null>(null);
  ImageType = ImageType;
  PreviewType = PreviewType;
  attachments = signal<IUploadItem[]>([]);
  tokenUser = signal<TokenUser | null>(null);
  srService = inject(SignalRService);
  isEditor = computed(() => {
    return this.tokenUser()?.role === 'Editor' || this.tokenUser()?.role === 'Owner';
  });
  groupId = signal<string | null>(null);
  mediaType = MediaType;
  sortField = signal<SortField>('name');
  sortDirection = signal<SortDirection>('asc');
  sortOptions: { field: SortField; label: string }[] = [
    { field: 'name', label: 'Name' },
    { field: 'size', label: 'Size' },
    { field: 'date', label: 'Date' },
    { field: 'type', label: 'Type' },
  ];
  cardButtons = computed(() => {
    const files = this.files();
    if (!files) return undefined;
    const field = this.sortField();
    const dir = this.sortDirection();
    const sorted = [...files].sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case 'name':
          cmp = (a.name ?? '').localeCompare(b.name ?? '');
          break;
        case 'size':
          cmp = (a.size ?? 0) - (b.size ?? 0);
          break;
        case 'date':
          cmp = new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
          break;
        case 'type':
          cmp = this.getFileExtension(a.name).localeCompare(this.getFileExtension(b.name));
          break;
      }
      return dir === 'asc' ? cmp : -cmp;
    });
    return sorted.map((x) => {
      var title = x.metadata?.seriesName ?? x.metadata?.title ?? x.relativePath ?? x.name;
      var title2 = !!x.metadata?.seriesName ? x.metadata?.title : '';
      var mediaType = x.metadata?.mediaType ?? MediaType.File;
      var fullUrl = environment.apiUrl + x.url;
      return {
        id: x.id,
        fileName: x.name,
        title: title,
        title2: title2,
        imageType: !!x.metadata?.poster ? ImageType.Image : ImageType.Icon,
        imageSrc: this.getSourceImage(x),
        year: x.metadata?.year,
        size: this.formatFileSize(x?.size),
        season: x.metadata?.season,
        episode: x.metadata?.episode,
        url: fullUrl,
        viewUrl: getViewUrl(fullUrl),
        previewType: getPreviewType(x.name),
        mediaType: mediaType,
        downloadCount: x.downloadCount,
      } as Download;
    });
  });
  searchTerm = signal('');
  filteredCardButtons = computed(() => {
    const items = this.cardButtons();
    const term = this.searchTerm().toLowerCase().trim();
    if (!items || !term) return items;
    return items.filter(
      (item) =>
        item.title?.toLowerCase().includes(term) ||
        item.title2?.toLowerCase().includes(term) ||
        item.fileName?.toLowerCase().includes(term)
    );
  });
  downloadAllUrl = signal<string | null>(null);
  localFilesEnabled = signal(false);
  constructor() {
    const savedSort = this.userPref.get('fileSort');
    if (savedSort) {
      this.sortField.set(savedSort.field ?? 'name');
      this.sortDirection.set(savedSort.direction ?? 'asc');
    }
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
          this.uploadService.getUploads(groupId).subscribe({
            next: (response) => this.handleGroupResponse(response),
            error: () => {
              this.toastr.error('Failed to load files');
              this.files.set([]);
            },
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
    this.uploadService
      .getLocalInfo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (x) => this.localFilesEnabled.set(x.hasLocalPaths),
        error: () => this.localFilesEnabled.set(false),
      });
    this.srService.uploadItemChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((z) => {
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
            if (z.metadata?.title) {
              this.toastr.info(`Metadata loaded for "${z.metadata.title}"`);
            }
          } else {
            // add new item
            files.push(z);
            this.files.update(() => {
              return [...files!];
            });
            this.toastr.info(`${z.name} added`);
          }
        }
      });
  }
  ngAfterViewInit(): void {
    Fancybox.bind(this.elementRef.nativeElement, '[data-fancybox]');
  }
  ngOnDestroy(): void {
    this.toolbarService.clearToolbarContent();
    Fancybox.destroy();
  }
  upload() {
    this.uploads()?.Upload((file: File, relativePath?: string) => {
      return this.chunkService.create(file, this.groupId()!, relativePath);
    });
  }
  openRenameModal(item: Download, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const nameWithoutExt = item.fileName.replace(/\.[^/.]+$/, '');
    const modalRef = this.modalContainerService.openComponent(RenameModalComponent, { data: { name: nameWithoutExt } });
    modalRef.onClose.subscribe((newName: string | undefined) => {
      if (newName) {
        this.uploadService.renameItem(item.id, newName).subscribe({
          next: (updated) => {
            this.files.update((files) => {
              if (!files) return files;
              return files.map((f) => (f.id === updated.id ? updated : f));
            });
            this.toastr.success('File renamed successfully');
          },
          error: () => {
            this.toastr.error('Failed to rename file');
          },
        });
      }
    });
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
    this.uploadService
      .attachLocalFile(this.groupId()!, items)
      .pipe(switchMap(() => this.uploadService.getUploads(this.groupId()!)))
      .subscribe({
        next: (response) => this.handleGroupResponse(response),
        error: () => {
          this.toastr.error('Failed to attach local files');
        },
      });
  }
  uploadItemsChanged(status: UploadItemsStatus) {
    if (!status.uploading) {
      this.attachments.set([]);
      if (this.groupId === null) {
        throw new Error('Group ID is null');
      }
      this.uploadService.getUploads(this.groupId()!).subscribe({
        next: (response) => this.handleGroupResponse(response),
        error: () => {
          this.toastr.error('Failed to refresh files');
        },
      });
    }
  }
  setSort(field: SortField) {
    if (this.sortField() === field) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.userPref.set('fileSort', { field: this.sortField(), direction: this.sortDirection() });
  }
  getFileExtension(name: string): string {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.substring(idx + 1).toLowerCase() : '';
  }
  getSourceImage(item: UploadItemResponse) {
    if (item.metadata?.seriesPoster) return environment.apiUrl + '/' + item.metadata.seriesPoster;
    if (item.metadata?.poster) return environment.apiUrl + '/' + item.metadata.poster;
    return this.fileTypeIconService.getIconForFile(item.name);
  }
  onPreviewClick(event: Event, item: Download) {
    event.preventDefault();
    event.stopPropagation();

    switch (item.previewType) {
      case PreviewType.Video:
        Fancybox.show([
          {
            type: 'html5video',
            src: item.viewUrl,
            caption: item.fileName,
          },
        ]);
        break;
      case PreviewType.Audio:
        Fancybox.show([
          {
            html: `<div class="audio-preview">
              <div class="audio-title">${this.escapeHtml(item.fileName)}</div>
              <audio controls autoplay src="${item.viewUrl}"></audio>
            </div>`,
          },
        ]);
        break;
      case PreviewType.Pdf:
        Fancybox.show([
          {
            type: 'iframe',
            src: item.viewUrl,
            caption: item.fileName,
          },
        ]);
        break;
      case PreviewType.Text:
        this.http.get(item.viewUrl, { responseType: 'text' }).subscribe({
          next: (text) => {
            const maxLength = 1024 * 1024;
            const truncated = text.length > maxLength;
            const content = truncated ? text.substring(0, maxLength) : text;
            Fancybox.show([
              {
                html: `<div class="text-preview">
                  <div class="text-header">${this.escapeHtml(item.fileName)}${truncated ? ' (truncated)' : ''}</div>
                  <pre><code>${this.escapeHtml(content)}</code></pre>
                </div>`,
              },
            ]);
          },
          error: () => {
            window.open(item.url, '_blank');
          },
        });
        break;
      default:
        window.open(item.url, '_blank');
    }
  }

  getDownloadAllHref(): string {
    return environment.apiUrl + this.downloadAllUrl();
  }

  private handleGroupResponse(response: GroupResponse) {
    this.files.set(response.items);
    this.downloadAllUrl.set(response.downloadAllUrl);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
  id: string;
  fileName: string;
  imageSrc: string | null | undefined;
  title: string;
  title2: string | null | undefined;
  imageType: ImageType;
  year?: number | null;
  size?: string | null;
  season?: number | null;
  episode?: number | null;
  url: string;
  viewUrl: string;
  previewType: PreviewType;
  mediaType: MediaType;
  downloadCount: number;
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
export type SortField = 'name' | 'size' | 'date' | 'type';
export type SortDirection = 'asc' | 'desc';
