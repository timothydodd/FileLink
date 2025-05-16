import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { InterceptorHttpParams } from '../auth/auth-interceptor.service';

@Injectable({ providedIn: 'root' })
export class AuthLinkService {
  constructor(private http: HttpClient) {}
  login(code: string) {
    const params = new InterceptorHttpParams({ noToken: true });
    return this.http.post<LoginResponse>(`${environment.apiUrl}/api/auth/login`, { code: code } as LoginRequest, {
      params,
    });
  }
  loginAdmin(userName: string, password: string) {
    const params = new InterceptorHttpParams({ noToken: true });
    return this.http.post<LoginResponse>(
      `${environment.apiUrl}/api/auth/admin/login`,
      { userName, password } as LoginAdminRequest,
      {
        params,
      }
    );
  }
  changePassword(currentPassword: string | null | undefined, newPassword: string | null | undefined) {
    return this.http.post(`${environment.apiUrl}/api/auth/change-password`, {
      oldPassword: currentPassword,
      newPassword: newPassword,
    } as ChangePasswordRequest);
  }
  getMyCode() {
    return this.http.get<GetCodeResponse>(`${environment.apiUrl}/api/auth/code`);
  }
  getShareLink(groupId: string, reroll: boolean = false, hoursValid: number | null = null) {
    let params = new HttpParams().set('reroll', reroll);
    if (hoursValid !== null) {
      params = params.set('hoursValid', hoursValid);
    }
    return this.http.get<LoginRequest>(`${environment.apiUrl}/api/auth/group/${groupId}/link`, { params });
  }
  getLinks() {
    return this.http.get<LinkListItem[]>(`${environment.apiUrl}/api/auth/links`);
  }
}
export interface GetCodeResponse {
  code: string;
}
export interface LoginRequest {
  code: string;
  expirationDate: Date | string;
}
export interface LoginResponse {
  token: string;
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
}

export interface ChangePasswordRequest {
  oldPassword: string | null | undefined;
  newPassword: string | null | undefined;
}
