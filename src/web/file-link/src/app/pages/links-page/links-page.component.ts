import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterHelperService } from '../../_services/route-helper';
import { AuthLinkService, LinkListItem } from '../../_services/web-api/auth-link.service';

@Component({
  selector: 'app-links-page',
  imports: [CommonModule],
  template: `
    <div class="toolbar">
      <button class="btn btn-primary" (click)="router.goCreate()">Create New</button>
    </div>
    <div class="divider"></div>
    <div class="shared-links-container">
      @if (links(); as links) {
        @if (links.length === 0) {
          <div class="empty-state">
            <p>No shared links found.</p>
          </div>
        } @else {
          <div class="links-table-container">
            <table class="links-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Expiration</th>
                  <th>Uses</th>
                  <th>Last Access</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                @for (link of links; track $index) {
                  <tr
                    [ngClass]="getExpirationStatus(link.expirationDate)"
                    (click)="navigateToDetails(link.groupId)"
                    class="link-row"
                  >
                    <td>{{ link.code }}</td>
                    <td>
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
                    <td>
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
  links = signal<LinkListItem[] | null>(null);

  error: string | null = null;
  constructor() {
    this.authLinkService.getLinks().subscribe((x) => {
      this.links.set(x ?? []);
    });
  }
  navigateToDetails(groupId: string): void {
    this.router.goView(groupId);
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
