import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { InterceptorHttpParams } from '../auth/auth-interceptor.service';
import { ConfigService } from '../config.service';

@Injectable({ providedIn: 'root' })
export class AuthLinkService {
  private configService = inject(ConfigService);
  private http = inject(HttpClient);
  login(code: string, password?: string) {
    const params = new InterceptorHttpParams({ noToken: true });
    const body: any = { code };
    if (password) {
      body.password = password;
    }
    return this.http.post<LoginResponse | LoginPasswordRequiredResponse>(
      `${this.configService.apiUrl}/api/auth/login`,
      body,
      {
        params,
      }
    );
  }
  loginAdmin(userName: string, password: string) {
    const params = new InterceptorHttpParams({ noToken: true });
    return this.http.post<LoginResponse>(
      `${this.configService.apiUrl}/api/auth/admin/login`,
      { userName, password } as LoginAdminRequest,
      {
        params,
      }
    );
  }
  changePassword(currentPassword: string | null | undefined, newPassword: string | null | undefined) {
    return this.http.post(`${this.configService.apiUrl}/api/auth/change-password`, {
      oldPassword: currentPassword,
      newPassword: newPassword,
    } as ChangePasswordRequest);
  }
  getMyCode() {
    return this.http.get<GetCodeResponse>(`${this.configService.apiUrl}/api/auth/code`);
  }
  getShareLink(groupId: string, reroll: boolean = false, hoursValid: number | null = null) {
    let params = new HttpParams().set('reroll', reroll);
    if (hoursValid !== null) {
      params = params.set('hoursValid', hoursValid);
    }
    return this.http.get<LoginRequest>(`${this.configService.apiUrl}/api/auth/group/${groupId}/link`, { params });
  }
  getLinks() {
    return this.http.get<LinkListItem[]>(`${this.configService.apiUrl}/api/auth/links`);
  }
  setLinkPassword(groupId: string, password: string | null) {
    return this.http.post(`${this.configService.apiUrl}/api/auth/group/${groupId}/link/password`, { password });
  }
  updateLinkSettings(groupId: string, settings: { hoursValid?: number; passwordEnabled?: boolean; password?: string | null }) {
    return this.http.post<LoginRequest>(`${this.configService.apiUrl}/api/auth/group/${groupId}/link/settings`, settings);
  }
  bulkDeleteLinks(codes: string[]) {
    return this.http.post(`${this.configService.apiUrl}/api/auth/links/delete`, { codes });
  }
  bulkExpireLinks(codes: string[]) {
    return this.http.post(`${this.configService.apiUrl}/api/auth/links/expire`, { codes });
  }
}
export interface GetCodeResponse {
  code: string;
}
export interface LoginRequest {
  code: string;
  expirationDate: Date | string;
  hasPassword: boolean;
}
export interface LoginPasswordRequiredResponse {
  passwordRequired: boolean;
}
export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}
export interface LoginAdminRequest {
  userName: string;
  password: string;
}
export interface LinkListItem {
  groupId: string;
  code: string;
  expirationDate: Date;
  uses: number | null;
  maxUses: number | null;
  lastAccess: Date | null;
  itemCount: number;
  hasPassword: boolean;
}

export interface ChangePasswordRequest {
  oldPassword: string | null | undefined;
  newPassword: string | null | undefined;
}
