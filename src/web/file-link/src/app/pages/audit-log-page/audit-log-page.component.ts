import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '@rd-ui';
import { LucideAngularModule } from 'lucide-angular';
import { AuditLogItem, AuditLogService } from '../../_services/web-api/audit-log.service';

@Component({
  selector: 'app-audit-log-page',
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="audit-container">
      <h2>Activity Log</h2>
      @if (logs(); as items) {
        @if (items.length === 0) {
          <div class="empty-state">
            <lucide-angular name="scroll-text" [size]="48" class="empty-icon"></lucide-angular>
            <h3>No activity yet</h3>
            <p>Activity such as logins, downloads, and link creation will appear here.</p>
          </div>
        } @else {
          <div class="table-container">
            <table class="audit-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Detail</th>
                  <th class="hide-mobile">IP Address</th>
                </tr>
              </thead>
              <tbody>
                @for (item of items; track item.id) {
                  <tr>
                    <td class="date-col">{{ item.createdDate | date: 'MMM d, y h:mm a' }}</td>
                    <td>
                      <span class="action-badge" [ngClass]="'action-' + getActionClass(item.action)">
                        {{ formatAction(item.action) }}
                      </span>
                    </td>
                    <td class="detail-col">{{ item.detail || '-' }}</td>
                    <td class="ip-col hide-mobile">{{ item.ipAddress || '-' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (hasMore()) {
            <div class="load-more">
              <button class="btn btn-primary" (click)="loadMore()" [disabled]="loadingMore()">
                {{ loadingMore() ? 'Loading...' : 'Load More' }}
              </button>
            </div>
          }
        }
      } @else {
        <div class="loading-state">Loading...</div>
      }
    </div>
  `,
  styleUrl: './audit-log-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogPageComponent {
  private auditLogService = inject(AuditLogService);
  private toastr = inject(ToastService);

  private pageSize = 50;
  logs = signal<AuditLogItem[] | null>(null);
  totalCount = signal(0);
  loadingMore = signal(false);

  hasMore = computed(() => {
    const items = this.logs();
    return items !== null && items.length < this.totalCount();
  });

  constructor() {
    this.auditLogService
      .getLogs(this.pageSize, 0)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (res) => {
          this.logs.set(res.items);
          this.totalCount.set(res.totalCount);
        },
        error: () => {
          this.toastr.error('Failed to load activity log');
          this.logs.set([]);
        },
      });
  }

  loadMore(): void {
    const current = this.logs() ?? [];
    this.loadingMore.set(true);
    this.auditLogService.getLogs(this.pageSize, current.length).subscribe({
      next: (res) => {
        this.logs.set([...current, ...res.items]);
        this.totalCount.set(res.totalCount);
        this.loadingMore.set(false);
      },
      error: () => {
        this.toastr.error('Failed to load more entries');
        this.loadingMore.set(false);
      },
    });
  }

  formatAction(action: string): string {
    return action.replace(/([A-Z])/g, ' $1').trim();
  }

  getActionClass(action: string): string {
    switch (action) {
      case 'FileDownload':
        return 'download';
      case 'LinkLogin':
      case 'AdminLogin':
        return 'login';
      case 'GroupCreated':
      case 'LinkCreated':
      case 'FileUploaded':
        return 'create';
      case 'GroupDeleted':
        return 'delete';
      default:
        return 'default';
    }
  }
}
