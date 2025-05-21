import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { concatMap, of } from 'rxjs';
import { LogoComponent } from '../../_components/logo/logo.component';
import { JwtAuthProvider } from '../../_services/auth/providers/jwt-auth-provider.service';
import { RouterHelperService } from '../../_services/route-helper';
import { AuthLinkService } from '../../_services/web-api/auth-link.service';

@Component({
  imports: [LogoComponent],
  template: `<app-logo></app-logo>
    <p>-Loading-</p> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkRoutePageComponent {
  activatedRoute = inject(ActivatedRoute);
  authLoginService = inject(AuthLinkService);
  jwtAuthProvider = inject(JwtAuthProvider);
  router = inject(RouterHelperService);

  constructor() {
    localStorage.clear();
    this.activatedRoute.params
      .pipe(
        takeUntilDestroyed(),
        concatMap((x) => {
          if (x['code']) {
            return this.authLoginService.login(x['code']);
          }
          return of(null);
        })
      )
      .subscribe({
        next: (z) => {
          if (z) {
            const user = this.jwtAuthProvider.setupToken(z.token, z.refreshToken, z.expiresIn);

            if (user?.groupId) {
              this.router.goView(user.groupId);
            } else if (user) {
              this.router.goCreate();
            } else {
              this.router.goLogin();
            }
          }
        },
        error: (e) => {
          this.router.goLogin();
        },
      });
  }
}
