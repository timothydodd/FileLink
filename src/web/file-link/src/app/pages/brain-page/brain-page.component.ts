import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { catchError, of, switchMap, take } from 'rxjs';
import { SpinnerComponent } from '../../_components/common/spinner/spinner.component';
import { AuthService } from '../../_services/auth/auth.service';
import { RouterHelperService } from '../../_services/route-helper';

@Component({
  selector: 'app-brain-page',
  standalone: true,
  imports: [SpinnerComponent],
  template: `<app-spinner></app-spinner>`,
  styleUrl: './brain-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrainPageComponent implements OnInit {
  authService = inject(AuthService);
  router = inject(RouterHelperService);

  ngOnInit(): void {
    try {
      this.authService
        .getTokenSilently$()
        .pipe(
          switchMap(() => {
            return this.authService.isAuthenticated$;
          }),
          switchMap((z) => {
            if (z) {
              return this.authService.getUser();
            } else {
              return of(null);
            }
          }),
          catchError(() => {
            console.error('Error fetching user data');
            return of(null);
          }),
          take(1)
        )
        .subscribe({
          next: (x) => {
            if (x) {
              if (x.groupId) {
                this.router.goView(x.groupId);
              } else {
                this.router.goCreate();
              }
            } else {
              this.router.goLogin();
            }
          },
          error: (e) => {
            console.error('Error during authentication', e);
            this.router.goLogin();
          },
        });
    } catch (e) {
      console.error('Error during authentication', e);
      this.router.goLogin();
    }
  }
}
