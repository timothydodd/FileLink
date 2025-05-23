import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from, map, of, share, tap } from 'rxjs';
import { AuthCacheManager } from '../cache/auth-cache-manager';
import { CacheKey, IAuthCache, InMemoryCache, LocalStorageCache } from '../cache/auth-cache.localstorage';
import { TokenUser } from '../token-user';
import { TokenInfo } from './auth0-provider';
import { SilentTokenOptions } from './jwt-auth-provider.config';

import { Constants } from '../../../_helpers/constants';
import { ConfigService } from '../../config.service';
import { UserPreferenceService } from '../../user-prefrences.service';
import { JwtUrlParser } from '../_helpers/jwt-url-parser';
import { AuthClaims, AuthConstants } from '../auth-contants';
import { InterceptorHttpParams } from '../auth-interceptor.service';

type CacheLocation = 'memory' | 'localstorage';

@Injectable({ providedIn: 'root' })
export class JwtAuthProvider {
  private configService = inject(ConfigService);
  userPref = inject(UserPreferenceService);
  private jwtUrlParser = inject(JwtUrlParser);
  private router = inject(Router);
  private http = inject(HttpClient);
  private readonly _cacheManager: AuthCacheManager;
  private _cacheLocation: CacheLocation;

  _memoryCache: IAuthCache | null = null;
  _localStorageCache: IAuthCache | null = null;

  // Add these properties for token refresh management
  private _tokenRefreshInProgress: Observable<string> | null = null;
  private _tokenRefreshPromiseResolver: ((token: string) => void) | null = null;

  private _cacheFactory = (location: string) => {
    if (location === 'memory') {
      if (!this._memoryCache) this._memoryCache = new InMemoryCache().enclosedCache;
      return this._memoryCache;
    }
    if (location === 'localstorage') {
      if (!this._localStorageCache) this._localStorageCache = new LocalStorageCache();
      return this._localStorageCache;
    }
    throw new Error(`Invalid cache location "${location}"`);
  };

  constructor() {
    this._token = null;
    this._cacheLocation = this.configService.useLocalStorage ? 'localstorage' : 'memory';
    var cachePref = this.userPref.get(Constants.UserPrefKeys.authCacheLocation);
    if (cachePref === 'memory' || cachePref === 'localstorage') this._cacheLocation = <CacheLocation>cachePref;
    else this.userPref.set(Constants.UserPrefKeys.authCacheLocation, this._cacheLocation);

    if (!this._cacheFactory(this._cacheLocation)) {
      throw new Error(`Invalid cache location "${this._cacheLocation}"`);
    }

    const cache: IAuthCache = this._cacheFactory(this._cacheLocation);
    this._cacheManager = new AuthCacheManager(cache);
  }

  getLoginCode() {
    return this.getTokenUser().pipe(
      map((z) => {
        if (!z) return null;
        return localStorage.getItem('code_' + z?.groupId);
      })
    );
  }

  setupToken(token: string, refreshToken: string, expiresIn: number) {
    if (token) {
      const t = this.jwtUrlParser.parse(token);

      if (t) {
        this.set(token, refreshToken, expiresIn, null);
        const user = this.parseUser();
        return user;
      }
    }
    return null;
  }

  get isAuthenticated$(): Observable<boolean> {
    if (!this._token) {
      return of(this.tokenInCache());
    }
    return of(true);
  }

  tokenInCache() {
    const clientId = this.configService.clientId;
    const audience = this.configService.audience;
    const entry = this._getEntryFromCache({
      scope: null,
      audience: audience,
      client_id: clientId,
    });

    if (entry) {
      this._token = entry;
      this.ParseToken();
      return true;
    }
    return false;
  }

  _token: string | null = null;
  _tokenDecoded: IJwtInfo | null = null;

  handleRedirectCallback() {
    throw new Error('Method not implemented.');
  }

  getTokenSilently$(options: SilentTokenOptions): Observable<TokenInfo> {
    return this._getTokenSilently(options).pipe(
      map((accessToken) => {
        if (this._token !== accessToken) {
          this._token = accessToken;
          this.ParseToken();
        }

        return {
          token: accessToken,
          authType: 'PJWT',
        };
      })
    );
  }

  clearCache() {
    const mCache: IAuthCache = this._cacheFactory('memory');
    const lCache: IAuthCache = this._cacheFactory('localstorage');
    if (mCache) mCache.clear();
    if (lCache) lCache.clear();

    // Clear token refresh state
    this._tokenRefreshInProgress = null;
    this._tokenRefreshPromiseResolver = null;
  }

  switchToLocalStorage() {
    if (this._cacheLocation === 'localstorage') return;
    const mCache: IAuthCache = this._cacheFactory('memory');
    const lCache: IAuthCache = this._cacheFactory('localstorage');
    if (mCache) {
      lCache.clear();
      const keys = mCache.allKeys();
      keys.forEach((key) => {
        const entry = mCache.get(key);
        if (entry) lCache.set(key, entry);
      });
      mCache.clear();
    }
    this._cacheLocation = 'localstorage';
    this.userPref.set(Constants.UserPrefKeys.authCacheLocation, this._cacheLocation);
  }

