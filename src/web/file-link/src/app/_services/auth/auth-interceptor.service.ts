/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpEvent, HttpHandler, HttpHeaders, HttpInterceptor, HttpParams, HttpRequest } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";

import { Observable, from, iif, of, throwError } from 'rxjs';
import { catchError, concatMap, first, map, switchMap } from 'rxjs/operators';
import { AuthService } from "./auth.service";
import { TokenInfo } from "./providers/auth0-provider";
import { ApiRouteDefinition, AuthConfigService, HttpInterceptorConfig, JwtAuthConfig, SilentTokenOptions, isHttpInterceptorRouteConfig } from "./providers/jwt-auth-provider.config";

@Injectable()
export class AuthInterceptorService implements HttpInterceptor {
    constructor(private auth: AuthService, @Inject(AuthConfigService) private config: JwtAuthConfig) { }

    intercept(
        req: HttpRequest<any>,
        next: HttpHandler
    ): Observable<HttpEvent<any>> {

        if (!this.config.httpInterceptor?.allowedList) {
            return next.handle(req);
        }

        let customParams: InterceptorHttpParams | null = null;

        if (req.params && req.params instanceof InterceptorHttpParams) {
            customParams = req.params as InterceptorHttpParams;
        }
        if (customParams?.interceptorConfig?.noToken === true)
            return next.handle(req);

        return this.findMatchingRoute(req, this.config.httpInterceptor).pipe(
            concatMap((route) =>
                iif(
                    // Check if a route was matched
                    () => route !== null,
                    // If we have a matching route, call getTokenSilently and attach the token to the
                    // outgoing request
                    of(route).pipe(
                        map((z: any) => { return z?.tokenOptions as SilentTokenOptions }),
                        concatMap<SilentTokenOptions, Observable<TokenInfo | null>>(
                            (options) => {
                                return this.auth.isAuthenticated$.pipe(switchMap(x => {
                                    if (x) {
                                        return this.auth.getTokenSilently$(options);
                                    }
                                    return of(null);
                                }))
                            }
                        ),
                        switchMap((token: TokenInfo| null) => {
                            if (!token?.token) {
                                return throwError(() => new Error('No token found') as any);
                            }

                            let headers = new HttpHeaders();

                            headers = headers.append('Authorization', `Bearer ${token.token}`);

                            headers = headers.append('x-auth-type', token.authType);
                            const tokenReq = req.clone({
                                headers,
                            });
                            return next.handle(tokenReq).pipe(
                                catchError((err) => {
                                    if (err.status === 401) {
                                        // auto logout if 401 response returned from api
                                        this.auth.logout().subscribe();
                                        // location.reload(true);
                                    }

                                    let error = '';
                                    if (err) {
                                        if (err.message) {
                                            error = err.message;
                                        }
                                        else if (err.error && err.error.message) {
                                            error = err.error.message || err.statusText;
                                        }

                                    }
                                    return throwError(() => new Error(error));
                                })
                            );
                        })
                    ),
                    // If the URI being called was not found in our httpInterceptor config, simply
                    // pass the request through without attaching a token
                    next.handle(req)
                )
            ),
        );

    }

    /**
   * Strips the query and fragment from the given uri
   * @param uri The uri to remove the query and fragment from
   */
    private stripQueryFrom(uri: string): string {
        if (uri.indexOf('?') > -1) {
            uri = uri.substring(0, uri.indexOf('?'));
        }

        if (uri.indexOf('#') > -1) {
            uri = uri.substring(0, uri.indexOf('#'));
        }

        return uri;
    }


    /**
     * Determines whether the specified route can have an access token attached to it, based on matching the HTTP request against
     * the interceptor route configuration.
     * @param route The route to test
     * @param request The HTTP request
     */
    private canAttachToken(
        route: ApiRouteDefinition,
        request: HttpRequest<any>
    ): boolean {
        const testPrimitive = (value: string | undefined): boolean => {
            if (!value) {
                return false;
            }

            const requestPath = this.stripQueryFrom(request.url);

            if (value === requestPath) {
                return true;
            }
            request.headers.get(":path")
            // If the URL ends with an asterisk, match using startsWith.
            return (
                value.indexOf('*') === value.length - 1 &&
                new URL(request.url).pathname.startsWith(value.substr(0, value.length - 1))
            );
        };

        if (isHttpInterceptorRouteConfig(route)) {
            if (route.httpMethod && route.httpMethod !== request.method) {
                return false;
            }

            if (!route.uri && !route.uriMatcher) {
                console.warn(
                    'Either a uri or uriMatcher is required when configuring the HTTP interceptor.'
                );
            }

            return route.uriMatcher
                ? route.uriMatcher(request.url)
                : testPrimitive(route.uri);
        }

        return testPrimitive(route);
    }

    /**
   * Tries to match a route from the auth configuration to the HTTP request.
   * If a match is found, the route configuration is returned.
   * @param request The Http request
   * @param config HttpInterceptorConfig
   */
    private findMatchingRoute(
        request: HttpRequest<any>,
        config: HttpInterceptorConfig
    ): Observable<ApiRouteDefinition | null> {
        return from(config.allowedList).pipe(
            first((route) => this.canAttachToken(route, request), null)
        );
    }
}
export class InterceptorHttpParams extends HttpParams {
    constructor(
        public interceptorConfig: { noToken: boolean },
        params?: { [param: string]: string | string[] }
    ) {
        super({ fromObject: params });
    }
}
