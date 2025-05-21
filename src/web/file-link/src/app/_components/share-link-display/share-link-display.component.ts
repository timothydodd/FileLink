import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { take } from 'rxjs';
import { AuthService } from '../../_services/auth/auth.service';
import { JwtAuthProvider } from '../../_services/auth/providers/jwt-auth-provider.service';
import { ToastService } from '../../_services/toast.service';
import { AuthLinkService } from '../../_services/web-api/auth-link.service';
import { SettingModalComponent } from '../common/setting-modal/setting-modal.component';

@Component({
  selector: 'app-share-link-display',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, SettingModalComponent],
  styles: [
    `
      .flex-row {
        display: flex;
        align-items: center;

        overflow: hidden;
        justify-content: center;
      }
      .code-display {
        font-size: 14px;
        line-height: 14px;
        font-family: monospace;
        color: var(--text-color);
        background-color: rgba(159, 159, 159, 0.1);
        padding: 5px;
        border-radius: 5px;
        border: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        overflow: hidden;
        text-overflow: ellipsis;
        flex-shrink: 1;
        min-width: 0; /* Important for flex shrinking */
      }
      .btn-icon {
        flex-shrink: 0; /* Prevent buttons from shrinking */
      }
      .code-display a {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
      }
      @media screen and (max-width: 750px) {
        :host {
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 10px 0;
          position: relative;
          gap: 20px;
        }
        :host .share-link-display {
          flex-direction: column;
        }
      }
    `,
  ],
  template: `
    @if (loginUrl()) {
      <div class="flex-row gap10 share-link-display">
        <div class="code-display">
          <a [href]="loginUrl()">{{ loginUrl() }} </a>
        </div>
        <div class="flex-row gap10">
          <button class="btn btn-icon" title="Copy" (click)="copyLink()">
            <lucide-angular name="copy" size="16"></lucide-angular>
          </button>

          <button class="btn btn-icon" title="Settings" (click)="settings.show(groupId()!)">
            <lucide-angular name="settings" size="16"></lucide-angular>
          </button>
          <ng-content></ng-content>
        </div>
      </div>
      <app-setting-modal #settings> </app-setting-modal>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareLinkDisplayComponent {
  jwtAuthProvider = inject(JwtAuthProvider);
  authLinkService = inject(AuthLinkService);
  authService = inject(AuthService);
  toastr = inject(ToastService);
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
  loginUrl = signal<string | null>(null);
}
