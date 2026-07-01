import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, validate } from '@angular/forms/signals';
import { ModalComponent, ModalLayoutComponent } from '@rd-ui';

@Component({
  standalone: true,
  selector: 'app-rename-modal',
  imports: [CommonModule, FormField, ModalLayoutComponent],
  template: `
    <rd-modal-layout [title]="'Rename File'">
      <div slot="body">
        <div class="form-group">
          <label for="newName">File Name</label>
          <input
            type="text"
            id="newName"
            [formField]="renameForm.name"
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

  nameModel = signal<{ name: string }>({ name: this.modalComponent.config?.data?.name ?? '' });
  renameForm = form(this.nameModel, (p) => {
    validate(p.name, (ctx) =>
      ctx.value().trim().length === 0 ? { kind: 'required', message: 'Name cannot be empty.' } : null
    );
  });

  hasError = () => this.renameForm().invalid();

  submit() {
    if (!this.renameForm().invalid()) {
      this.modalComponent.modalContainerService.close(
        this.modalComponent.modalId!,
        this.nameModel().name.trim()
      );
    }
  }
}
