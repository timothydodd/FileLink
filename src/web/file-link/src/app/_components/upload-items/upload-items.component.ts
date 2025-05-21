import { CommonModule } from '@angular/common';

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';

import { HttpEvent, HttpEventType } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Observable } from 'rxjs';
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
            <div class="item pulse">
              <div class="icon">
                <lucide-angular name="cloud-upload" size="48"></lucide-angular>
              </div>
              <div class="name">
                {{ file.file.name }}
              </div>
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
  filePicker = viewChild<ElementRef>('filePicker');
  fileList = signal<IUploadFile[]>([]);
  showDragArea = input(false);
  prepService: (() => Observable<any>) | undefined = undefined;
  fileService: ((file: File) => Observable<HttpEvent<string>>) | undefined;
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
  public Upload(uploadService: (file: File) => Observable<HttpEvent<string>>) {
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
    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(files);
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
  uploadFiles(files: IUploadFile[]) {
    for (const f of files) {
      f.showProgress.set(true);
      f.uploadStartTime = Date.now(); // Track start time
      f.lastLoaded = 0; // For delta calculations
      if (!this.fileService) return;
      this.fileService(f.file).subscribe((event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const now = Date.now();
          const uploadStart = f.uploadStartTime!;
          const elapsedSeconds = (now - uploadStart) / 1000;
          const bytesUploaded = event.loaded;
          const deltaBytes = bytesUploaded - (f.lastLoaded ?? 0);
          const lastTimestamp = f.lastTimestamp ?? uploadStart;
          const deltaTime = (now - lastTimestamp) / 1000;

          f.lastLoaded = bytesUploaded;
          f.lastTimestamp = now;

          // Optional: You can use either `elapsedSeconds` or `deltaTime` depending on smoothing preference
          const speedBps = deltaBytes / deltaTime;
          const speedKbps = speedBps / 1024;
          const speedMBps = speedBps / (1024 * 1024);

          //f.uploadSpeed.set(`${speedKbps.toFixed(1)} KB/s`); // or MB/s
          f.uploadSpeed.set(`${speedMBps.toFixed(2)} MB/s`); // update the displayed speed
          f.progress.set(Math.round((100 * event.loaded) / event.total!));
        } else if (event.type === HttpEventType.Response) {
          if (event.body) {
            const fileResponse = JSON.parse(event.body) as FileResponse;
            if (!this.hideItemOnFinished()) {
              var a = this.attachments() ?? [];
              this.attachments.set([...a, { description: f.description, url: fileResponse.url }]);
            }
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
            // this.fileList.set([]);
          }
        }
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
  progress: WritableSignal<number>;
  showProgress: WritableSignal<boolean>;
  uploadStartTime?: number;
  lastTimestamp?: number;
  lastLoaded?: number;
  uploadSpeed: WritableSignal<string>;
}
export interface FileResponse {
  fileName: string;
  url: string;
}
export interface UploadItemsStatus {
  uploading: boolean;
}
