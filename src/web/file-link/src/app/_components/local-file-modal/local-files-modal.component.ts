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
import { CheckboxComponent, SkeletonComponent, SpinnerComponent } from '@rd-ui';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, debounceTime, Observable, of, switchMap, timer } from 'rxjs';
import { FileIndexResponse, LocalFile, UploadService } from '../../_services/web-api/upload.service';
import { ModalService } from '../common/modal/modal.service';

export interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  expanded: WritableSignal<boolean>;
  selected: WritableSignal<boolean>;
  children: TreeNode[];
  parent?: TreeNode;
  file?: LocalFile;
  level: number;
}

export interface SelectedLocalFile extends LocalFile {
  selected: WritableSignal<boolean>;
  name: string;
}

@Component({
  standalone: true,
  selector: 'app-local-files-modal',
  imports: [CommonModule, FormsModule, CheckboxComponent, LucideAngularModule, SkeletonComponent, SpinnerComponent],
  template: `
    <ng-template #modalBody>
      <div>
        <input
          type="text"
          [ngModel]="searchText()"
          (ngModelChange)="searchTextChange.emit($event)"
          class="form-control"
          placeholder="Search files and folders"
        />
      </div>
      <div class="list-wrap">
        <div class="list">
          @if (treeNodes()) {
            @if (filteredView().length === 0) {
              <div class="text-center">No files found</div>
            } @else {
              @for (node of filteredView(); track node.path) {
                <div class="tree-item" [style.padding-left.px]="node.level * 20 + 15">
                  @if (node.isFolder) {
                    <div class="folder-row" (click)="toggleFolder(node)">
                      <lucide-icon
                        [size]="24"
                        [name]="node.expanded() ? 'chevron-down' : 'chevron-right'"
                        class="expand-icon"
                      ></lucide-icon>
                      <lucide-icon name="folder" [size]="28" class="folder-icon"></lucide-icon>
                      <rd-checkbox
                        [ngModel]="node.selected()"
                        [label]="node.name"
                        (checkedChange)="onFolderCheck(node, $event)"
                        class="folder-check"
                      ></rd-checkbox>
                    </div>
                  } @else {
                    <div class="file-row">
                      <div class="file-indent"></div>
                      <lucide-icon name="file" class="file-icon" [size]="24"></lucide-icon>
                      <rd-checkbox
                        [ngModel]="node.selected()"
                        [label]="node.name"
                        (checkedChange)="node.selected.set($event)"
                        class="file-check"
                      ></rd-checkbox>
                    </div>
                  }
                </div>
              }
            }
          } @else {
            @for (i of [1,2,3,4,5,6,7,8,9,10]; track i) {
                <rd-skeleton width="100%" height="41px" [style]="{'margin-bottom': '1px'}"></rd-skeleton>
              }
          }
          @if (isIndexing()) {
            <rd-spinner [fullscreen]="false" [overlay]="false">
              <div class="index-message">
                <div>Files are being indexed</div>
                <div class="small">(Will load when done)</div>
              </div>
            </rd-spinner>
          }
        </div>
      </div>
    </ng-template>
    <ng-template #modalFooter>
      <div class="flex-row gap20">
        <button class="btn btn-secondary" (click)="modalService.close()">Close</button>
        <button class="btn btn-primary" (click)="attachFiles()">Attach ({{ selectedCount() }})</button>
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
  treeNodes = signal<TreeNode[] | null>(null);
  searchText = signal<string | null>(null);
  attachFilesEvent = output<LocalFile[]>();
  isIndexing = signal(false);

  selectedCount = computed(() => {
    const nodes = this.treeNodes();
    if (!nodes) return 0;
    return this.countSelectedFiles(nodes);
  });

  filteredView = computed(() => {
    const searchText = this.searchText();
    const treeNodes = this.treeNodes();

    if (!treeNodes) return [];

    if (!searchText || searchText.length === 0) {
      return this.getFlattenedVisibleNodes(treeNodes);
    }

    // Filter nodes based on search text
    const filteredNodes = this.filterTreeNodes(treeNodes, searchText.toLowerCase());
    return this.getFlattenedVisibleNodes(filteredNodes);
  });

  searchTextChange = new EventEmitter<string | null>();

  constructor() {
    this.searchTextChange.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((x) => {
      this.searchText.set(x);
    });
  }

  private countSelectedFiles(nodes: TreeNode[]): number {
    let count = 0;
    for (const node of nodes) {
      if (!node.isFolder && node.selected()) {
        count++;
      }
      count += this.countSelectedFiles(node.children);
    }
    return count;
  }

  private filterTreeNodes(nodes: TreeNode[], searchTerm: string): TreeNode[] {
    const filtered: TreeNode[] = [];

    for (const node of nodes) {
      const nameMatches = node.name.toLowerCase().includes(searchTerm);
      const pathMatches = node.path.toLowerCase().includes(searchTerm);
      const filteredChildren = this.filterTreeNodes(node.children, searchTerm);

      if (nameMatches || pathMatches || filteredChildren.length > 0) {
        const clonedNode: TreeNode = {
          ...node,
          children: filteredChildren,
          expanded: signal(true), // Auto-expand matching folders during search
        };
        filtered.push(clonedNode);
      }
    }

    return filtered;
  }

  private getFlattenedVisibleNodes(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];

    for (const node of nodes) {
      result.push(node);

      if (node.isFolder && node.expanded()) {
        result.push(...this.getFlattenedVisibleNodes(node.children));
      }
    }

    return result;
  }

  toggleFolder(node: TreeNode) {
    node.expanded.set(!node.expanded());
  }

  onFolderCheck(node: TreeNode, checked: boolean) {
    node.selected.set(checked);
    this.setChildrenSelected(node, checked);
    this.updateParentSelection(node);
  }

  private setChildrenSelected(node: TreeNode, selected: boolean) {
    node.children.forEach((child) => {
      child.selected.set(selected);
      if (child.isFolder) {
        this.setChildrenSelected(child, selected);
      }
    });
  }

  private updateParentSelection(node: TreeNode) {
    if (!node.parent) return;

    const siblings = node.parent.children;
    const allSelected = siblings.every((sibling) => sibling.selected());
    //const someSelected = siblings.some((sibling) => sibling.selected());

    node.parent.selected.set(allSelected);
    this.updateParentSelection(node.parent);
  }

  attachFiles() {
    const selectedFiles = this.getSelectedFiles();
    if (selectedFiles.length > 0) {
      this.attachFilesEvent.emit(selectedFiles);
    }
    this.modalService.close();
  }

  private getSelectedFiles(): LocalFile[] {
    const nodes = this.treeNodes();
    if (!nodes) return [];

    const selectedFiles: LocalFile[] = [];
    this.collectSelectedFiles(nodes, selectedFiles);
    return selectedFiles;
  }

  private collectSelectedFiles(nodes: TreeNode[], selectedFiles: LocalFile[]) {
    for (const node of nodes) {
      if (!node.isFolder && node.selected() && node.file) {
        selectedFiles.push(node.file);
      }
      this.collectSelectedFiles(node.children, selectedFiles);
    }
  }

  private buildTreeStructure(files: SelectedLocalFile[]): TreeNode[] {
    const root: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // Sort files by path to ensure proper hierarchy
    const sortedFiles = files.sort((a, b) => a.path.localeCompare(b.path));
    let foundSeparator = false;
    let separator = '/';
    for (const file of sortedFiles) {
      if (foundSeparator === false) {
        if (file.path.indexOf('\\') !== -1) {
          foundSeparator = true;
          separator = '\\';
        } else if (file.path.indexOf('/') !== -1) {
          foundSeparator = true;
          separator = '/';
        }
      }
      const pathParts = file.path.split(separator).filter((part) => part.length > 0);
      let currentLevel = root;
      let currentPath = '';

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        currentPath += (currentPath ? separator : '') + part;
        const isLastPart = i === pathParts.length - 1;

        let existingNode = currentLevel.find((node) => node.name === part);

        if (!existingNode) {
          const newNode: TreeNode = {
            name: part,
            path: currentPath,
            isFolder: !isLastPart,
            expanded: signal(false),
            selected: signal(false),
            children: [],
            level: i,
            file: isLastPart ? file : undefined,
          };

          currentLevel.push(newNode);
          nodeMap.set(currentPath, newNode);
          existingNode = newNode;

          // Set parent reference
          if (i > 0) {
            const parentPath = pathParts.slice(0, i).join(separator);
            const parentNode = nodeMap.get(parentPath);
            if (parentNode) {
              existingNode.parent = parentNode;
            }
          }
        }

        currentLevel = existingNode.children;
      }
    }

    return root;
  }

  private loadLocalFilesWithRxJSRetry() {
    const maxRetries = 10;
    const baseDelay = 2000;
    let retryCount = 0;

    this.localFiles.set(null);
    this.treeNodes.set(null);

    const pollForFiles = (): Observable<FileIndexResponse> => {
      return this.uploadService.getLocalFiles().pipe(
        switchMap((response) => {
          if (response.indexing === true) {
            this.isIndexing.set(true);
            retryCount++;
            if (retryCount >= maxRetries) {
              throw new Error('Maximum retry attempts reached');
            }

            const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 30000);
            return timer(delay).pipe(switchMap(() => pollForFiles()));
          } else {
            retryCount = 0;
            return of(response);
          }
        }),
        catchError((error) => {
          console.error('Error loading files:', error);
          this.isIndexing.set(false);
          throw error;
        })
      );
    };

    pollForFiles().subscribe({
      next: (x) => {
        this.isIndexing.set(false);
        x.files = x.files || [];

        const files = x.files.sort((a, b) => a.path.localeCompare(b.path));
        const selectedFiles = files.map((z) => {
          const fileName = z.path.split('\\').pop() ?? '';
          return { ...z, name: fileName, selected: signal(false) };
        });

        this.localFiles.set(selectedFiles);
        this.treeNodes.set(this.buildTreeStructure(selectedFiles));
      },
      error: (error) => {
        this.isIndexing.set(false);
        console.error('Failed to load files after retries:', error);
      },
    });
  }

  public show() {
    this.modalService.open('Host Files', this.modalBody(), this.modalFooter(), 'xl', 'full-height');
    this.loadLocalFilesWithRxJSRetry();
  }
}