  switchToMemoryStorage() {
    if (this._cacheLocation === 'memory') return;
    const mCache: IAuthCache = this._cacheFactory('memory');
    const lCache: IAuthCache = this._cacheFactory('localstorage');
    if (lCache) {
      mCache.clear();
      const keys = lCache.allKeys();
      keys.forEach((key) => {
        const entry = lCache.get(key);
        if (entry) mCache.set(key, entry);
      });
      lCache.clear();
    }
    this._cacheLocation = 'memory';
    this.userPref.set(Constants.UserPrefKeys.authCacheLocation, this._cacheLocation);
  }

  logout(redirect: string) {
    this.clearCache();
    this._token = null;
    this._tokenDecoded = null;
    this.tokenUser.next(null);
    if (!redirect) redirect = '/';
    return from(this.router.navigate([redirect])).pipe(map(() => {}));
  }

  parseUser() {
    if (this._tokenDecoded) {
      const t = this._tokenDecoded;
      let scope = null;
      const scopeClaim = t[AuthClaims.SCOPE];
      if (scopeClaim) {
        scope = JSON.parse(scopeClaim);
      }
      const user = {
        externalAuthId: null,
        appUserId: t[AuthClaims.USER_ID],
        email: t['email'],
        name: t['name'],
        avatarUrl: null,
        scope,
        groupId: t[AuthClaims.GROUP_ID],
        role: t[AuthClaims.ROLE],
      } as TokenUser;
      this.tokenUser.next(user);
      return user;
    }
    return null;
  }

  tokenUser = new BehaviorSubject<TokenUser | null>(null);

  getTokenUser() {
    return this.tokenUser.asObservable();
  }

  set(accessToken: string, refreshToken: string | null, expiresIn: number | null, scope: string | null) {
    if (!this.configService?.clientId) throw new Error('Missing client id');
    if (!this.configService.audience) throw new Error('Missing audience');

    this._cacheManager.set({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn ? expiresIn : 1000000,
      client_id: this.configService.clientId,
      scope: null,
      audience: this.configService.audience,
      oauthTokenScope: scope,
      expired_access_token: null,
    });
    this._token = accessToken;
    this.ParseToken();
  }

  ParseToken() {
    const token = this._token;
    if (token) {
      const t = this.jwtUrlParser.parse(token);
      this._tokenDecoded = <IJwtInfo>t;
      if (t) {
        this._token = token;
        this.parseUser();
        return true;
      }
    }

    this._token = null;
    return false;
  }

  // Modified _getTokenSilently method with proper queuing
  _getTokenSilently(options: SilentTokenOptions): Observable<string> {
    if (!this.configService?.clientId) throw new Error('Missing client id');
    if (!this.configService.audience) throw new Error('Missing audience');

    const entry = this._getEntryFromCache({
      scope: options?.scope,
      audience: this.configService.audience,
      client_id: this.configService.clientId,
    });

    if (entry) {
      return of(entry);
    }

    // If a token refresh is already in progress, return the existing observable
    if (this._tokenRefreshInProgress) {
      return this._tokenRefreshInProgress;
    }

    // Start a new token refresh process
    this._tokenRefreshInProgress = this._getTokenUsingRefreshToken().pipe(
      tap((t) => {
        this.set(t.accessToken, t.refreshToken, t.expiresIn, null);
        // Clear the refresh state after successful refresh
        this._tokenRefreshInProgress = null;
      }),
      map((t) => t.accessToken),
      share() // Share the observable so multiple subscribers get the same result
    );

    return this._tokenRefreshInProgress;
  }

  _getTokenUsingRefreshToken() {
    if (!this.configService?.clientId) throw new Error('Missing client id');
    if (!this.configService.audience) throw new Error('Missing audience');

    const cache = this._cacheManager.get(
      new CacheKey({
        audience: this.configService.audience,
        client_id: this.configService.clientId,
      })
    );

    // If you don't have a refresh token in memory throw error
    if (!cache) {
      throw new Error(`Missing Refresh Token (audience: ${this.configService.audience})`);
    }
    if (!cache.expired_access_token) {
      throw new Error(`Missing Refresh Token (audience: ${this.configService.audience})`);
    }

    const body = {
      expiredAccessToken: cache.expired_access_token, // Use current access token, not expired_access_token
      refreshToken: cache.refresh_token,
    };

    console.info('Refreshing token');
    const params = new InterceptorHttpParams({ noToken: true });
    const tokenResponse: Observable<AuthTokenEndpointResponse> = this.http.post<AuthTokenEndpointResponse>(
      `${this.configService.apiUrl}${AuthConstants.AUTH_REFRESH_URL}`,
      body,
      { params: params }
    );

    return tokenResponse;
  }

  private _getEntryFromCache({ audience, client_id }: { scope: string | null; audience: string; client_id: string }) {
    const entry = this._cacheManager.get(
      new CacheKey({
        audience,
        client_id,
      }),
      60 // get a new token if within 60 seconds of expiring
    );

    if (entry && entry.access_token) {
      return entry.access_token;
    }
    return null;
  }
}

export type AuthTokenEndpointResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
};

export interface IJwtInfo {
  [key: string]: string;
}
