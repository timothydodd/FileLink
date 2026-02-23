import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { filter } from 'rxjs';

interface Crumb {
  label: string;
  url?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  template: `
    @if (crumbs().length) {
      <nav class="breadcrumb">
        <a routerLink="/" class="breadcrumb-home">
          <lucide-icon name="home" [size]="14" />
        </a>
        @for (crumb of crumbs(); track crumb.label) {
          <lucide-icon name="chevron-right" [size]="14" class="breadcrumb-sep" />
          @if (crumb.url) {
            <a [routerLink]="crumb.url" class="breadcrumb-link">{{ crumb.label }}</a>
          } @else {
            <span class="breadcrumb-current">{{ crumb.label }}</span>
          }
        }
      </nav>
    }
  `,
  styles: `
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 40px;
      font-size: 13px;
    }
    .breadcrumb-home {
      display: flex;
      align-items: center;
      color: var(--text-muted);
      transition: color 0.15s;
    }
    .breadcrumb-home:hover {
      color: var(--primary);
    }
    .breadcrumb-sep {
      color: var(--text-muted);
    }
    .breadcrumb-link {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s;
    }
    .breadcrumb-link:hover {
      color: var(--primary);
    }
    .breadcrumb-current {
      color: var(--text-primary);
    }
    @media (max-width: 768px) {
      .breadcrumb {
        padding: 8px 16px;
      }
    }
  `,
})
export class BreadcrumbComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  crumbs = signal<Crumb[]>([]);

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.buildCrumbs());
    // Build on init for the current route
    this.buildCrumbs();
  }

  private buildCrumbs() {
    const child = this.route.firstChild;
    if (!child) {
      this.crumbs.set([]);
      return;
    }
    const data = child.snapshot.data;
    if (!data['breadcrumb']) {
      this.crumbs.set([]);
      return;
    }

    const result: Crumb[] = [];

    if (data['parent']) {
      result.push({ label: data['parent'].label, url: data['parent'].url });
    }

    let label: string = data['breadcrumb'];
    if (label.startsWith(':')) {
      const paramName = label.substring(1);
      const paramValue = child.snapshot.params[paramName] || '';
      label = paramValue.substring(0, 8);
    }
    result.push({ label });

    this.crumbs.set(result);
  }
}
