import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent, ModalLayoutComponent, ToastService } from '@rd-ui';
import { AuthLinkService } from '../../_services/web-api/auth-link.service';

@Component({
  standalone: true,
  selector: 'app-change-password-modal',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalLayoutComponent],
  template: `
    <rd-modal-layout [title]="'Change Password'">
      <div slot="body">
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
          @if (newPassword().length > 0 && newPassword().length < 8) {
            <div class="field-error">Password must be at least 8 characters</div>
          }
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm New Password</label>
          <input
            type="password"
            id="confirmPassword"
            [ngModel]="confirmPassword()"
            (ngModelChange)="confirmPassword.set($event)"
          />
          @if (confirmPassword().length > 0 && newPassword() !== confirmPassword()) {
            <div class="field-error">Passwords do not match</div>
          }
        </div>
      </div>
      <div slot="footer">
        <div class="button-group">
          <button class="btn btn-primary" (click)="changePassword()" [disabled]="hasError()">Change Password</button>
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

  currentPassword = signal<string>('');
  newPassword = signal<string>('');
  confirmPassword = signal<string>('');

  hasError = computed(() => {
    const np = this.newPassword();
    const cp = this.confirmPassword();

    return np !== cp || np.length < 8;
  });

  changePassword() {
    this.authService.changePassword(this.currentPassword(), this.newPassword()).subscribe({
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
