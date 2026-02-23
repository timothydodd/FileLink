import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { ModalContainerService } from '@rd-ui';
import { LucideAngularModule } from 'lucide-angular';
import { filter } from 'rxjs';
import { AuthService } from '../../_services/auth/auth.service';
import { TokenUser } from '../../_services/auth/token-user';
import { RouterHelperService } from '../../_services/route-helper';
import { ThemeService } from '../../_services/theme.service';
import { ToolbarService } from '../../_services/toolbar.service';
import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal.component';
import { GuestSettingModalComponent } from '../guest-setting-modal/guest-setting-modal.component';

@Component({
  selector: 'app-main-menu',
  imports: [LucideAngularModule, RouterModule],
  template: `
    <button type="button" class="btn-icon" aria-label="Open menu" title="Menu" (click)="isOpen.set(!isOpen())">
      <lucide-angular name="square-menu" [size]="20"></lucide-angular>
    </button>
    @if (isOpen()) {
      <div class="menu-backdrop" (click)="close()"></div>
      <div class="menu">
        @if (showGuestSettings()) {
          <button dropdown-item (click)="openGuestSettings()" aria-label="Settings">
            <lucide-angular name="settings" [size]="18"></lucide-angular>
            <span>Settings</span>
          </button>
        }
        @if (showLinks()) {
          <div class="menu-section-label">Links</div>
          <button dropdown-item (click)="router.goCreate()" aria-label="Create link">
            <lucide-angular name="plus" [size]="18"></lucide-angular>
            <span>Create Link</span>
          </button>
          <button dropdown-item routerLink="links" routerLinkActive="active-link" aria-label="Manage links">
            <lucide-angular name="list" [size]="18"></lucide-angular>
            <span>Manage Links</span>
          </button>

          <div class="menu-divider"></div>
          <div class="menu-section-label">Admin</div>
          <button dropdown-item (click)="router.goStorage()" aria-label="Storage usage">
            <lucide-angular name="hard-drive" [size]="18"></lucide-angular>
            <span>Storage Usage</span>
          </button>
          <button dropdown-item (click)="router.goAuditLog()" aria-label="Activity log">
            <lucide-angular name="scroll-text" [size]="18"></lucide-angular>
            <span>Activity Log</span>
          </button>
          <button dropdown-item (click)="openChangePassword()" aria-label="Change password">
            <lucide-angular name="key-round" [size]="18"></lucide-angular>
            <span>Change Password</span>
          </button>
        }

        <div class="menu-divider"></div>
        <button dropdown-item (click)="toggleTheme()" [attr.aria-label]="themeService.resolvedTheme() === 'light' ? 'Switch to dark mode' : 'Switch to light mode'">
          @if (themeService.resolvedTheme() === 'light') {
            <lucide-angular name="moon" [size]="18"></lucide-angular>
            <span>Dark Mode</span>
          } @else {
            <lucide-angular name="sun" [size]="18"></lucide-angular>
            <span>Light Mode</span>
          }
        </button>
        <button dropdown-item class="logout-item" (click)="logOut()" aria-label="Log out">
          <lucide-angular name="log-out" [size]="18"></lucide-angular>
          <span>Logout</span>
        </button>
      </div>
    }
  `,
  styleUrl: './main-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainMenuComponent {
  elementRef = inject(ElementRef);
  authService = inject(AuthService);
  router = inject(RouterHelperService);
  modalContainerService = inject(ModalContainerService);
  themeService = inject(ThemeService);
  user = signal<TokenUser | null>(null);
  toolbarService = inject(ToolbarService);
  private angularRouter = inject(Router);

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

    this.angularRouter.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.close();
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
    if (!this.isOpen()) {
      return;
    }

    const target = event.target as HTMLElement;
    const hostElement = this.elementRef.nativeElement;

    if (!hostElement.contains(target)) {
      this.close();
    } else {
      const isMenuItem = target.closest('[dropdown-item]') !== null;

      if (isMenuItem) {
        this.close();
      }
    }
  }

  linksOpen() {
    this.router.goLinks();
  }

  openGuestSettings() {
    this.modalContainerService.openComponent(GuestSettingModalComponent);
  }

  openChangePassword() {
    this.modalContainerService.openComponent(ChangePasswordModalComponent);
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  logOut() {
    this.authService.logout().subscribe(() => {
      this.user.set(null);
      this.router.goLogin();
    });
  }
}
