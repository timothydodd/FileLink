import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SkeletonComponent, ToastService } from '@rd-ui';
import { LucideAngularModule } from 'lucide-angular';
import { RouterHelperService } from '../../_services/route-helper';
import {
  GroupStorageUsage,
  StorageUsageResponse,
  UploadService,
} from '../../_services/web-api/upload.service';

@Component({
  selector: 'app-storage-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, SkeletonComponent],
  template: `
    @if (usage()) {
      <div class="summary-cards">
        <div class="card">
          <div class="card-label">Total Storage Used</div>
          <div class="card-value">{{ formatSize(usage()!.totalSize) }}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Items</div>
          <div class="card-value">{{ usage()!.totalItems }}</div>
        </div>
        <div class="card">
          <div class="card-label">Groups</div>
          <div class="card-value">{{ usage()!.groupCount }}</div>
        </div>
      </div>

      @if (usage()!.quotaBytes) {
        <div class="quota-section">
          <div class="quota-header">
            <span>Storage Quota</span>
            <span>{{ formatSize(usage()!.totalSize) }} / {{ formatSize(usage()!.quotaBytes!) }}</span>
          </div>
          <div class="quota-bar">
            <div
              class="quota-fill"
              [class.warning]="quotaPercent() >= 75 && quotaPercent() < 90"
              [class.danger]="quotaPercent() >= 90"
              [style.width.%]="quotaPercent()"
            ></div>
          </div>
        </div>
      }

      @if (usage()!.groups.length === 0) {
        <div class="empty-state">
          <lucide-angular name="hard-drive" [size]="48" class="empty-icon"></lucide-angular>
          <h3>No storage data</h3>
          <p>Upload files to a link to see storage usage here.</p>
        </div>
      } @else {
        <div class="groups-table-container">
          <table class="groups-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Items</th>
                <th>Size</th>
                <th>% of Total</th>
                <th>Last Upload</th>
              </tr>
            </thead>
            <tbody>
              @for (group of usage()!.groups; track group.groupId) {
                <tr class="group-row" (click)="navigateToGroup(group.groupId)">
                  <td>{{ group.groupId | slice: 0 : 8 }}...</td>
                  <td>{{ group.itemCount }}</td>
                  <td>{{ formatSize(group.totalSize) }}</td>
                  <td>
                    <span class="pct-bar" [style.width.px]="getBarWidth(group)"></span>
                    {{ getPercent(group) }}%
                  </td>
                  <td>
                    @if (group.lastUpload) {
                      {{ group.lastUpload | date: 'MMM d, y' }}
                    } @else {
                      <span style="color: #999">-</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else {
      <div class="summary-cards">
        <rd-skeleton width="200px" height="80px"></rd-skeleton>
        <rd-skeleton width="200px" height="80px"></rd-skeleton>
        <rd-skeleton width="200px" height="80px"></rd-skeleton>
      </div>
    }
  `,
  styleUrl: './storage-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoragePageComponent {
  uploadService = inject(UploadService);
  router = inject(RouterHelperService);
  toastr = inject(ToastService);
  usage = signal<StorageUsageResponse | null>(null);

  quotaPercent = computed(() => {
    const u = this.usage();
    if (!u?.quotaBytes) return 0;
    return Math.min(100, Math.round((u.totalSize / u.quotaBytes) * 100));
  });

  constructor() {
    this.uploadService
      .getStorageUsage()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (x) => this.usage.set(x),
        error: () => {
          this.toastr.error('Failed to load storage usage');
          this.usage.set({
            totalItems: 0,
            totalSize: 0,
            groupCount: 0,
            quotaBytes: null,
            groups: [],
          });
        },
      });
  }

  navigateToGroup(groupId: string) {
    this.router.goView(groupId);
  }

  getPercent(group: GroupStorageUsage): string {
    const total = this.usage()?.totalSize ?? 0;
    if (total === 0) return '0';
    return ((group.totalSize / total) * 100).toFixed(1);
  }

  getBarWidth(group: GroupStorageUsage): number {
    const total = this.usage()?.totalSize ?? 0;
    if (total === 0) return 0;
    return Math.max(2, Math.round((group.totalSize / total) * 100));
  }

  formatSize(bytes: number): string {
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;
    const TB = GB * 1024;

    if (bytes >= TB) return (bytes / TB).toFixed(2) + ' TB';
    if (bytes >= GB) return (bytes / GB).toFixed(2) + ' GB';
    if (bytes >= MB) return (bytes / MB).toFixed(2) + ' MB';
    if (bytes >= KB) return (bytes / KB).toFixed(2) + ' KB';
    return bytes + ' bytes';
  }
}
