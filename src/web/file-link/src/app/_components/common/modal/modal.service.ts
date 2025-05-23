import { inject, Injectable, TemplateRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  router = inject(Router);
  modalEvent = new Subject<ModalData | null>();

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event: NavigationEnd) => {
        this.close();
      });
  }
  open(
    title: string,
    body?: TemplateRef<any>,
    footer?: TemplateRef<any>,
    size: 'sm' | 'lg' | 'xl' = 'sm',
    customClass?: string
  ) {
    this.modalEvent.next({
      title,
      bodyTemplate: body,
      footerTemplate: footer,
      size,
      customClass,
    });
  }
  close() {
    this.modalEvent.next(null);
  }
}

export interface ModalData {
  title: string;
  bodyTemplate?: TemplateRef<any>;
  footerTemplate?: TemplateRef<any>;
  size?: 'sm' | 'lg' | 'xl';
  customClass?: string;
}
