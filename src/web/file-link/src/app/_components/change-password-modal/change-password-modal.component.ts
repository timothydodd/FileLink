import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, minLength, required, validate } from '@angular/forms/signals';
import { ModalComponent, ModalLayoutComponent, ToastService } from '@rd-ui';
import { AuthLinkService } from '../../_services/web-api/auth-link.service';

@Component({
  standalone: true,
  selector: 'app-change-password-modal',
  imports: [CommonModule, FormField, ModalLayoutComponent],
  template: `
    <rd-modal-layout [title]="'Change Password'">
      <div slot="body">
        <div class="form-group">
          <label for="currentPassword">Current Password</label>
          <input type="password" id="currentPassword" [formField]="pwForm.currentPassword" />
        </div>
        <div class="form-group">
          <label for="newPassword">New Password</label>
          <input type="password" id="newPassword" [formField]="pwForm.newPassword" />
          @if (pwForm.newPassword().value().length > 0 && pwForm.newPassword().invalid()) {
            <div class="field-error">Password must be at least 8 characters</div>
          }
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm New Password</label>
          <input type="password" id="confirmPassword" [formField]="pwForm.confirmPassword" />
          @if (pwForm.confirmPassword().value().length > 0 && pwForm.confirmPassword().invalid()) {
            <div class="field-error">Passwords do not match</div>
          }
        </div>
      </div>
      <div slot="footer">
        <div class="button-group">
          <button class="btn btn-primary" (click)="changePassword()" [disabled]="pwForm().invalid()">
            Change Password
          </button>
        </div>
      </div>
    </rd-modal-layout>
  `,
  styleUrl: './change-password-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordModalComponent {
  private modalComponent = inject(ModalComponent);
  toastr = inject(ToastService);
  authService = inject(AuthLinkService);

  pwModel = signal({ currentPassword: '', newPassword: '', confirmPassword: '' });
  pwForm = form(this.pwModel, (p) => {
    required(p.currentPassword);
    required(p.newPassword);
    minLength(p.newPassword, 8);
    validate(p.confirmPassword, (ctx) =>
      ctx.value() === ctx.valueOf(p.newPassword)
        ? null
        : { kind: 'passwordMismatch', message: 'Passwords do not match' }
    );
  });

  changePassword() {
    if (this.pwForm().invalid()) return;
    const { currentPassword, newPassword } = this.pwModel();
    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.toastr.success('Password changed successfully');
        this.modalComponent.close();
      },
      error: () => {
        this.toastr.error('Failed to change password');
      },
    });
  }
}
