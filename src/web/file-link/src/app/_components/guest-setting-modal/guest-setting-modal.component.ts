import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent, ModalLayoutComponent } from '@rd-ui';
import { LoginCodeDisplayComponent } from '../../_components/login-code-display/login-code-display.component';
import { Constants } from '../../_helpers/constants';
import { AuthService } from '../../_services/auth/auth.service';
import { JwtAuthProvider } from '../../_services/auth/providers/jwt-auth-provider.service';
import { UserPreferenceService } from '../../_services/user-prefrences.service';
import { UploadService } from '../../_services/web-api/upload.service';

@Component({
  standalone: true,
  selector: 'app-guest-setting-modal',
  imports: [CommonModule, FormsModule, LoginCodeDisplayComponent, CheckboxComponent, ModalLayoutComponent],
  template: `
    <rd-modal-layout [title]="'Settings'">
      <div slot="body">
        <div>
          <strong>Login Link</strong>
          <app-login-code-display></app-login-code-display>
        </div>
      </div>
      <div slot="footer">
        <div class="flex-row gap20">
          <rd-checkbox
            [ngModel]="cacheKey()"
            label="Keep Me Logged In (local storage)"
            (checkedChange)="cacheCheckEvent($event)"
          ></rd-checkbox>
        </div>
      </div>
    </rd-modal-layout>
  `,
  styleUrl: './guest-setting-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestSettingModalComponent {
  authProvider = inject(JwtAuthProvider);
  uploadService = inject(UploadService);
  userPref = inject(UserPreferenceService);
  authService = inject(AuthService);
  cacheKey = signal(false);

  saveKey = signal<string | null>(null);
  userId = signal<string | null>(null);

  constructor() {
    this.authService.getUserOnce().subscribe((x) => {
      this.userId.set(x?.appUserId);
    });
    var saveLocation = this.userPref.get(Constants.UserPrefKeys.authCacheLocation);

    this.cacheKey.set(saveLocation === 'localstorage');
  }

  cacheCheckEvent(e: boolean) {
    this.cacheKey.set(e);
    if (e === true) {
      this.authProvider.switchToLocalStorage();
    } else {
      this.authProvider.switchToMemoryStorage();
    }
  }
}
