import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);
  private readonly chunkSize = 10 * 1024 * 1024; // 10MB
  private readonly largeFileThreshold = 50 * 1024 * 1024; // 50MB

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
    return this.http.get<FileIndexResponse>(`${this.configService.apiUrl}/api/file/local`);
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
export interface FileIndexResponse {
  indexing: boolean;
  files: LocalFile[] | null;
}

export interface GetLinkResponse {
  code: string;
}

export interface CreateGroupResponse {
  groupId: string;
}
export interface GroupItemChanged extends UploadItemResponse {
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
