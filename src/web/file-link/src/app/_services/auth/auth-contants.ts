export class AuthConstants {
  static readonly AUTH_REFRESH_URL = '/api/auth/refresh';
}

export class AuthClaims {
  static readonly USER_ID = 'https://filelink.com/app_user_id';
  static readonly GROUP_ID = 'https://filelink.com/group_id';
  static readonly SCOPE = 'https://filelink.com/scope';
  static readonly ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
}
