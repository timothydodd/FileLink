import { inject, Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { LogLevel } from '@microsoft/signalr';
import { firstValueFrom, from, map, Observable, of, Subject, tap } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { ConfigService } from './config.service';
import { GroupItemChanged } from './web-api/upload.service';
@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private configService = inject(ConfigService);
  private authService = inject(AuthService);
  private hubConnection: signalR.HubConnection | undefined;
  public uploadItemChanged = new Subject<GroupItemChanged>();

  constructor() {}

  public get isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }
  public startConnection(): Observable<null | void> {
    if (this.hubConnection !== undefined && this.hubConnection?.state !== signalR.HubConnectionState.Disconnected) {
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
              map((token) => {
                if (!token?.token) throw new Error('Token is not available. Please log in again.');
                return token.token;
              }),
              tap(() => console.log('SignalR token retrieved successfully'))
            )
          );
        },
      } as signalR.IHttpConnectionOptions)
      .withAutomaticReconnect([200, 2000, 10000, 30000])
      .configureLogging(LogLevel.Critical)
      .build();

    this.hubConnection.on('UploadItemChanged', (result) => {
      this.uploadItemChanged.next(JSON.parse(result));
    });
    // Set up connection events
    this.hubConnection.onclose((error) => {
      console.error('SignalR connection closed', error);
      // Handle reconnection or notify the user
    });
    // Start the connection
    return from(
      this.hubConnection!.start().catch((err) => {
        console.error('Error starting SignalR connection:', err);

        throw err;
      })
    );
  }

  public stopConnection(): Promise<void> {
    return this.hubConnection?.stop() ?? Promise.reject('Hub connection is not established');
  }
}
