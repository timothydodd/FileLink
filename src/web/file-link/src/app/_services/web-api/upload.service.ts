import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);
  create(file: File, groupId: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);

    return this.http.post(`${this.configService.apiUrl}/api/file/group/${groupId}/upload`, formData, {
      reportProgress: true,
      observe: 'events',
      responseType: 'text',
    });
  }

  getUploads(groupId: string) {
    return this.http.get<UploadItemResponse[]>(`${this.configService.apiUrl}/api/file/group/${groupId}`);
  }

  createGroup() {
    return this.http.get<CreateGroupResponse>(`${this.configService.apiUrl}/api/file/group`);
  }
  delete(groupId: string) {
    return this.http.delete(`${this.configService.apiUrl}/api/file/group/${groupId}`);
  }
  getLocalInfo() {
    return this.http.get<LocalInfo>(`${this.configService.apiUrl}/api/file/local/info`);
  }
  getLocalFiles() {
    return this.http.get<LocalFile[]>(`${this.configService.apiUrl}/api/file/local`);
  }
  attachLocalFile(groupId: string, localFiles: AddLocalPath[]) {
    return this.http.put<UploadItemResponse>(
      `${this.configService.apiUrl}/api/file/group/${groupId}/local`,
      localFiles
    );
  }
}

export interface UploadItem {
  itemId: string;
  groupId: string;
  fileName: string;
  createdDate: string;
}

export interface GetLinkResponse {
  code: string;
}

export interface CreateGroupResponse {
  groupId: string;
}
export interface UploadItemResponse {
  name: string;
  id: string;
  size: number | null;
  metadata: Metadata | null;
  url: string;
}
export interface Metadata {
  title: string | null;
  year: number | null;
  imdbRating: number | null;
  imdbId: string | null;
  genre: string | null;
  mediaType: string | null;
  seriesName: string | null;
  season: number | null;
  episode: number | null;
  poster: string | null;
  seriesPoster: string | null;
  metaDataDate: string | null;
}
export interface LocalInfo {
  hasLocalPaths: boolean;
}
export interface LocalFile {
  localPathIndex: number;
  path: string;
}
export interface AddLocalPath {
  localPathIndex: number;
  path: string;
}
