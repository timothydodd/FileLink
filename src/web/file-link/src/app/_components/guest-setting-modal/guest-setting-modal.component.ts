import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CheckComponent } from '../../_components/check/check.component';
import { LoginCodeDisplayComponent } from '../../_components/login-code-display/login-code-display.component';
import { Constants } from '../../_helpers/constants';
import { AuthService } from '../../_services/auth/auth.service';
import { JwtAuthProvider } from '../../_services/auth/providers/jwt-auth-provider.service';
import { UserPreferenceService } from '../../_services/user-prefrences.service';
import { UploadService } from '../../_services/web-api/upload.service';
import { ModalService } from '../modal/modal.service';

@Component({
  standalone: true,
  selector: 'app-guest-setting-modal',
  imports: [CommonModule, FormsModule, LoginCodeDisplayComponent, CheckComponent, LucideAngularModule],
  template: `
    <ng-template #modalBody>
      <div>
        <strong>Login Link</strong>
        <app-login-code-display></app-login-code-display>
      </div>
    </ng-template>
    <ng-template #modalFooter>
      <div class="flex-row gap20">
        <app-check
          [checked]="cacheKey()"
          label="Keep Me Logged In (local storage)"
          (checkedEvent)="cacheCheckEvent($event)"
        ></app-check>
      </div>
    </ng-template>
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
  modalService = inject(ModalService);
  modalFooter = viewChild<TemplateRef<any>>('modalFooter');
  modalBody = viewChild<TemplateRef<any>>('modalBody');

  constructor() {
    this.authService.getUserOnce().subscribe((x) => {
      this.userId.set(x?.appUserId);
    });
    var saveLocation = this.userPref.get(Constants.UserPrefKeys.authCacheLocation);

    this.cacheKey.set(saveLocation === 'localstorage');
  }
  public show() {
    this.modalService.open('Settings', this.modalBody(), this.modalFooter());
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
