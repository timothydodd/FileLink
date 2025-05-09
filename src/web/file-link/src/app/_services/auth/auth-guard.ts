import { inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlSegment, UrlTree } from '@angular/router';
import { catchError, Observable, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard {
  private router = inject(Router);
  private authService = inject(AuthService);

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean {
    const x = this.authService.isAuthenticated$.pipe(
      switchMap((z) => {
        const invalidUrl = this.router.createUrlTree([`/login`]);

        const groupId = next.params['groupId'];
        const readerRoute = this.router.createUrlTree(['view/' + groupId]);
        if (z) {
          let roles = next.data['roles'] as Array<string>;
          if (roles && roles.length > 0) {
            return this.authService.getUser().pipe(
              switchMap((u) => {
                if (u) {
                  if (u.role) {
                    if (roles.includes(u.role)) {
                      return this.allowed(next, invalidUrl);
                    } else if (u.role === 'Reader') {
                      return of(readerRoute);
                    }
                  }
                }
                return of(invalidUrl);
              })
            );
          }
          return this.allowed(next, invalidUrl);
        } else {
          const clientId = environment.auth.clientId;
          const audience = environment.auth.audience;
          return this.authService
            .getTokenSilently$(
              {
                clientId: clientId,
                audience: audience,
              },
              state.url
            )
            .pipe(switchMap(() => this.allowed(next, invalidUrl)));
        }
      }),
      catchError(() => {
        const invalidUrl = this.router.createUrlTree([`/login`]);
        return of(invalidUrl);
      })
    );
    return x;
  }
  private allowed(route: ActivatedRouteSnapshot, invalidUrl: UrlTree): Observable<boolean | UrlTree> {
    return this.authService.getUser().pipe(
      switchMap((u) => {
        if (u) {
          if (u.scope) {
            const segments: UrlSegment[] = route.url;
            const scope = segments[0].path.toLowerCase();
            if (u.scope.indexOf(scope) >= 0) {
              return of(true);
            } else {
              return of(invalidUrl);
            }
          }
          return of(true);
        }
        return of(invalidUrl);
      })
    );
  }
}
