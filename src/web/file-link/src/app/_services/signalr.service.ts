import { inject, Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { LogLevel } from '@microsoft/signalr';
import { firstValueFrom, from, map, Observable, of, Subject, tap } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { ConfigService } from './config.service';
import { UploadItemResponse } from './web-api/upload.service';
@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private configService = inject(ConfigService);
  private authService = inject(AuthService);
  private hubConnection: signalR.HubConnection | undefined;
  public jobCompleted = new Subject<UploadItemResponse>();

  constructor() {}

  public get isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }
  public startConnection(): Observable<null | void> {
    if (this.isConnected) {
      return of(null);
    }
    console.log('Starting SignalR connection...');
    // Get the JWT token from your auth service

    var url = `${this.configService.apiUrl}/hub/items`;
    this.hubConnection = new signalR.HubConnectionBuilder()

      .withUrl(url, {
        accessTokenFactory: () => {
          return firstValueFrom(
            this.authService.getTokenSilently$().pipe(
              map((token) => token?.token ?? ''),
              tap(() => console.log('SignalR token retrieved successfully'))
            )
          );
        },
      } as signalR.IHttpConnectionOptions)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Critical)
      .build();

    // Set up connection events
    this.hubConnection.onclose((error) => {
      console.error('SignalR connection closed', error);
      // Handle reconnection or notify the user
    });

    // Start the connection
    return from(
      this.hubConnection.start().catch((err) => {
        console.error('Error starting SignalR connection:', err);

        throw err;
      })
    );
  }

  public joinGroup(groupId: string): Observable<void> {
    return from(
      this.hubConnection?.invoke('JoinGroup', groupId) ?? Promise.reject('Hub connection is not established')
    );
  }

  public leaveGroup(groupId: string): Promise<void> {
    return this.hubConnection?.invoke('LeaveGroup', groupId) ?? Promise.reject('Hub connection is not established');
  }

  public listFormItemChange(): Observable<UploadItemResponse> {
    this.hubConnection?.on('UploadItemChanged', (result) => {
      this.jobCompleted.next(JSON.parse(result));
    });
    return this.jobCompleted.asObservable();
  }

  public stopConnection(): Promise<void> {
    return this.hubConnection?.stop() ?? Promise.reject('Hub connection is not established');
  }
}
