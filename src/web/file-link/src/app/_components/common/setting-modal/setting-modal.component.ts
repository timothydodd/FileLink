import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { CheckboxComponent, ModalComponent, ModalLayoutComponent, ToastService } from '@rd-ui';
import { LucideAngularModule } from 'lucide-angular';
import { take } from 'rxjs';
import { AuthService } from '../../../_services/auth/auth.service';
import { JwtAuthProvider } from '../../../_services/auth/providers/jwt-auth-provider.service';
import { RouterHelperService } from '../../../_services/route-helper';
import { UserPreferenceService } from '../../../_services/user-prefrences.service';
import { AuthLinkService, LoginRequest } from '../../../_services/web-api/auth-link.service';
import { UploadService } from '../../../_services/web-api/upload.service';
import { QrCodeComponent } from '../../qr-code/qr-code.component';

interface SettingsFormModel {
  expirationValue: number;
  expirationType: 'days' | 'hours';
  passwordEnabled: boolean;
  password: string;
}

@Component({
  standalone: true,
  selector: 'app-setting-modal',
  imports: [CommonModule, FormField, LucideAngularModule, ModalLayoutComponent, QrCodeComponent, CheckboxComponent],
  template: `
    <rd-modal-layout [title]="'Settings'">
      <div slot="body">
        @if (loginUrl()) {
          <div class="panel-layout">
            <div class="panel-left">
              <section class="section">
                <h3 class="section-title">Share Link</h3>
                <div class="link-card">
                  <div class="link-row">
                    <span class="link-text">{{ loginUrl() }}</span>
                    <button class="btn-copy" (click)="copyToClipboard()" title="Copy to clipboard">
                      <lucide-angular name="copy" size="14"></lucide-angular>
                      Copy
                    </button>
                    <button class="btn-copy" [disabled]="hasError()" (click)="generateLink()" title="Regenerate link">
                      <lucide-angular name="refresh-cw" size="14"></lucide-angular>
                    </button>
                  </div>
                  <span class="expiry-badge">
                    <lucide-angular name="clock" size="12"></lucide-angular>
                    Expires {{ expireDate() | date: 'mediumDate' }}
                  </span>
                </div>
              </section>

              <div class="divider"></div>

              <section class="section">
                <h3 class="section-title">Link Settings</h3>
                <div class="setting-row">
                  <label class="setting-label">Expiration</label>
                  <div class="input-row">
                    <input
                      type="number"
                      [formField]="settingsForm.expirationValue"
                      class="input-field input-number"
                    />
                    <select [formField]="settingsForm.expirationType" class="input-field input-select">
                      <option *ngFor="let type of expiryTypes" [value]="type.value">
                        {{ type.label }}
                      </option>
                    </select>
                  </div>
                  @if (hasError()) {
                    <div class="error-text">Please enter a valid number greater than 0</div>
                  }
                </div>

                <div class="setting-row">
                  <rd-checkbox
                    [formField]="settingsForm.passwordEnabled"
                    label="Require password"
                  ></rd-checkbox>
                  @if (settingsModel().passwordEnabled) {
                    <input
                      type="password"
                      [formField]="settingsForm.password"
                      class="input-field"
                      placeholder="Enter password"
                    />
                  }
                </div>
              </section>
            </div>

            <div class="panel-right">
              <app-qr-code [value]="loginUrl()" [size]="180"></app-qr-code>
            </div>
          </div>
        }
      </div>
      <div slot="footer">
        @if (loginUrl()) {
          <div class="button-group">
            <button type="button" class="btn delete-button" (click)="deleteLink()">
              <lucide-angular name="trash-2" size="14"></lucide-angular>
              Delete
            </button>
            <button type="button" class="btn btn-primary save-button" [disabled]="hasError() || !isDirty() || saving()" (click)="saveSettings()">
              @if (saving()) {
                <span class="btn-spinner-sm"></span>
                Saving...
              } @else {
                Save
              }
            </button>
          </div>
        }
      </div>
    </rd-modal-layout>
  `,
  styleUrl: './setting-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingModalComponent implements OnInit {
  private modalComponent = inject(ModalComponent);
  toastr = inject(ToastService);
  authProvider = inject(JwtAuthProvider);
  uploadService = inject(UploadService);
  authLinkService = inject(AuthLinkService);
  userPref = inject(UserPreferenceService);
  authService = inject(AuthService);
  router = inject(RouterHelperService);
  userId = signal<string | null>(null);
  groupId = signal<string | null>(null);

  loginUrl = signal<string>('');
  expireDate = signal<Date | null>(null);
  saving = signal(false);
  expiryTypes = [
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Days' },
  ];

  settingsModel = signal<SettingsFormModel>({
    expirationValue: 15,
    expirationType: 'days',
    passwordEnabled: false,
    password: '',
  });
  settingsForm = form(this.settingsModel);

  hasError = computed(() => {
    return this.settingsModel().expirationValue < 1;
  });

  isDirty = computed(() => {
    return this.settingsForm().dirty();
  });

  constructor() {
    this.authService.getUserOnce().subscribe((x) => {
      this.userId.set(x?.appUserId);
    });

    effect(() => {
      var groupId = this.groupId();
      if (!groupId) {
        return;
      }
      this.authLinkService
        .getShareLink(groupId, false)
        .pipe(take(1))
        .subscribe((z) => {
          this.loadUrl(z, true);
        });
    });
  }

  ngOnInit(): void {
    const data = this.modalComponent.config?.data;
    if (data?.loginUrl) {
      this.loginUrl.set(data.loginUrl);
    }
    if (data?.groupId) {
      this.groupId.set(data.groupId);
    }
  }

  loadUrl(z: LoginRequest, setType = false) {
    this.loginUrl.set(`${window.location.origin}/l/${z.code}`);
    var dtNow = new Date();
    var dtExpire = new Date(z.expirationDate);
    this.expireDate.set(dtExpire);

    let expirationType: 'days' | 'hours' = this.settingsModel().expirationType;
    let expirationValue = this.settingsModel().expirationValue;

    if (setType) {
      var diff = dtExpire.getTime() - dtNow.getTime();
      var diffHours = Math.round(diff / (1000 * 60 * 60));
      var diffDays = Math.round(diff / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        expirationValue = diffDays;
        expirationType = 'days';
      } else {
        expirationValue = diffHours;
        expirationType = 'hours';
      }
    }

    this.settingsModel.set({
      expirationValue,
      expirationType,
      passwordEnabled: z.hasPassword ?? false,
      password: '',
    });
  }

  generateLink(): void {
    const model = this.settingsModel();
    var hoursValid = model.expirationType === 'hours' ? model.expirationValue : model.expirationValue * 24;

    this.authLinkService
      .getShareLink(this.groupId()!, true, hoursValid)
      .pipe(take(1))
      .subscribe((z) => {
        this.loadUrl(z);
      });
  }

  deleteLink(): void {
    this.uploadService.delete(this.groupId()!).subscribe(() => {
      this.toastr.success('Link deleted successfully');
      this.router.goHome();
      this.modalComponent.close();
    });
  }

  saveSettings(): void {
    if (this.saving()) return;
    this.saving.set(true);
    const model = this.settingsModel();
    const hoursValid = model.expirationType === 'hours' ? model.expirationValue : model.expirationValue * 24;

    this.authLinkService
      .updateLinkSettings(this.groupId()!, {
        hoursValid,
        passwordEnabled: model.passwordEnabled,
        password: model.password || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: (z) => {
          this.loadUrl(z);
          this.saving.set(false);
          this.toastr.success('Settings saved');
        },
        error: () => {
          this.toastr.error('Failed to save settings');
          this.saving.set(false);
        },
      });
  }

  copyToClipboard(): void {
    navigator.clipboard
      .writeText(this.loginUrl())
      .then(() => {
        this.toastr.success('Link copied to clipboard');
      })
      .catch((err) => {
        console.error('Could not copy text: ', err);
      });
  }
}
