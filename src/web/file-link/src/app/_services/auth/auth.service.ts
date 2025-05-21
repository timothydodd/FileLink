import { EventEmitter, Injectable, inject } from '@angular/core';
import { Observable, filter, map, take } from 'rxjs';
import { TokenInfo } from './providers/auth0-provider';
import { JwtAuthProvider } from './providers/jwt-auth-provider.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  public logOutEvent = new EventEmitter<boolean>();

  private jwtAuthProvider = inject(JwtAuthProvider);
  get isAuthenticated$(): Observable<boolean> {
    return this.jwtAuthProvider.isAuthenticated$;
  }

  getTokenSilently$(options?: any): Observable<TokenInfo | null> {
    return this.jwtAuthProvider.getTokenSilently$(options);
  }
  setToken(token: string, refreshToken: string, expiresIn: number) {
    return this.jwtAuthProvider.setupToken(token, refreshToken, expiresIn);
  }
  logout(redirect: string = '/') {
    this.logOutEvent.emit(true);
    return this.jwtAuthProvider.logout(redirect);
  }

  getUser() {
    return this.jwtAuthProvider.getTokenUser();
  }
  getUserOnce() {
    return this.jwtAuthProvider.getTokenUser().pipe(
      filter((x) => !!x),
      take(1),
      map((x) => x!)
    );
  }
}
