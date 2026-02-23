import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class RouterHelperService {
  router = inject(Router);

  goHome() {
    this.router.navigate(['/']);
  }
  goLogin() {
    this.router.navigate(['/login']);
  }
  goCreate() {
    this.router.navigate(['/create']);
  }
  goView(groupId: string) {
    this.router.navigate([`/view/${groupId}`]);
  }
  goLinks() {
    this.router.navigate(['/links']);
  }
  goStorage() {
    this.router.navigate(['/storage']);
  }
  goAuditLog() {
    this.router.navigate(['/audit-log']);
  }
}
