import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-spinner',
  imports: [],
  template: `
    <div class="spinner-container">
      <div class="loader"></div>
    </div>
  `,
  styleUrl: './spinner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpinnerComponent {}
