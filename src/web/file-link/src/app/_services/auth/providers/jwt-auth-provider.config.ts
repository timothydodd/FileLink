/**
 * Defines a common set of HTTP methods.
 */
export const enum HttpMethod {
  Get = 'GET',
  Post = 'POST',
  Put = 'PUT',
  Patch = 'PATCH',
  Delete = 'DELETE',
  Head = 'HEAD',
}

/**
 * Configuration for a single interceptor route
 */
export interface HttpInterceptorRouteConfig {
  /**
   * The URL to test, by supplying the URL to match.
   * If `test` is a match for the current request path from the HTTP client, then
   * an access token is attached to the request in the
   *  ["Authorization" header](https://tools.ietf.org/html/draft-ietf-oauth-v2-bearer-20#section-2.1).
   *
   * If the test does not pass, the request proceeds without the access token attached.
   *
   * A wildcard character can be used to match only the start of the URL.
   *
   * @usagenotes
   *
   * '/api' - exactly match the route /api
   * '/api/*' - match any route that starts with /api/
   */
  uri?: string;

  /**
   * A function that will be called with the HttpRequest.url value, allowing you to do
   * any kind of flexible matching.
   *
   * If this function returns true, then
   * an access token is attached to the request in the
   *  ["Authorization" header](https://tools.ietf.org/html/draft-ietf-oauth-v2-bearer-20#section-2.1).
   *
   * If it returns false, the request proceeds without the access token attached.
   */
  uriMatcher?: (uri: string) => boolean;

  /**
   * The options that are passed to the SDK when retrieving the
   * access token to attach to the outgoing request.
   */
  tokenOptions?: SilentTokenOptions;

  /**
   * The HTTP method to match on. If specified, the HTTP method of
   * the outgoing request will be checked against this. If there is no match, the
   * Authorization header is not attached.
   *
   * The HTTP method name is case-sensitive.
   */
  httpMethod?: HttpMethod | string;

  /**
   * Allow the HTTP call to be executed anonymously, when no token is available.
   *
   * When omitted (or set to false), calls that match the configuration will fail when no token is available.
   */
  allowAnonymous?: boolean;
}

export interface SilentTokenOptions {
  /**
   * The scope that was used in the authentication request
   */
  scope: string | null;
}

export interface TokenEndpointOptions {
  baseUrl: string;
  client_id: string;
  grant_type: string;
  timeout?: number;

  [key: string]: any;
}

export interface RefreshTokenOptions extends TokenEndpointOptions {
  refresh_token: string;
}

/**
 * Defines the type for a route config entry. Can either be:
 *
 * - an object of type HttpInterceptorRouteConfig
 * - a string
 */
export type ApiRouteDefinition = HttpInterceptorRouteConfig | string;

/**
 * A custom type guard to help identify route definitions that are actually HttpInterceptorRouteConfig types.
 * @param def The route definition type
 */
export function isHttpInterceptorRouteConfig(def: ApiRouteDefinition): def is HttpInterceptorRouteConfig {
  return typeof def !== 'string';
}

/**
 * Configuration for the HttpInterceptor
 */
export interface HttpInterceptorConfig {
  allowedList: ApiRouteDefinition[];
}
