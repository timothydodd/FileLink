import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SpinnerComponent } from '@rd-ui';
import { JwtAuthProvider } from '../../_services/auth/providers/jwt-auth-provider.service';
import { RouterHelperService } from '../../_services/route-helper';
import {
  AuthLinkService,
  LoginPasswordRequiredResponse,
  LoginResponse,
} from '../../_services/web-api/auth-link.service';
import { LogoComponent } from '../../_components/logo/logo.component';

@Component({
  imports: [SpinnerComponent, FormsModule, LogoComponent],
  template: `
    @if (showPasswordPrompt()) {
      <div class="login-container">
        <div class="login-card">
          <div class="login-header">
            <app-logo></app-logo>
          </div>
          <form (ngSubmit)="submitPassword()" class="login-form">
            <div class="form-group">
              <label for="password">This link is password protected</label>
              <input
                type="password"
                id="password"
                name="password"
                [(ngModel)]="password"
                required
                class="form-control"
                placeholder="Enter password"
                autofocus
              />
            </div>
            <div class="form-actions">
              <button type="submit" class="login-button">Continue</button>
            </div>
            @if (error()) {
              <div class="error-container">
                <p class="error-message">{{ error() }}</p>
              </div>
            }
          </form>
        </div>
      </div>
    } @else {
      <rd-spinner></rd-spinner>
    }
  `,
  styleUrl: './link-route-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkRoutePageComponent {
  activatedRoute = inject(ActivatedRoute);
  authLoginService = inject(AuthLinkService);
  jwtAuthProvider = inject(JwtAuthProvider);
  router = inject(RouterHelperService);

  showPasswordPrompt = signal(false);
  error = signal<string | null>(null);
  password = '';
  private code = '';

  constructor() {
    this.jwtAuthProvider.clearCache();
    this.activatedRoute.params.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (params['code']) {
        this.code = params['code'];
        this.attemptLogin();
      }
    });
  }

  attemptLogin(password?: string) {
    this.authLoginService.login(this.code, password).subscribe({
      next: (z: any) => {
        if (z && 'passwordRequired' in z && z.passwordRequired) {
          this.showPasswordPrompt.set(true);
          return;
        }
        if (z && 'token' in z) {
          const loginResponse = z as LoginResponse;
          const user = this.jwtAuthProvider.setupToken(
            loginResponse.token,
            loginResponse.refreshToken,
            loginResponse.expiresIn
          );
          if (user?.groupId) {
            this.router.goView(user.groupId);
          } else if (user) {
            this.router.goCreate();
          } else {
            this.router.goLogin();
          }
        }
      },
      error: () => {
        if (password) {
          this.error.set('Invalid password');
        } else {
          this.router.goLogin();
        }
      },
    });
  }

  submitPassword() {
    this.error.set(null);
    this.attemptLogin(this.password);
  }
}
