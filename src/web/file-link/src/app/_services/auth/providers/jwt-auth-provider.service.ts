import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from, map, of, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { JwtUrlParser } from '../_helpers/jwt-url-parser';
import { createQueryParams } from '../_helpers/util';
import { AuthCacheManager } from '../cache/auth-cache-manager';
import { CacheKey, IAuthCache, InMemoryCache, LocalStorageCache } from '../cache/auth-cache.localstorage';
import { TokenUser } from '../token-user';
import { TokenInfo } from './auth0-provider';
import { AuthConfigService, JwtAuthConfig, SilentTokenOptions } from './jwt-auth-provider.config';

import { Constants } from '../../../_helpers/constants';
import { UserPreferenceService } from '../../user-prefrences.service';

type CacheLocation = 'memory' | 'localstorage';

@Injectable({ providedIn: 'root' })
export class JwtAuthProvider {
  private readonly _cacheManager: AuthCacheManager;
  private _cacheLocation: CacheLocation;

  _memoryCache: IAuthCache | null = null;
  _localStorageCache: IAuthCache | null = null;
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

  userPref = inject(UserPreferenceService);
  constructor(
    private jwtUrlParser: JwtUrlParser,
    private router: Router,
    private http: HttpClient,
    @Inject(AuthConfigService) private options?: JwtAuthConfig
  ) {
    this._token = null;
    this._cacheLocation = options?.useLocalStorage ? 'localstorage' : 'memory';
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

  setupToken(token: string) {
    if (token) {
      const t = this.jwtUrlParser.parse(token);

      if (t) {
        this.set(token, null, null, null);
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
    const clientId = environment.auth.clientId;
    const audience = environment.auth.audience;
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
        this._token = accessToken;
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
      const scopeClaim = t['https://filelink.com/scope'];
      if (scopeClaim) {
        scope = JSON.parse(scopeClaim);
      }
      const user = {
        externalAuthId: null,
        appUserId: t['https://filelink.com/app_user_id'],
        email: t['email'],
        name: t['name'],
        avatarUrl: null,
        scope,
        groupId: t['https://filelink.com/group_id'],
        role: t['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
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
    if (!this.options?.clientId) throw new Error('Missing client id');
    if (!this.options.audience) throw new Error('Missing audience');

    this._cacheManager.set({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn ? expiresIn : 1000000,
      client_id: this.options.clientId,
      scope: this.options.scope ?? null,
      audience: this.options.audience,
      oauthTokenScope: scope,
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

  _getTokenSilently(options: SilentTokenOptions): Observable<string> {
    if (!this.options?.clientId) throw new Error('Missing client id');

    if (!this.options.audience) throw new Error('Missing audience');

    const entry = this._getEntryFromCache({
      scope: options?.scope,
      audience: this.options.audience,
      client_id: this.options.clientId,
    });

    if (entry) {
      return of(entry);
    }

    const authResult = this._getTokenUsingRefreshToken(options).pipe(
      tap((t) => {
        this.set(t.access_token, t.refresh_token, t.expires_in, t.scope);
      }),
      map((t) => t.access_token)
    );

    return authResult;
  }

  _getTokenUsingRefreshToken(options: SilentTokenOptions) {
    if (!this.options?.clientId) throw new Error('Missing client id');

    if (!this.options.audience) throw new Error('Missing audience');

    const cache = this._cacheManager.get(
      new CacheKey({
        audience: this.options.audience,
        client_id: this.options.clientId,
      })
    );

    // If you don't have a refresh token in memory throw error
    if (!cache) {
      throw new Error(`Missing Refresh Token (audience: ${this.options.audience})`);
    }

    const { audience } = this.options;

    const body = createQueryParams({
      audience,
      client_id: this.options.clientId,
      grant_type: 'refresh_token',
      refresh_token: cache && cache.refresh_token,
    });

    const tokenResponse: Observable<AuthTokenEndpointResponse> = this.http.post<AuthTokenEndpointResponse>(
      `${environment.apiUrl}/oauth/token`,
      body,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
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
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  scope: string | null;
};
export interface IJwtInfo {
  [key: string]: string;
}
