import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'lib-progress',
  template: `
    <div class="progress-cont">
      <div class="inner-pad">
        <div class="progress" [style.width]="progressWidth()">
          @if (progress() > 10) {
            <div class="progress-title">{{ progress() }}%</div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./progress.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ProgressComponent {
  progress = input.required<number>();

  titleLeft = computed(() => {
    const p = this.progress();
    if (p > 0) return 'calc(' + p + ' % - 10px)';

    return 0 + '%';
  });
  progressWidth = computed(() => {
    const p = this.progress();
    if (p > 0) return p + '%';
    return 0 + '%';
  });
}
