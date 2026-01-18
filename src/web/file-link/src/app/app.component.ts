import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from '@rd-ui';
import { MainNavBarComponent } from './_components/main-nav-bar/main-nav-bar.component';

import { ModalComponent } from './_components/common/modal/modal.component';
import { AuthService } from './_services/auth/auth.service';
import { TokenUser } from './_services/auth/token-user';
import { SignalRService } from './_services/signalr.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MainNavBarComponent, ToastComponent, ModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'file-link';
  authService = inject(AuthService);

  srService = inject(SignalRService);
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
        if (x?.role === 'Owner' || x?.role === 'Editor') {
          this.startSignalR();
        }
      });
  }
  startSignalR() {
    this.srService.startConnection().subscribe();
  }
  endSignalR() {
    this.srService.stopConnection();
  }
}
