import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SkeletonComponent } from '../skeleton/skeleton';

@Component({
    selector: 'lib-skeleton-table-row',
    imports: [SkeletonComponent],
    template: `
    @for (r of rowsView(); track $index) {
      <tr>
        @for (c of columnsView(); track $index) {
          <td>
            <lib-skeleton width="100%" height="1rem"></lib-skeleton>
          </td>
        }
      </tr>
    }
  `,
    styleUrl: './skeleton-table-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SkeletonTableRowComponent {
  columns = input.required<number>();
  rows = input(4);
  columnsView = computed(() => Array.from({ length: this.columns() }));
  rowsView = computed(() => Array.from({ length: this.rows() }));
}
