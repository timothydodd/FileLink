import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  ALargeSmall,
  AlertCircle,
  Binary,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  CloudUpload,
  Coffee,
  Copy,
  Database,
  Disc,
  Download,
  EllipsisVertical,
  Eye,
  File,
  FileArchive,
  FileAudio,
  FileChartLine,
  FileCheck,
  FileCode,
  FileCog,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileSymlink,
  FileText,
  FileType,
  FileVideo,
  Flame,
  FolderOpen,
  Globe,
  GripVertical,
  LucideAngularModule,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  Settings,
  SquareMenu,
  Terminal,
  X,
} from 'lucide-angular';
import { environment } from '../environments/environment';
import { AuthInterceptorService } from './_services/auth/auth-interceptor.service';
import { AuthConfigService } from './_services/auth/providers/jwt-auth-provider.config';
import { JwtAuthProvider } from './_services/auth/providers/jwt-auth-provider.service';
import { UserPreferenceService } from './_services/user-prefrences.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    UserPreferenceService,
    importProvidersFrom(
      LucideAngularModule.pick({
        AlertCircle,
        X,
        Settings,
        ChevronDown,
        ChevronUp,
        PenLine,
        ALargeSmall,
        CalendarDays,
        Send,
        CircleHelp,
        GripVertical,
        CloudUpload,
        EllipsisVertical,
        RefreshCw,
        Copy,
        Download,
        Plus,
        Eye,
        SquareMenu,
        // Additional icons for file types
        File,
        FileText,
        FileImage,
        FileVideo,
        FileAudio,
        FileCode,
        FileCog,
        FileSpreadsheet,
        FileArchive,
        FileChartLine,
        FileCheck,
        Database,
        FolderOpen,
        Globe,
        FileJson,
        Coffee,
        Binary,
        Flame,
        FileSymlink,
        BookOpen,
        Terminal,
        FileType,
        Disc,
      })
    ),
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptorService,
      multi: true,
    },
    JwtAuthProvider,
    {
      provide: AuthConfigService,
      useValue: {
        clientId: environment.auth.clientId,
        audience: environment.auth.audience,
        useLocalStorage: environment.auth.useLocalStorage === 'true' ? true : false,
        // The http interceptor configuration
        httpInterceptor: {
          allowedList: ['/api/*'],
        },
      },
    },
  ],
};
