import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CheckboxComponent, ToastService } from '@rd-ui';
import { RouterHelperService } from '../../_services/route-helper';
import { LucideAngularModule } from 'lucide-angular';
import { AuthLinkService, LinkListItem } from '../../_services/web-api/auth-link.service';

@Component({
  selector: 'app-links-page',
  imports: [CommonModule, FormsModule, LucideAngularModule, CheckboxComponent, RouterModule],
  template: `
    <div class="toolbar">
      <button class="btn btn-primary" (click)="router.goCreate()">
        <lucide-angular name="plus" [size]="16"></lucide-angular>
        Create New
      </button>
      <button class="btn btn-tool" [class.active]="selectionMode()" (click)="toggleSelectionMode()">
        <lucide-angular [name]="selectionMode() ? 'x' : 'list'" [size]="16"></lucide-angular>
        {{ selectionMode() ? 'Cancel' : 'Select' }}
      </button>
      @if (selectionMode() && selectedCount() > 0) {
        <button class="btn btn-tool" (click)="bulkExpire()" [disabled]="bulkLoading()" aria-label="Expire selected links">
          @if (bulkLoading()) {
            <span class="btn-spinner-sm"></span>
          } @else {
            <lucide-angular name="calendar-days" [size]="16"></lucide-angular>
          }
          Expire ({{ selectedCount() }})
        </button>
        <button class="btn btn-danger" (click)="bulkDelete()" [disabled]="bulkLoading()" aria-label="Delete selected links">
          @if (bulkLoading()) {
            <span class="btn-spinner-sm"></span>
          } @else {
            <lucide-angular name="x" [size]="16"></lucide-angular>
          }
          Delete ({{ selectedCount() }})
        </button>
      }
      <input
        class="search-bar"
        type="text"
        placeholder="Filter by code..."
        [ngModel]="searchTerm()"
        (ngModelChange)="searchTerm.set($event)"
      />
    </div>
    <div class="divider"></div>
    <div class="shared-links-container">
      @if (filteredLinks(); as links) {
        @if (links.length === 0 && !searchTerm()) {
          <div class="empty-state">
            <lucide-angular name="link" [size]="48" class="empty-icon"></lucide-angular>
            <h3>No shared links yet</h3>
            <p>Create your first link to start sharing files.</p>
            <a routerLink="/create" class="btn btn-primary empty-cta">
              <lucide-angular name="plus" [size]="16"></lucide-angular>
              Create Link
            </a>
          </div>
        } @else if (links.length === 0 && searchTerm()) {
          <div class="empty-state">
            <lucide-angular name="search" [size]="48" class="empty-icon"></lucide-angular>
            <h3>No results</h3>
            <p>No links match "{{ searchTerm() }}".</p>
          </div>
        } @else {
          <div class="links-table-container">
            <table class="links-table">
              <thead>
                <tr>
                  @if (selectionMode()) {
                    <th class="checkbox-col">
                      <rd-checkbox [ngModel]="allSelected()" (checkedChange)="toggleSelectAll()"></rd-checkbox>
                    </th>
                  }
                  <th>Code</th>
                  <th></th>
                  <th class="hide-mobile">Expiration</th>
                  <th>Uses</th>
                  <th class="hide-mobile">Last Access</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                @for (link of links; track link.code) {
                  <tr
                    [ngClass]="getExpirationStatus(link.expirationDate)"
                    [class.selected]="selectedCodes().has(link.code)"
                    (click)="onRowClick(link, $event)"
                    class="link-row"
                  >
                    @if (selectionMode()) {
                      <td class="checkbox-col" (click)="$event.stopPropagation()">
                        <rd-checkbox
                          [ngModel]="selectedCodes().has(link.code)"
                          (checkedChange)="toggleSelection(link.code)"
                        ></rd-checkbox>
                      </td>
                    }
                    <td>{{ link.code }}</td>
                    <td>
                      @if (link.hasPassword) {
                        <lucide-angular name="lock" [size]="14"></lucide-angular>
                      }
                    </td>
                    <td class="hide-mobile">
                      @if (link.expirationDate === null) {
                        <span class="no-expiration">No expiration</span>
                      } @else {
                        @if (isToday(link.expirationDate)) {
                          {{ link.expirationDate | date: 'medium' }}
                        } @else {
                          {{ link.expirationDate | date: 'MMM d, y' }}
                        }
                        <span *ngIf="isExpired(link.expirationDate)" class="expired-tag">Expired</span>
                      }
                    </td>
                    <td>{{ getUsageText(link.uses, link.maxUses) }}</td>
                    <td class="hide-mobile">
                      @if (link.lastAccess) {
                        {{ link.lastAccess | date: 'MMM d, y' }}
                      } @else {
                        <span class="no-access">none</span>
                      }
                    </td>
                    <td>{{ link.itemCount }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  `,
  styleUrl: './links-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinksPageComponent {
  authLinkService = inject(AuthLinkService);
  router = inject(RouterHelperService);
  toastr = inject(ToastService);
  links = signal<LinkListItem[] | null>(null);
  searchTerm = signal('');
  selectedCodes = signal<Set<string>>(new Set());
  selectionMode = signal(false);
  bulkLoading = signal(false);

  filteredLinks = computed(() => {
    const links = this.links();
    const term = this.searchTerm().toLowerCase().trim();
    if (!links) return null;
    if (!term) return links;
    return links.filter((l) => l.code.toLowerCase().includes(term));
  });

  allSelected = computed(() => {
    const links = this.links();
    const selected = this.selectedCodes();
    return !!links && links.length > 0 && selected.size === links.length;
  });

  selectedCount = computed(() => this.selectedCodes().size);

  error: string | null = null;
  constructor() {
    this.authLinkService
      .getLinks()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (x) => this.links.set(x ?? []),
        error: () => {
          this.toastr.error('Failed to load shared links');
          this.links.set([]);
        },
      });
  }

  onRowClick(link: LinkListItem, event: Event): void {
    if (this.selectionMode()) {
      this.toggleSelection(link.code);
    } else {
      this.navigateToDetails(link.groupId);
    }
  }

  navigateToDetails(groupId: string): void {
    this.router.goView(groupId);
  }

  toggleSelectionMode(): void {
    this.selectionMode.update((v) => !v);
    if (!this.selectionMode()) {
      this.selectedCodes.set(new Set());
    }
  }

  toggleSelection(code: string): void {
    this.selectedCodes.update((s) => {
      const next = new Set(s);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedCodes.set(new Set());
    } else {
      const all = this.links()?.map((l) => l.code) ?? [];
      this.selectedCodes.set(new Set(all));
    }
  }

  bulkExpire(): void {
    if (this.bulkLoading()) return;
    this.bulkLoading.set(true);
    const codes = Array.from(this.selectedCodes());
    this.authLinkService.bulkExpireLinks(codes).subscribe({
      next: () => {
        this.refreshLinks();
        this.bulkLoading.set(false);
      },
      error: () => {
        this.toastr.error('Failed to expire links');
        this.bulkLoading.set(false);
      },
    });
  }

  bulkDelete(): void {
    if (!confirm(`Delete ${this.selectedCount()} link(s)? This cannot be undone.`)) return;
    if (this.bulkLoading()) return;
    this.bulkLoading.set(true);
    const codes = Array.from(this.selectedCodes());
    this.authLinkService.bulkDeleteLinks(codes).subscribe({
      next: () => {
        this.refreshLinks();
        this.bulkLoading.set(false);
      },
      error: () => {
        this.toastr.error('Failed to delete links');
        this.bulkLoading.set(false);
      },
    });
  }

  refreshLinks(): void {
    this.selectedCodes.set(new Set());
    this.authLinkService.getLinks().subscribe({
      next: (x) => this.links.set(x ?? []),
      error: () => this.links.set([]),
    });
  }

  isToday(date: Date | string): boolean {
    const today = new Date();
    const parsedDate = typeof date === 'string' ? new Date(date) : date;
    return (
      parsedDate.getDate() === today.getDate() &&
      parsedDate.getMonth() === today.getMonth() &&
      parsedDate.getFullYear() === today.getFullYear()
    );
  }
  getUsageText(uses: number | null, maxUses: number | null): string {
    if (uses === null) {
      return 'N/A';
    }
    if (maxUses === null) {
      return `${uses} (unlimited)`;
    }
    return `${uses} / ${maxUses}`;
  }

  isExpired(date: Date): boolean {
    return date < new Date();
  }

  getExpirationStatus(date: Date): string {
    return this.isExpired(date) ? 'expired' : 'active';
  }
}
