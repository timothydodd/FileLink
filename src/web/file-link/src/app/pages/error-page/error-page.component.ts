import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { take } from 'rxjs';
import { AuthService } from '../../_services/auth/auth.service';
import { HealthCheckService } from '../../_services/health-check.service';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="main-wrap">
      <div class="error-message l-window">
        <div class="error-icon">
          <lucide-angular name="alert-triangle" [size]="48"></lucide-angular>
        </div>

        <ng-container>
          @switch (this.errorCode()) {
            @case (this.errorCodes.UserLogin) {
              <h3>Login Issue</h3>
              <p>We couldn't sign you in. Please check your credentials and try again.</p>
            }
            @case (this.errorCodes.UserBlocked) {
              <h3>Account Inactive</h3>
              <p>Your account is currently inactive. Please contact the administrator for assistance.</p>
            }
            @case (this.errorCodes.Timeout) {
              <h3>Connection Timed Out</h3>
              <p>The server took too long to respond. Please check your internet connection and try again.</p>
            }
            @case (this.errorCodes.UserAccess) {
              <h3>Access Denied</h3>
              <p>You don't have permission to view this page. Please request access from the link owner.</p>
            }
            @default {
              <h3>Something Went Wrong</h3>
              <p>An unexpected error occurred. Please try again or contact support if the issue persists.</p>
            }
          }
        </ng-container>
        @if (showHealthCheck) {
          <div class="status-box">
            <h4>Connection Status</h4>
            <div class="split">
              <div>FileLink Servers</div>
              @if (this.healthData()) {
                @if (isHealthy()) {
                  <lucide-angular name="check-circle" [size]="20" class="status-healthy"></lucide-angular>
                } @else {
                  <lucide-angular name="x-circle" [size]="20" class="status-unhealthy"></lucide-angular>
                }
              } @else {
                <div class="spinner-loader"></div>
              }
            </div>
          </div>
        }
        @if (showLogin) {
          <button class="btn btn-primary" (click)="btnReLogin()">Start Over</button>
        }
      </div>
    </div>
  `,
  styleUrl: './error-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPageComponent implements OnInit {
  authService = inject(AuthService);

  showGoHome: boolean = false;
  showLogin: boolean = true;
  errorCode = signal<string>('');
  showHealthCheck = true;
  healthData = signal<HealthCheck | null>(null);
  errorCodes = ErrorCodes;
  isHealthy = computed(() => {
    const hc = this.healthData();
    return hc?.status === 'Healthy';
  });

  public sanitizer = inject(DomSanitizer);
  private healthCheckService = inject(HealthCheckService);
  private activeRoute = inject(ActivatedRoute);

  ngOnInit(): void {
    this.activeRoute.params.pipe(take(1)).subscribe((z) => {
      this.errorCode.set(z['errorCode']);
    });

    this.healthCheckService.getfilelink().subscribe(
      (z) => {
        if (!z) z = { status: 'Unhealthy' };
        this.healthData.set(z);
      },
      () => {
        const z = { status: 'Unhealthy' };
        this.healthData.set(z);
      }
    );
  }
  btnReLogin() {
    this.authService.logout();
  }
}
export class ErrorCodes {
  public static UserLogin = 'user-login';
  public static UserBlocked = 'user-blocked';
  public static UserAccess = 'user-access';
  public static Unknown = '500';
  public static Timeout = '408';
}
export class HealthCheck {
  status: string = '';
}
