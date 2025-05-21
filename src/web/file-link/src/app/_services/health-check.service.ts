import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { HealthCheck } from '../pages/error-page/error-page.component';
import { InterceptorHttpParams } from './auth/auth-interceptor.service';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class HealthCheckService {
  private configService = inject(ConfigService);
  constructor(private http: HttpClient) {}
  getfilelink() {
    const params = new InterceptorHttpParams({ noToken: true });
    return this.http.get<HealthCheck>(`${this.configService.apiUrl}/health`, { params: params });
  }
}
