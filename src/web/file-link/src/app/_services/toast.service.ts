import { Injectable, signal } from '@angular/core';
export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info',
  WARNING = 'warning',
}

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
}
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastCount = 0;

  public toasts = signal<Toast[]>([]);

  constructor() {}

  /**
   * Show a success toast message
   */
  success(message: string, duration = 1000): void {
    this.show(message, ToastType.SUCCESS, duration);
  }

  /**
   * Show an error toast message
   */
  error(message: string, duration = 5000): void {
    this.show(message, ToastType.ERROR, duration);
  }

  /**
   * Show an info toast message
   */
  info(message: string, duration = 3000): void {
    this.show(message, ToastType.INFO, duration);
  }

  /**
   * Show a warning toast message
   */
  warning(message: string, duration = 4000): void {
    this.show(message, ToastType.WARNING, duration);
  }

  /**
   * Show a toast with a specific type
   */
  private show(message: string, type: ToastType, duration?: number): void {
    const id = this.toastCount++;
    const toast: Toast = { id, message, type, duration };

    this.toasts.update((toasts) => [...toasts, toast]);

    if (duration) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  /**
   * Remove a toast by id
   */
  remove(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  /**
   * Clear all toasts
   */
  clear(): void {
    this.toasts.update((_toasts) => []);
  }
}
