import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);

  create(file: File, groupId: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);

    return this.http.post(`${environment.apiUrl}/api/file/group/${groupId}/upload`, formData, {
      reportProgress: true,
      observe: 'events',
      responseType: 'text',
    });
  }

  getUploads(groupId: string) {
    return this.http.get<UploadItemResponse[]>(`${environment.apiUrl}/api/file/group/${groupId}`);
  }

  createGroup() {
    return this.http.get<CreateGroupResponse>(`${environment.apiUrl}/api/file/group`);
  }
  delete(groupId: string) {
    return this.http.delete(`${environment.apiUrl}/api/file/group/${groupId}`);
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
