import { CommonModule } from '@angular/common';

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ToastService } from '@rd-ui';
import { LucideAngularModule } from 'lucide-angular';
import { Observable } from 'rxjs';
import { ChunkUploadProgress, UploadResult } from '../../_services/web-api/upload-chunk.service';
import { ProgressComponent } from './progress';

@Component({
  selector: 'app-upload-items',
  imports: [CommonModule, FormsModule, ProgressComponent, LucideAngularModule],
  template: `
    <div
      class="box"
      [hidden]="!showDragArea() || isBusy()"
      [class.active]="isDragOver()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      aria-label="Drag and drop files here to upload"
    >
      <div class="box-input">
        <lucide-angular
          style="cursor:pointer"
          name="cloud-upload"
          class="pulse"
          size="128"
          (click)="filePicker.click()"
        ></lucide-angular>

        <label for="file">Drag and Drop files to upload</label>
        <div class="flex-row gap20">
          <button class="box-button" (click)="filePicker.click()">Upload File</button>
          @if (allowCloudFiles()) {
            <button class="box-button" (click)="attachCloudClicked.emit()">Attach Host File</button>
          }
        </div>
      </div>
      <input
        #filePicker
        id="file"
        type="file"
        style="display: none"
        [multiple]="true"
        (change)="onFileSelected($event)"
      />
    </div>
    @if (fileList(); as fl) {
      @if (fl.length > 0 || attachmentsView().length > 0) {
        <div class="items">
          @for (file of fl; track $index) {
            <div class="item" [class.pulse]="!file.failed()" [class.item-failed]="file.failed()">
              <div class="icon">
                @if (file.failed()) {
                  <lucide-angular name="alert-circle" size="48" class="error-icon"></lucide-angular>
                } @else {
                  <lucide-angular name="cloud-upload" size="48"></lucide-angular>
                }
              </div>
              <div class="name">
                {{ file.relativePath || file.file.name }}
              </div>
              @if (file.failed()) {
                <div class="error-text">{{ file.errorMessage() }}</div>
                <button class="retry-btn" (click)="retryUpload(file)">
                  <lucide-angular name="refresh-cw" [size]="14"></lucide-angular>
                  Retry
                </button>
              }
              @if (file.showProgress()) {
                <div style="align-self: stretch;">
                  <lib-progress [progress]="file.progress()"></lib-progress>
                </div>
                @if (file.uploadSpeed()) {
                  <div class="upload-speed">
                    {{ file.uploadSpeed() }}
                  </div>
                }
              }
            </div>
          }
        </div>
      }
    }
  `,
  styleUrl: './upload-items.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class UploadItemsComponent {
  toastr = inject(ToastService);
  filePicker = viewChild<ElementRef>('filePicker');
  fileList = signal<IUploadFile[]>([]);
  showDragArea = input(false);
  prepService: (() => Observable<any>) | undefined = undefined;
  fileService: ((file: File, relativePath?: string) => Observable<ChunkUploadProgress | UploadResult>) | undefined;
  isBusy = signal(false);
  attachments = model<IUploadItem[]>([]);
  hideItemOnFinished = input(true);
  attachmentsView = computed(() => {
    return this.attachments() ?? [];
  });
  statusChanged = output<UploadItemsStatus>();
  isDragOver = signal(false);
  allowCloudFiles = input(false);
  attachCloudClicked = output();
  public Upload(uploadService: (file: File, relativePath?: string) => Observable<ChunkUploadProgress | UploadResult>) {
    if (!this.fileService) this.fileService = uploadService;
    this.filePicker()?.nativeElement.click();
  }
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const items = event.dataTransfer?.items;
    if (items) {
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
      if (entries.length > 0) {
        this.traverseEntries(entries).then((fileEntries) => {
          if (fileEntries.length > 0) {
            this.handleFileEntries(fileEntries);
          }
        });
        return;
      }
    }

    // Fallback for browsers without entry API
    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(files);
    }
  }

  private async traverseEntries(entries: FileSystemEntry[]): Promise<{ file: File; relativePath: string }[]> {
    const results: { file: File; relativePath: string }[] = [];
    for (const entry of entries) {
      await this.traverseEntry(entry, '', results);
    }
    return results;
  }

  private async traverseEntry(
    entry: FileSystemEntry,
    path: string,
    results: { file: File; relativePath: string }[]
  ): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
      const relativePath = path ? `${path}/${entry.name}` : '';
      results.push({ file, relativePath });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const childEntries = await this.readAllEntries(dirEntry.createReader());
      const dirPath = path ? `${path}/${entry.name}` : entry.name;
      for (const child of childEntries) {
        await this.traverseEntry(child, dirPath, results);
      }
    }
  }

  private readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    return new Promise((resolve, reject) => {
      const allEntries: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries((entries) => {
          if (entries.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...entries);
            readBatch();
          }
        }, reject);
      };
      readBatch();
    });
  }

  handleFileEntries(fileEntries: { file: File; relativePath: string }[]) {
    var files: IUploadFile[] = [];

    for (const entry of fileEntries) {
      var attachment = {
        description: entry.relativePath || entry.file.name,
        file: entry.file,
        relativePath: entry.relativePath || undefined,
        progress: signal(0),
        showProgress: signal(false),
        uploadSpeed: signal(''),
        failed: signal(false),
        errorMessage: signal(''),
        lastLoaded: 0,
        lastTimestamp: 0,
        uploadStartTime: 0,
      } as IUploadFile;
      files.push(attachment);
    }

    if (files.length > 0) {
      var existingFiles = this.fileList() ?? [];
      this.isBusy.set(true);
      this.statusChanged.emit({ uploading: true });

      this.fileList.set([...existingFiles, ...files]);
      if (this.prepService) {
        this.prepService().subscribe(() => {
          this.uploadFiles(files);
        });
      } else {
        this.uploadFiles(files);
      }
    }
  }

  onFileSelected(event: Event) {
    const element = event.target as HTMLInputElement;
    const files = element.files;

    if (files) {
      this.handleFiles(files);
    }
  }
  handleFiles(eventFiles: FileList | null) {
    if (!eventFiles) return;
    var files: IUploadFile[] = [];

    for (const file of eventFiles) {
      var attachment = {
        description: file.name,
        file: file,
        progress: signal(0),
        showProgress: signal(false),
        uploadSpeed: signal(''),
        failed: signal(false),
        errorMessage: signal(''),
        lastLoaded: 0,
        lastTimestamp: 0,
        uploadStartTime: 0,
      } as IUploadFile;
      files.push(attachment);
    }

    if (files.length > 0) {
      var existingFiles = this.fileList() ?? [];
      this.isBusy.set(true);
      this.statusChanged.emit({ uploading: true });

      this.fileList.set([...existingFiles, ...files]);
      if (this.prepService) {
        this.prepService().subscribe(() => {
          this.uploadFiles(files);
        });
      } else {
        this.uploadFiles(files);
      }
    }
  }

  retryUpload(file: IUploadFile) {
    file.failed.set(false);
    file.errorMessage.set('');
    file.progress.set(0);
    file.uploadSpeed.set('');
    this.isBusy.set(true);
    this.statusChanged.emit({ uploading: true });
    this.uploadFiles([file]);
  }

  uploadFiles(files: IUploadFile[]) {
    for (const f of files) {
      f.showProgress.set(true);
      f.uploadStartTime = Date.now(); // Track start time
      f.lastLoaded = 0; // For delta calculations
      if (!this.fileService) return;
      this.fileService(f.file, f.relativePath).subscribe({
        next: (event) => {
        var progress = event as ChunkUploadProgress;

        if ('success' in event) {
          var result = event as UploadResult;
          if (result.success) {
            this.toastr.success(`${f.file.name} uploaded successfully`);
            this.fileList.update((x) => {
              return x.filter((y) => y !== f);
            });
          }
          f.showProgress.set(false);
          //check if all are done
          var allDone = true;
          for (const x of this.fileList()) {
            if (x.showProgress()) {
              allDone = false;
              break;
            }
          }
          if (allDone) {
            this.statusChanged.emit({ uploading: false });
            this.isBusy.set(false);
          }
        }
        if (progress) {
          // This is progress update
          const now = Date.now();
          const uploadStart = f.uploadStartTime!;
          const bytesUploaded = progress.bytesUploaded;

          // Initialize speed tracking if needed
          if (!f.speedSamples) {
            f.speedSamples = [];
          }

          // Add current sample
          f.speedSamples.push({ bytes: bytesUploaded, timestamp: now });

          // Keep only samples from last 3 seconds for smoothing
          const smoothingWindow = 3000; // 3 seconds
          f.speedSamples = f.speedSamples.filter((sample) => now - sample.timestamp <= smoothingWindow);

          // Calculate speed using smoothing window
          let speedMBps = 0;

          if (f.speedSamples.length >= 2) {
            // Use oldest and newest samples in the window
            const oldestSample = f.speedSamples[0];
            const newestSample = f.speedSamples[f.speedSamples.length - 1];

            const deltaBytes = newestSample.bytes - oldestSample.bytes;
            const deltaTime = (newestSample.timestamp - oldestSample.timestamp) / 1000;

            if (deltaTime > 0.1) {
              // Avoid division by very small numbers
              const speedBps = deltaBytes / deltaTime;
              speedMBps = speedBps / (1024 * 1024);

              // Optional: Apply additional smoothing with previous speed
              if (f.smoothedSpeed !== undefined) {
                // Exponential moving average (adjust alpha for more/less smoothing)
                const alpha = 0.3;
                speedMBps = alpha * speedMBps + (1 - alpha) * f.smoothedSpeed;
              }

              f.smoothedSpeed = speedMBps;
            }
          }

          // Alternative: Overall average speed (less fluctuation but less responsive)
          const elapsedSeconds = (now - uploadStart) / 1000;
          const overallSpeedMBps = bytesUploaded / (1024 * 1024) / elapsedSeconds;

          // You can choose which speed to display:
          const displaySpeed = speedMBps > 0 ? speedMBps : overallSpeedMBps;

          f.uploadSpeed.set(`${displaySpeed.toFixed(2)} MB/s`);
          f.progress.set(progress.overallProgress);

          // Store for next calculation
          f.lastLoaded = bytesUploaded;
          f.lastTimestamp = now;
        }
        },
        error: () => {
          f.showProgress.set(false);
          f.failed.set(true);
          f.errorMessage.set(`Upload failed`);
          this.toastr.error(`Failed to upload ${f.file.name}`);
          var allDone = this.fileList().every((x) => !x.showProgress());
          if (allDone) {
            this.statusChanged.emit({ uploading: false });
            this.isBusy.set(false);
          }
        },
      });
    }
  }
}
export interface IUploadItem {
  description: string;
  url: string;
}
export interface IUploadFile {
  description: string;
  file: File;
  relativePath?: string;
  progress: WritableSignal<number>;
  showProgress: WritableSignal<boolean>;
  failed: WritableSignal<boolean>;
  errorMessage: WritableSignal<string>;
  uploadStartTime?: number;
  lastTimestamp?: number;
  lastLoaded?: number;
  smoothedSpeed?: number;
  speedSamples?: { bytes: number; timestamp: number }[];
  uploadSpeed: WritableSignal<string>;
}
export interface FileResponse {
  fileName: string;
  url: string;
}
export interface UploadItemsStatus {
  uploading: boolean;
}
