import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from '../../_services/auth/auth.service';
import { HealthCheckService } from '../../_services/health-check.service';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="main-wrap">
      <div class="error-message l-window">
        <div class="l-header">hi</div>

        <ng-container>
          @switch (this.errorCode()) {
            @case (this.errorCodes.UserLogin) {
              <h3>Login Issue</h3>
              <p>There was an issue logging into your document.</p>
            }
            @case (this.errorCodes.UserBlocked) {
              <h3>Inactive Document</h3>
              <p>Your document is currently inactive.</p>
            }
            @case (this.errorCodes.Timeout) {
              <h3>Connection Issue</h3>
              <p>Please check your internet connection and try again.</p>
            }
            @case (this.errorCodes.UserAccess) {
              <h3>Access Denied</h3>
              <p>Your document doesn't have the proper permissions to view this site.</p>
            }
            @default {
              <h3>Unknown Issue</h3>
              <p>An Unknown error has occured. Please try again.</p>
            }
          }
        </ng-container>
        @if (showHealthCheck) {
          <div class="status-box">
            <h4>Connection Status</h4>
            <div class="split" style>
              <div>ViewFi App Servers</div>
              @if (this.healthData()) {
                @if (isHealthy()) {
                  <i class="fas fa-check-circle"></i>
                }
                @if (!isHealthy) {
                  <i class="fas fa-times-hexagon"></i>
                }
              }
              @if (!this.healthData) {
                <i>
                  <div class="spinner-loader"></div>
                </i>
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
