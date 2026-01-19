import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { ModalContainerService, ToastService } from '@rd-ui';
import { LucideAngularModule } from 'lucide-angular';
import { take } from 'rxjs';
import { AuthService } from '../../_services/auth/auth.service';
import { JwtAuthProvider } from '../../_services/auth/providers/jwt-auth-provider.service';
import { AuthLinkService } from '../../_services/web-api/auth-link.service';
import { SettingModalComponent } from '../common/setting-modal/setting-modal.component';

@Component({
  selector: 'app-share-link-display',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  styleUrl: './share-link-display.component.scss',
  template: `
    @if (loginUrl()) {
      <div class="flex-row gap10 share-link-display">
        <div class="code-display">
          <a [href]="loginUrl()">{{ loginUrl() }} </a>
        </div>
        <div class="flex-row gap10" style="justify-self: center">
          <button class="btn btn-icon" title="Copy" (click)="copyLink()">
            <lucide-angular name="copy" size="18"></lucide-angular>
          </button>

          <button class="btn btn-icon" title="Settings" (click)="openSettings()">
            <lucide-angular name="settings" size="18"></lucide-angular>
          </button>
          <ng-content></ng-content>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareLinkDisplayComponent {
  jwtAuthProvider = inject(JwtAuthProvider);
  authLinkService = inject(AuthLinkService);
  authService = inject(AuthService);
  toastr = inject(ToastService);
  modalContainerService = inject(ModalContainerService);
  groupId = input.required<string | null>();

  constructor() {
    effect(() => {
      var groupId = this.groupId();
      if (!groupId) {
        return;
      }
      this.authLinkService
        .getShareLink(groupId, false)
        .pipe(take(1))
        .subscribe((z) => {
          this.loginUrl.set(`${window.location.origin}/l/${z.code}`);
        });
    });
  }

  copyLink() {
    var link = this.loginUrl();
    if (!link) {
      console.error('No link to copy');
      return;
    }
    navigator.clipboard
      .writeText(link)
      .then(() => {
        this.toastr.success('Link copied to clipboard');
      })
      .catch((err) => {
        console.error('Failed to copy link: ', err);
      });
  }
  reRoll() {
    this.authLinkService
      .getShareLink(this.groupId()!, true)
      .pipe(take(1))
      .subscribe((z) => {
        this.loginUrl.set(`${window.location.origin}/l/${z.code}`);
      });
  }

  openSettings() {
    this.modalContainerService.openComponent(SettingModalComponent, { data: { groupId: this.groupId() } });
  }

  loginUrl = signal<string | null>(null);
}
