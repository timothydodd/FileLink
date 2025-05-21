// src/app/services/config.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpInterceptorConfig } from './auth/providers/jwt-auth-provider.config';

// Declare the global APP_CONFIG
declare global {
  interface Window {
    APP_CONFIG?: {
      apiUrl?: string;
      auth?: {
        clientId?: string;
        audience?: string;
        useLocalStorage?: boolean;
      };
      // Add other settings as needed
    };
  }
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private config: {
    apiUrl: string;
    auth: {
      clientId: string;
      audience: string;
      useLocalStorage: boolean;
    };
    httpInterceptor: HttpInterceptorConfig;
    // Add other settings as needed
  };

  constructor() {
    // Initialize config with environment values
    this.config = {
      apiUrl: environment.apiUrl,
      auth: {
        clientId: environment.auth.clientId,
        audience: environment.auth.audience,
        useLocalStorage: environment.auth.useLocalStorage,
      },
      httpInterceptor: {
        allowedList: ['/api/*'],
      },
    };

    // In production, override with window.APP_CONFIG values where they exist
    if (environment.production && window.APP_CONFIG) {
      // Check and override top-level properties
      if (window.APP_CONFIG.apiUrl !== undefined && window.APP_CONFIG.apiUrl !== null) {
        this.config.apiUrl = window.APP_CONFIG.apiUrl;
      }

      // Check and override nested auth properties
      if (window.APP_CONFIG.auth) {
        const runtimeAuth = window.APP_CONFIG.auth;

        if (runtimeAuth.clientId !== undefined && runtimeAuth.clientId !== null) {
          this.config.auth.clientId = runtimeAuth.clientId;
        }

        if (runtimeAuth.audience !== undefined && runtimeAuth.audience !== null) {
          this.config.auth.audience = runtimeAuth.audience;
        }

        if (runtimeAuth.useLocalStorage !== undefined && runtimeAuth.useLocalStorage !== null) {
          this.config.auth.useLocalStorage = runtimeAuth.useLocalStorage;
        }
      }

      // Add similar checks for any other properties
    }
  }

  get apiUrl(): string {
    return this.config.apiUrl;
  }

  get auth(): {
    clientId: string;
    audience: string;
    useLocalStorage: boolean;
  } {
    return this.config.auth;
  }

  // Convenience getters for nested properties
  get clientId(): string {
    return this.config.auth.clientId;
  }

  get audience(): string {
    return this.config.auth.audience;
  }

  get useLocalStorage(): boolean {
    return this.config.auth.useLocalStorage;
  }
  get httpInterceptor(): HttpInterceptorConfig {
    return this.config.httpInterceptor;
  }
  // Add other getters as needed
}
