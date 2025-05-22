import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-spinner',
  imports: [CommonModule],
  template: `
    <div class="spinner-container">
      <div class="loader"></div>
      <ng-content></ng-content>
    </div>
  `,
  styleUrl: './spinner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpinnerComponent {}
