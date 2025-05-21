import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { take } from 'rxjs';
import { AuthService } from '../../../_services/auth/auth.service';
import { JwtAuthProvider } from '../../../_services/auth/providers/jwt-auth-provider.service';
import { RouterHelperService } from '../../../_services/route-helper';
import { ToastService } from '../../../_services/toast.service';
import { UserPreferenceService } from '../../../_services/user-prefrences.service';
import { AuthLinkService, LoginRequest } from '../../../_services/web-api/auth-link.service';
import { UploadService } from '../../../_services/web-api/upload.service';
import { ModalService } from '../modal/modal.service';

@Component({
  standalone: true,
  selector: 'app-setting-modal',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LucideAngularModule],
  template: `
    <ng-template #modalBody>
      @if (loginUrl()) {
        <!-- Display generated link -->
        <div class="link-display">
          <div class="link-box">
            <span class="link-text">{{ loginUrl() }}</span>
            <button class="copy-button" (click)="copyToClipboard()" title="Copy to clipboard">
              <i class="fa fa-copy"></i> Copy
            </button>
          </div>
          <p class="expiry-note">This link will expire on {{ this.expireDate() | date: 'medium' }}</p>
        </div>

        <!-- Link settings form -->
        <div class="settings-form">
          <div class="expiry-settings">
            <label>Link expires in:</label>
            <div class="input-group">
              <input
                type="number"
                [ngModel]="expirationValue()"
                (ngModelChange)="expirationValue.set($event)"
                min="1"
                class="expiry-value"
              />
              <select [ngModel]="expirationType()" (ngModelChange)="expirationType.set($event)" class="expiry-type">
                <option *ngFor="let type of expiryTypes" [value]="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>
            @if (hasError()) {
              <div class="error">Please enter a valid number greater than 0 hours</div>
            }
          </div>
        </div>
      }
    </ng-template>
    <ng-template #modalFooter>
      @if (loginUrl(); as form) {
        <div class="button-group">
          <button type="button" class="btn delete-button" (click)="deleteLink()">Delete</button>
          <button type="button" class="btn regenerate-button" [disabled]="hasError()" (click)="generateLink()">
            Regenerate Link
          </button>
        </div>
      }
    </ng-template>
  `,
  styleUrl: './setting-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingModalComponent {
  toastr = inject(ToastService);
  authProvider = inject(JwtAuthProvider);
  uploadService = inject(UploadService);
  authLinkService = inject(AuthLinkService);
  userPref = inject(UserPreferenceService);
  authService = inject(AuthService);
  router = inject(RouterHelperService);
  cacheKey = signal(false);
  userId = signal<string | null>(null);
  groupId = signal<string | null>(null);

  loginUrl = signal<string>('');
  expireDate = signal<Date | null>(null);
  expiryTypes = [
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Days' },
  ];

  expirationType = signal<'days' | 'hours'>('days');
  expirationValue = signal<number>(15);
  hasError = computed(() => {
    var v = this.expirationValue();
    return v < 1;
  });
  modalService = inject(ModalService);
  modalFooter = viewChild<TemplateRef<any>>('modalFooter');
  modalBody = viewChild<TemplateRef<any>>('modalBody');
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
  loadUrl(z: LoginRequest, setType = false) {
    this.loginUrl.set(`${window.location.origin}/l/${z.code}`);
    var dtNow = new Date();
    var dtExpire = new Date(z.expirationDate);
    this.expireDate.set(dtExpire);
    if (setType) {
      var diff = dtExpire.getTime() - dtNow.getTime();
      var diffHours = Math.floor(diff / (1000 * 60 * 60));
      var diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        this.expirationValue.set(diffDays);
        this.expirationType.set('days');
      } else {
        this.expirationValue.set(diffHours);
        this.expirationType.set('hours');
      }
    }
  }
  getExpireLabel(v: string) {
    var trimS = this.expirationValue() === 1;
    for (var i = 0; i < this.expiryTypes.length; i++) {
      if (this.expiryTypes[i].value === v) {
        var l = this.expiryTypes[i].label;

        return trimS ? l.substring(0, l.length - 1) : l;
      }
    }
    return '';
  }
  generateLink(): void {
    var hoursValid = this.expirationType() === 'hours' ? this.expirationValue() : this.expirationValue() * 24;

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
      this.modalService.close();
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

  show(groupId: string) {
    this.groupId.set(groupId);
    this.modalService.open('Settings', this.modalBody(), this.modalFooter());
  }
}
