import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent, ModalLayoutComponent } from '@rd-ui';

@Component({
  standalone: true,
  selector: 'app-rename-modal',
  imports: [CommonModule, FormsModule, ModalLayoutComponent],
  template: `
    <rd-modal-layout [title]="'Rename File'">
      <div slot="body">
        <div class="form-group">
          <label for="newName">File Name</label>
          <input
            type="text"
            id="newName"
            [ngModel]="newName()"
            (ngModelChange)="newName.set($event)"
            (keydown.enter)="submit()"
            autofocus
          />
        </div>
        @if (hasError()) {
          <div class="error">Name cannot be empty.</div>
        }
      </div>
      <div slot="footer">
        <div class="button-group">
          <button class="btn btn-primary" (click)="submit()" [disabled]="hasError()">Rename</button>
        </div>
      </div>
    </rd-modal-layout>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenameModalComponent {
  private modalComponent = inject(ModalComponent);

  newName = signal<string>(this.modalComponent.config?.data?.name ?? '');

  hasError = computed(() => {
    return this.newName().trim().length === 0;
  });

  submit() {
    if (!this.hasError()) {
      this.modalComponent.modalContainerService.close(
        this.modalComponent.modalId!,
        this.newName().trim()
      );
    }
  }
}
