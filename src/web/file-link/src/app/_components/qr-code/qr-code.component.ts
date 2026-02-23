import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-qr-code',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dataUrl()) {
      <img [src]="dataUrl()" [width]="size()" [height]="size()" alt="QR Code" />
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        justify-content: center;
      }
      img {
        border-radius: 6px;
        border: 1px solid var(--border-color);
      }
    `,
  ],
})
export class QrCodeComponent {
  value = input.required<string>();
  size = input<number>(150);
  dataUrl = signal<string | null>(null);

  constructor() {
    effect(() => {
      const val = this.value();
      if (val) {
        QRCode.toDataURL(val, { width: this.size(), margin: 2 }).then((url) => this.dataUrl.set(url));
      }
    });
  }
}
