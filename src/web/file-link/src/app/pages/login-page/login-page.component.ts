import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LogoComponent } from '../../_components/logo/logo.component';
import { AuthService } from '../../_services/auth/auth.service';
import { RouterHelperService } from '../../_services/route-helper';
import { AuthLinkService } from '../../_services/web-api/auth-link.service';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, FormsModule, LogoComponent],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <app-logo></app-logo>
        </div>
        <form (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              [(ngModel)]="username"
              required
              class="form-control"
              placeholder="Enter your username"
              [disabled]="loading()"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              [(ngModel)]="password"
              required
              class="form-control"
              placeholder="Enter your password"
              [disabled]="loading()"
            />
          </div>

          <div class="form-actions">
            <button type="submit" class="login-button" [disabled]="loading()">
              @if (loading()) {
                <span class="btn-spinner"></span>
                Signing in...
              } @else {
                Log In
              }
            </button>
          </div>
          @if (error()) {
            <div class="error-container">
              <p class="error-message">{{ error() }}</p>
            </div>
          }
        </form>
      </div>
    </div>
  `,
  styleUrl: './login-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  authService = inject(AuthService);
  authLinkService = inject(AuthLinkService);
  password: string = '';
  username: string = '';
  router = inject(RouterHelperService);
  error = signal<string | null>(null);
  loading = signal(false);
  constructor() {
    this.authService
      .getUser()
      .pipe(takeUntilDestroyed())
      .subscribe((x) => {
        if (x) {
          this.router.goHome();
        }
      });
  }
  onSubmit() {
    if (this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    this.authLinkService.loginAdmin(this.username, this.password).subscribe({
      next: (x) => {
        if (x.token) this.authService.setToken(x.token, x.refreshToken, x.expiresIn);
        this.loading.set(false);
      },
      error: (_err) => {
        this.error.set('Invalid username or password. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
