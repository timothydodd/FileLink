import { Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SignalRService } from '../../_services/signalr.service';

@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    @if (status() !== 'disconnected') {
      <div class="connection-status" [class]="status()">
        @switch (status()) {
          @case ('connecting') {
            <lucide-icon name="loader" [size]="14" class="spin"></lucide-icon>
          }
          @case ('connected') {
            <lucide-icon name="wifi" [size]="14"></lucide-icon>
          }
          @case ('error') {
            <lucide-icon name="wifi-off" [size]="14"></lucide-icon>
          }
        }
        <span class="label">{{ label() }}</span>
      </div>
    }
  `,
  styles: `
    .connection-status {
      position: fixed;
      bottom: 8px;
      left: 8px;
      display: flex;
      align-items: center;
      gap: 0;
      height: 28px;
      padding: 0 7px;
      border-radius: 14px;
      cursor: default;
      opacity: 0.6;
      transition: opacity 0.2s, gap 0.25s, padding 0.25s;
      z-index: 1000;
      overflow: hidden;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      background: var(--bg-surface-raised);
      border: 1px solid var(--border-color-light);
    }
    .connection-status:hover {
      opacity: 1;
      gap: 6px;
      padding: 0 10px 0 8px;
    }
    .connection-status .label {
      max-width: 0;
      overflow: hidden;
      transition: max-width 0.25s ease;
    }
    .connection-status:hover .label {
      max-width: 160px;
    }
    .connected {
      color: var(--primary);
    }
    .connecting {
      color: var(--warning, #ffc107);
    }
    .error,
    .disconnected {
      color: var(--danger);
    }
    .spin :first-child {
      animation: spin 1s linear infinite;
      display: block;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
})
export class ConnectionStatusComponent {
  private srService = inject(SignalRService);

  status = this.srService.connectionStatus;

  label = computed(() => {
    const s = this.status();
    const error = this.srService.connectionError();
    switch (s) {
      case 'connected':
        return 'SignalR Connected';
      case 'connecting':
        return 'SignalR Connecting...';
      case 'error':
        return error ? `SignalR Error: ${error}` : 'SignalR Error';
      case 'disconnected':
        return error ? `SignalR Disconnected: ${error}` : 'SignalR Disconnected';
    }
  });
}
