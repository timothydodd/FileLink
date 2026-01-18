import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '@rd-ui';
import { LucideAngularModule } from 'lucide-angular';
import { AuthLinkService } from '../../_services/web-api/auth-link.service';
import { ModalService } from '../common/modal/modal.service';

@Component({
  standalone: true,
  selector: 'app-change-password-modal',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LucideAngularModule],
  template: `
    <ng-template #modalBody>
      <div class="form-group">
        <label for="currentPassword">Current Password</label>
        <input
          type="password"
          id="currentPassword"
          [ngModel]="currentPassword()"
          (ngModelChange)="currentPassword.set($event)"
        />
      </div>
      <div class="form-group">
        <label for="newPassword">New Password</label>
        <input type="password" id="newPassword" [ngModel]="newPassword()" (ngModelChange)="newPassword.set($event)" />
      </div>
      <div class="form-group">
        <label for="confirmPassword">Confirm New Password</label>
        <input
          type="password"
          id="confirmPassword"
          [ngModel]="confirmPassword()"
          (ngModelChange)="confirmPassword.set($event)"
        />
      </div>
      @if (hasError()) {
        <div class="error">Passwords must match and be at least 8 characters.</div>
      }
    </ng-template>
    <ng-template #modalFooter>
      <div class="button-group">
        <button class="btn btn-primary" (click)="changePassword()" [disabled]="hasError()">Change Password</button>
      </div>
    </ng-template>
  `,
  styleUrl: './change-password-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordModalComponent {
  modalService = inject(ModalService);
  toastr = inject(ToastService);
  authService = inject(AuthLinkService);
  formBuilder = inject(FormBuilder);

  modalBody = viewChild<TemplateRef<any>>('modalBody');
  modalFooter = viewChild<TemplateRef<any>>('modalFooter');

  currentPassword = signal<string>('');
  newPassword = signal<string>('');
  confirmPassword = signal<string>('');

  hasError = computed(() => {
    const np = this.newPassword();
    const cp = this.confirmPassword();

    return np !== cp || np.length < 3;
  });

  changePassword() {
    this.authService.changePassword(this.currentPassword(), this.newPassword()).subscribe({
      next: () => {
        this.toastr.success('Password changed successfully');
        this.modalService.close();
      },
      error: () => {
        this.toastr.error('Failed to change password');
      },
    });
  }

  show() {
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.modalService.open('Change Password', this.modalBody(), this.modalFooter());
  }
}
