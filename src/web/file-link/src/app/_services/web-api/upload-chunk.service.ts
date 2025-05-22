import { HttpClient, HttpEventType, HttpProgressEvent, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, catchError, concatMap, filter, from, map, of, tap } from 'rxjs';
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

    let totalBytesUploaded = 0;
    let itemId: string | null = null;

    // Create observables for all chunks
    const chunkUploads = Array.from({ length: totalChunks }, (_, index) => {
      return () =>
        this.uploadChunk(file, groupId, itemId, index, totalChunks).pipe(
          tap((event) => {
            if (this.isProgressEvent(event)) {
              const chunkProgress = Math.round((100 * event.loaded) / (event.total || 1));
              const currentTotalUploaded = totalBytesUploaded + event.loaded;

              const progress: ChunkUploadProgress = {
                chunkNumber: index,
                totalChunks: totalChunks,
                chunkProgress: chunkProgress,
                overallProgress: Math.round((100 * currentTotalUploaded) / file.size),
                bytesUploaded: currentTotalUploaded,
                totalBytes: file.size,
                currentChunkSize: this.getChunkSize(file, index),
              };
              progressSubject.next(progress);
            }
          }),
          map((event) => {
            if (event.type === HttpEventType.Response) {
              const response = event as HttpResponse<string>;
              const result = JSON.parse(response.body || '{}');

              // Store itemId from first chunk response
              if (index === 0 && result.itemId) {
                itemId = result.itemId;
              }

              // Update total bytes uploaded when chunk completes
              totalBytesUploaded += this.getChunkSize(file, index);
              return { chunkCompleted: index, response: result };
            }
            // For other event types (UploadProgress, Sent, etc.), return null
            // These will be filtered out in the subscription
            return null;
          }),
          filter((result) => result !== null), // Filter out null values
          catchError((error) => {
            progressSubject.next({ success: false, error: error.message });
            return of(null);
          })
        );
    });

    // Execute uploads sequentially using concatMap
    from(chunkUploads)
      .pipe(
        concatMap((uploadFn) => uploadFn()) // concatMap ensures sequential execution
      )
      .subscribe({
        next: (result) => {
          if (result?.chunkCompleted !== undefined) {
            console.log(`Chunk ${result.chunkCompleted + 1}/${totalChunks} completed`);
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
