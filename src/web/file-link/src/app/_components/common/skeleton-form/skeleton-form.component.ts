import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SkeletonComponent } from '../skeleton/skeleton';

@Component({
  selector: 'lib-skeleton-form',
  imports: [SkeletonComponent],
  template: `
    @if (includePageSection()) {
      <lib-skeleton class="section" [width]="null" [height]="null"></lib-skeleton>
    }
    <div
      class="flex-row gap20"
      style="flex-wrap: wrap;"
      [style.padding]="sectionPaddingView()"
      [style.flex-direction]="shape() === 'random' ? 'row' : 'column'"
    >
      @for (i of this.items(); track $index) {
        @if (shape() === 'random') {
          <div class="flex-column gap5">
            <lib-skeleton styleClass="title" [width]="null"></lib-skeleton>
            <lib-skeleton styleClass="input2" [width]="null"></lib-skeleton>
          </div>
          <div class="flex-column gap5">
            <lib-skeleton styleClass="title" [width]="null"></lib-skeleton>
            <lib-skeleton styleClass="input1" [width]="null"></lib-skeleton>
          </div>
          <div class="flex-column gap5">
            <lib-skeleton styleClass="title" [width]="null"></lib-skeleton>
            <lib-skeleton styleClass="input3" [width]="null"></lib-skeleton>
          </div>
        } @else {
          <div class="flex-column gap5" style="width: 100%">
            <lib-skeleton styleClass="title" [width]="null"></lib-skeleton>
            <lib-skeleton styleClass="full" [width]="null"></lib-skeleton>
          </div>
        }
      }
    </div>
  `,
  styleUrl: './skeleton-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonFormComponent {
  size = input(4);
  items = computed(() => Array.from({ length: this.size() }));
  includePageSection = input(false);
  sectionPadding = input('1rem');
  sectionPaddingView = computed(() => {
    if (this.includePageSection()) {
      return this.sectionPadding();
    }
    return '0';
  });
  shape = input<'random' | 'single'>('random');
}
