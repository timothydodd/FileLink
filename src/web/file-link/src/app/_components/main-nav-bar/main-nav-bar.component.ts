import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, TemplateRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../_services/auth/auth.service';
import { TokenUser } from '../../_services/auth/token-user';
import { RouterHelperService } from '../../_services/route-helper';
import { ToolbarService } from '../../_services/toolbar.service';
import { LogoComponent } from '../logo/logo.component';
import { MainMenuComponent } from '../main-menu/main-menu.component';

@Component({
  selector: 'app-main-nav',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, LogoComponent, RouterModule, MainMenuComponent],
  template: `
    <app-logo></app-logo>
    @if (templateRef()) {
      <div class="toolbar">
        <ng-container *ngTemplateOutlet="templateRef()"></ng-container>
      </div>
    }
    @if (user() !== null) {
      <app-main-menu></app-main-menu>
    }
  `,
  styleUrl: './main-nav-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainNavBarComponent {
  authService = inject(AuthService);
  router = inject(RouterHelperService);
  user = signal<TokenUser | null>(null);
  toolbarService = inject(ToolbarService);
  templateRef = signal<TemplateRef<any> | null>(null);

  constructor() {
    this.authService
      .getUser()
      .pipe(takeUntilDestroyed())
      .subscribe((x) => {
        this.user.set(x);
      });

    this.toolbarService.toolbarContent$.pipe(takeUntilDestroyed()).subscribe((content) => {
      this.templateRef.set(content);
    });
  }
}
