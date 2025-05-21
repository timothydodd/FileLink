import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SkeletonComponent } from '../skeleton/skeleton';

@Component({
  selector: 'lib-skeleton-list',
  imports: [FormsModule, SkeletonComponent],
  template: `
    <div class="flex-column" [style.gap]="gap()">
      @for (i of this.items(); track $index) {
        <lib-skeleton width="100%" [height]="itemHeight()"></lib-skeleton>
      }
    </div>
  `,
  styleUrl: './skeleton-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonListComponent {
  size = input(4);
  items = computed(() => Array.from({ length: this.size() }));
  itemHeight = input('24px');
  gap = input('5px');
}
