import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, ViewEncapsulation } from '@angular/core';

/**
 * Placeholder to display instead of actual content
 */
@Component({
  selector: 'lib-skeleton',
  template: ` <div [ngClass]="containerClass()" [class]="styleClass()!" [ngStyle]="containerStyle()"></div> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./skeleton.css'],
  imports: [CommonModule],
})
export class SkeletonComponent {
  /**
   * Class of the element.
   */
  styleClass = input<string | undefined>();

  /**
   * Inline style of the element.
   */
  style = input<{ [klass: string]: any } | null | undefined>();

  /**
   * Shape of the element.
   */
  shape = input<string>('rectangle');
  /**
   * Type of the animation.
   */
  animation = input<string>('wave');

  /**
   * Border radius of the element, defaults to value from theme.
   */
  borderRadius = input<string | undefined>();

  /**
   * Size of the Circle or Square.
   */
  size = input<string | undefined>();

  /**
   * Width of the element.
   */
  width = input<string>('100%');

  /**
   * Height of the element.
   */
  height = input<string>('1rem');

  containerClass = computed(() => {
    return {
      'lib-skeleton': true,
      'lib-skeleton-circle': this.shape() === 'circle',
      'lib-skeleton-none': this.animation() === 'none',
    };
  });

  containerStyle = computed(() => {
    var wh = {};
    if (this.width() && this.height()) {
      wh = { width: this.width(), height: this.height() };
    }

    if (this.size()) return { ...this.style(), ...wh, borderRadius: this.borderRadius() };
    else return { ...this.style(), ...wh, borderRadius: this.borderRadius() };
  });
}
