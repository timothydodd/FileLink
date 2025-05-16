import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { of, switchMap, take } from 'rxjs';
import { AuthService } from '../../_services/auth/auth.service';
import { RouterHelperService } from '../../_services/route-helper';

@Component({
  selector: 'app-brain-page',
  standalone: true,
  imports: [],
  template: ``,
  styleUrl: './brain-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrainPageComponent implements OnInit {
  authService = inject(AuthService);
  router = inject(RouterHelperService);

  ngOnInit(): void {
    this.authService.isAuthenticated$
      .pipe(
        switchMap((z) => {
          if (z) {
            return this.authService.getUser();
          } else {
            return of(null);
          }
        }),
        take(1)
      )
      .subscribe((x) => {
        if (x) {
          if (x.groupId) {
            this.router.goView(x.groupId);
          } else {
            this.router.goCreate();
          }
        } else {
          this.router.goLogin();
        }
      });
  }
}
