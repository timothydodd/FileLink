import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../_services/auth/auth.service';
import { TokenUser } from '../../_services/auth/token-user';
import { RouterHelperService } from '../../_services/route-helper';
import { ToolbarService } from '../../_services/toolbar.service';
import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal.component';
import { GuestSettingModalComponent } from '../guest-setting-modal/guest-setting-modal.component';

@Component({
  selector: 'app-main-menu',
  imports: [LucideAngularModule, RouterModule, GuestSettingModalComponent, ChangePasswordModalComponent],
  template: `
    <button type="button" class="btn-icon" (click)="isOpen.set(!isOpen())">
      <lucide-angular name="square-menu"></lucide-angular>
    </button>
    @if (isOpen()) {
      <div class="menu">
        @if (showGuestSettings()) {
          <button dropdown-item (click)="guestModal.show()">Settings</button>
          <div class="dropdown-divider"></div>
        }
        @if (showLinks()) {
          <button dropdown-item routerLink="links" routerLinkActive="active-link">Manage Links</button>

          <button dropdown-item (click)="changePasswordModal.show()">Change Password</button>
          <div class="dropdown-divider"></div>
        }
        <button dropdown-item (click)="logOut()">Logout</button>
      </div>
    }
    <app-guest-setting-modal #guestModal></app-guest-setting-modal>
    <app-change-password-modal #changePasswordModal></app-change-password-modal>
  `,
  styleUrl: './main-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainMenuComponent {
  elementRef = inject(ElementRef);
  authService = inject(AuthService);
  router = inject(RouterHelperService);
  user = signal<TokenUser | null>(null);
  toolbarService = inject(ToolbarService);

  isOpen = signal(false);
  showGuestSettings = computed(() => {
    return this.user()?.role === 'Reader';
  });
  showLinks = computed(() => {
    return this.user()?.role === 'Owner';
  });
  constructor() {
    this.authService
      .getUser()
      .pipe(takeUntilDestroyed())
      .subscribe((x) => {
        this.user.set(x);
      });
  }

  open() {
    if (!this.isOpen()) {
      this.isOpen.set(true);
    }
  }

  close() {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isOpen) {
      return;
    }

    const target = event.target as HTMLElement;
    const hostElement = this.elementRef.nativeElement;

    if (!hostElement.contains(target)) {
      // Click outside
      this.close();
    } else {
      // Click inside
      const isMenuItem = target.closest('[dropdown-item]') !== null;

      if (isMenuItem) {
        this.close();
      }
    }
  }

  linksOpen() {
    this.router.goLinks();
  }
  logOut() {
    this.authService.logout().subscribe((x) => {
      this.user.set(null);
    });
  }
}
