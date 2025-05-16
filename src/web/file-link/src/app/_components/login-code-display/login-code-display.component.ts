import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { combineLatest, take } from 'rxjs';
import { AuthService } from '../../_services/auth/auth.service';
import { JwtAuthProvider } from '../../_services/auth/providers/jwt-auth-provider.service';
import { ToastService } from '../../_services/toast.service';
import { AuthLinkService } from '../../_services/web-api/auth-link.service';

@Component({
  selector: 'app-login-code-display',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    @if (loginUrl()) {
      <div class="flex-row gap10">
        <div class="code-display">
          <a [href]="loginUrl()">{{ loginUrl() }} </a>
        </div>
        <button class="btn btn-word" title="Copy" (click)="copyLink()">
          <lucide-angular name="copy" size="16"></lucide-angular>
        </button>
      </div>
    }
  `,
  styleUrl: './login-code-display.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginCodeDisplayComponent implements OnInit {
  jwtAuthProvider = inject(JwtAuthProvider);
  authLinkService = inject(AuthLinkService);
  toastr = inject(ToastService);
  authService = inject(AuthService);
  loginUrl = signal<string | null>(null);
  ngOnInit(): void {
    combineLatest([this.authService.getUser(), this.authLinkService.getMyCode()])
      .pipe(take(1))
      .subscribe((z) => {
        const code = z[1];
        this.loginUrl.set(`${window.location.origin}/l/${code.code}`);
      });
  }

  copyLink() {
    var link = this.loginUrl();
    if (!link) {
      console.error('No link to copy');
      return;
    }
    navigator.clipboard
      .writeText(link)
      .then(() => {
        this.toastr.success('Link copied to clipboard');
      })
      .catch((err) => {
        console.error('Failed to copy link: ', err);
      });
  }
}
