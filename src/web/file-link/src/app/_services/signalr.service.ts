import { inject, Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { LogLevel } from '@microsoft/signalr';
import { firstValueFrom, from, map, Observable, of, Subject, tap } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { ConfigService } from './config.service';
import { GroupItemChanged } from './web-api/upload.service';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private configService = inject(ConfigService);
  private authService = inject(AuthService);
  private hubConnection: signalR.HubConnection | undefined;
  public uploadItemChanged = new Subject<GroupItemChanged>();

  public connectionStatus = signal<ConnectionStatus>('disconnected');
  public connectionError = signal<string | null>(null);

  constructor() {}

  public get isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }
  public startConnection(): Observable<null | void> {
    if (this.hubConnection !== undefined && this.hubConnection?.state !== signalR.HubConnectionState.Disconnected) {
      return of(null);
    }
    this.connectionStatus.set('connecting');
    this.connectionError.set(null);

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

    this.hubConnection.onclose((error) => {
      console.error('SignalR connection closed', error);
      this.connectionStatus.set('error');
      this.connectionError.set(error?.message ?? 'Real-time connection lost');
    });

    this.hubConnection.onreconnecting((error) => {
      this.connectionStatus.set('connecting');
      this.connectionError.set(error?.message ?? 'Reconnecting...');
    });

    this.hubConnection.onreconnected(() => {
      this.connectionStatus.set('connected');
      this.connectionError.set(null);
    });

    return from(
      this.hubConnection!.start().then(() => {
        this.connectionStatus.set('connected');
        this.connectionError.set(null);
      }).catch((err) => {
        console.error('Error starting SignalR connection:', err);
        this.connectionStatus.set('error');
        this.connectionError.set(err?.message ?? 'Could not establish real-time connection');
        throw err;
      })
    );
  }

  public stopConnection(): Promise<void> {
    return this.hubConnection?.stop() ?? Promise.reject('Hub connection is not established');
  }
}
