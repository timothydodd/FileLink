import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  inject,
  output,
  signal,
  TemplateRef,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { debounceTime } from 'rxjs';
import { LocalFile, UploadService } from '../../_services/web-api/upload.service';
import { CheckComponent } from '../common/check/check.component';
import { ModalService } from '../common/modal/modal.service';
import { SkeletonListComponent } from '../common/skeleton-list/skeleton-list.component';

@Component({
  standalone: true,
  selector: 'app-local-files-modal',
  imports: [CommonModule, FormsModule, CheckComponent, LucideAngularModule, SkeletonListComponent],
  template: `
    <ng-template #modalBody>
      <div>
        <input
          type="text"
          [ngModel]="searchText()"
          (ngModelChange)="searchTextChange.emit($event)"
          class="form-control"
          placeholder="Search"
        />
      </div>
      <div class="list">
        @if (localFiles()) {
          @if (filteredView().length === 0) {
            <div class="text-center">No files found</div>
          } @else {
            @for (item of filteredView(); track $index) {
              <app-check
                [checked]="item.selected()"
                [label]="item.path"
                (checkedEvent)="item.selected.set($event)"
              ></app-check>
            }
          }
        } @else {
          <lib-skeleton-list [size]="10" itemHeight="41px" gap="1px"></lib-skeleton-list>
        }
      </div>
    </ng-template>
    <ng-template #modalFooter>
      <div class="flex-row gap20">
        <button class="btn btn-secondary" (click)="modalService.close()">Close</button>
        <button class="btn btn-primary" (click)="attachFiles()">Attach</button>
      </div>
    </ng-template>
  `,
  styleUrl: './local-files-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalFilesModalComponent {
  modalService = inject(ModalService);
  uploadService = inject(UploadService);
  modalFooter = viewChild<TemplateRef<any>>('modalFooter');
  modalBody = viewChild<TemplateRef<any>>('modalBody');
  localFiles = signal<SelectedLocalFile[] | null>(null);
  searchText = signal<string | null>(null);
  attachFilesEvent = output<LocalFile[]>();
  filteredView = computed(() => {
    var searchText = this.searchText();
    var localFiles = this.localFiles() || [];
    if (!searchText || searchText.length === 0) {
      return localFiles;
    }
    return (
      localFiles.filter((x) => {
        return x.path.toLowerCase().includes(searchText!.toLowerCase() || '');
      }) || []
    );
  });
  searchTextChange = new EventEmitter<string | null>();
  constructor() {
    this.searchTextChange.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((x) => {
      this.searchText.set(x);
    });
  }
  attachFiles() {
    var selectedFiles = this.localFiles()?.filter((x) => x.selected() === true);
    if (selectedFiles && selectedFiles.length > 0) {
      this.attachFilesEvent.emit(selectedFiles.map((x) => x));
    }
    this.modalService.close();
  }
  public show() {
    this.modalService.open('Host Files', this.modalBody(), this.modalFooter(), 'lg');
    this.uploadService.getLocalFiles().subscribe((x) => {
      var files = x.sort((a, b) => {
        if (a.path < b.path) {
          return -1;
        }
        if (a.path > b.path) {
          return 1;
        }
        return 0;
      });
      this.localFiles.set(
        files.map((z) => {
          var fileName = z.path.split('/').pop() ?? '';
          return { ...z, name: fileName, selected: signal(false) };
        })
      );
    });
  }
}
export interface SelectedLocalFile extends LocalFile {
  selected: WritableSignal<boolean>;
  name: string;
}
