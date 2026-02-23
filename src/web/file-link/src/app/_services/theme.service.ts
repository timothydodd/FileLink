import { Injectable, signal, computed, effect } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme-preference';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  preference = signal<ThemePreference>(this.loadPreference());

  resolvedTheme = computed<'light' | 'dark'>(() => {
    const pref = this.preference();
    if (pref === 'system') {
      return this.systemDark() ? 'dark' : 'light';
    }
    return pref;
  });

  private systemDark = signal(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  constructor() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', (e) => this.systemDark.set(e.matches));

    effect(() => {
      const theme = this.resolvedTheme();
      document.documentElement.setAttribute('data-theme', theme);
    });
  }

  toggleTheme(): void {
    const current = this.resolvedTheme();
    const next = current === 'light' ? 'dark' : 'light';
    this.preference.set(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  private loadPreference(): ThemePreference {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }
}
