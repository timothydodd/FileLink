import { HttpClient, HttpEventType, HttpProgressEvent, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, catchError, filter, from, map, mergeMap, of, switchMap, take, tap } from 'rxjs';
import { ConfigService } from '../config.service';

export interface ChunkUploadProgress {
  chunkNumber: number;
  totalChunks: number;
  chunkProgress: number;
  overallProgress: number;
  bytesUploaded: number;
  totalBytes: number;
  currentChunkSize: number;
}

export interface UploadResult {
  success: boolean;
  itemId?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UploadChunkService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  // Configurable chunk size (default 10MB)
  private readonly chunkSize = 25 * 1024 * 1024; // 20MB
  private readonly largeFileThreshold = 50 * 1024 * 1024; // 50MB

  create(file: File, groupId: string): Observable<ChunkUploadProgress | UploadResult> {
    if (file.size > this.largeFileThreshold) {
      return this.uploadInChunks(file, groupId);
    } else {
      return this.uploadRegular(file, groupId);
    }
  }

  private uploadRegular(file: File, groupId: string): Observable<ChunkUploadProgress | UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);

    return this.http
      .post(`${this.configService.apiUrl}/api/file/group/${groupId}/upload`, formData, {
        reportProgress: true,
        observe: 'events',
        responseType: 'text',
      })
      .pipe(
        map((event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = Math.round((100 * event.loaded) / (event.total || 1));
            return {
              chunkNumber: 0,
              totalChunks: 1,
              chunkProgress: progress,
              overallProgress: progress,
              bytesUploaded: event.loaded,
              totalBytes: event.total || file.size,
              currentChunkSize: file.size,
            } as ChunkUploadProgress;
          } else if (event.type === HttpEventType.Response) {
            const response = event as HttpResponse<string>;
            const result = JSON.parse(response.body || '{}');
            return {
              success: true,
              itemId: result.itemId,
            } as UploadResult;
          }
          return null;
        }),
        map((result) => result!),
        catchError((error) => of({ success: false, error: error.message } as UploadResult))
      );
  }

  private uploadInChunks(file: File, groupId: string): Observable<ChunkUploadProgress | UploadResult> {
    const totalChunks = Math.ceil(file.size / this.chunkSize);
    const progressSubject = new Subject<ChunkUploadProgress | UploadResult>();
    const concurrentUploads = 3; // Set desired concurrency level

    let totalBytesUploaded = 0;
    let itemId: string = '';
    this.uploadChunkStart(groupId, file, totalChunks)
      .pipe(
        take(1),
        switchMap((result) => {
          if (!result?.itemId) {
            throw new Error('Failed to start chunk upload');
          }

          itemId = result.itemId;

          const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);

          return from(chunkIndices).pipe(
            mergeMap((index) => {
              return this.uploadChunk(file, groupId, itemId, index, totalChunks).pipe(
                tap((event) => {
                  if (this.isProgressEvent(event)) {
                    const chunkProgress = Math.round((100 * event.loaded) / (event.total || 1));
                    const currentChunkSize = this.getChunkSize(file, index);
                    const estimatedUploaded = Math.min(totalBytesUploaded + event.loaded, file.size);

                    progressSubject.next({
                      chunkNumber: index,
                      totalChunks,
                      chunkProgress,
                      overallProgress: Math.round((100 * estimatedUploaded) / file.size),
                      bytesUploaded: estimatedUploaded,
                      totalBytes: file.size,
                      currentChunkSize,
                    });
                  }
                }),
                map((event) => {
                  if (event.type === HttpEventType.Response) {
                    totalBytesUploaded += this.getChunkSize(file, index);
                    return index;
                  }
                  return null;
                }),
                filter((index) => index !== null),
                catchError((err) => {
                  progressSubject.next({ success: false, error: err.message });
                  return of(null); // Continue other uploads
                })
              );
            }, concurrentUploads) // <== Set concurrency here
          );
        })
      )
      .subscribe({
        next: (index) => {
          if (index !== null) {
            console.log(`Chunk ${index + 1}/${totalChunks} uploaded`);
          }
        },
        complete: () => {
          // All chunks uploaded successfully
          progressSubject.next({ success: true, itemId: itemId || 'unknown' } as UploadResult);
          progressSubject.complete();
        },
        error: (error) => {
          progressSubject.next({ success: false, error: error.message });
          progressSubject.complete();
        },
      });

    return progressSubject.asObservable();
  }
  private uploadChunkStart(groupId: string, file: File, totalChunks: number): Observable<UploadChunkStartResponse> {
    var request: ChunkUploadStartRequest = {
      fileName: file.name,
      totalChunks: totalChunks,
      totalFileSize: file.size,
    };
    return this.http.post<UploadChunkStartResponse>(
      `${this.configService.apiUrl}/api/file/group/${groupId}/upload-chunk/start`,
      request
    );
  }
  private uploadChunk(
    file: File,
    groupId: string,
    itemId: string | null,
    chunkIndex: number,
    totalChunks: number
  ): Observable<any> {
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(start + this.chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('fileName', file.name);
    formData.append('chunkNumber', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('position', start.toString());
    formData.append('length', (end - start).toString());
    formData.append('totalFileSize', file.size.toString());

    // Only include itemId if we have it (from second chunk onwards)
    if (itemId) {
      formData.append('itemId', itemId);
    }

    return this.http.post(`${this.configService.apiUrl}/api/file/group/${groupId}/upload-chunk`, formData, {
      reportProgress: true,
      observe: 'events',
      responseType: 'text',
    });
  }

  private getChunkSize(file: File, chunkIndex: number): number {
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(start + this.chunkSize, file.size);
    return end - start;
  }

  private isProgressEvent(event: any): event is HttpProgressEvent {
    return event.type === HttpEventType.UploadProgress;
  }
}

export interface UploadChunkStartResponse {
  itemId: string;
}
export interface ChunkUploadStartRequest {
  fileName: string;
  totalChunks: number;
  totalFileSize: number;
}
export interface ChunkUploadResponse {
  itemId: string;
  chunkReceived: number;
  totalChunks: number;
  isComplete: boolean;
}
