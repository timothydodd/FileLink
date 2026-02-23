import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  getLogs(limit: number, offset: number) {
    return this.http.get<AuditLogResponse>(
      `${this.configService.apiUrl}/api/audit?limit=${limit}&offset=${offset}`
    );
  }
}

export interface AuditLogItem {
  id: number;
  action: string;
  appUserId: string | null;
  groupId: string | null;
  itemId: string | null;
  detail: string | null;
  ipAddress: string | null;
  createdDate: string;
}

export interface AuditLogResponse {
  items: AuditLogItem[];
  totalCount: number;
}
