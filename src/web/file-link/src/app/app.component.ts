import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { MainNavBarComponent } from './_components/main-nav-bar/main-nav-bar.component';
import { ModalComponent } from './_components/modal/modal.component';
import { ToastComponent } from './_components/toast/toast.component';
import { AuthService } from './_services/auth/auth.service';
import { TokenUser } from './_services/auth/token-user';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MainNavBarComponent, ToastComponent, ModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'file-link';
  authService = inject(AuthService);

  user = signal<TokenUser | null>(null);
  isLoggedIn = computed(() => {
    return this.user() !== null;
  });
  constructor() {
    this.authService
      .getUser()
      .pipe(takeUntilDestroyed())
      .subscribe((x) => {
        this.user.set(x);
      });
  }
}
