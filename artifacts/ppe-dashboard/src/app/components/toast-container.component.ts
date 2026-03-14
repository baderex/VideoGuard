import { Component, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="fixed bottom-4 right-4 z-[100] space-y-2">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="px-4 py-3 rounded-lg border shadow-lg text-sm font-display tracking-wider backdrop-blur-md animate-[slideIn_0.3s_ease-out]"
          [class]="toast.type === 'success' ? 'bg-success/20 border-success/50 text-success' : toast.type === 'error' ? 'bg-destructive/20 border-destructive/50 text-destructive' : 'bg-primary/20 border-primary/50 text-primary'"
        >
          {{ toast.message }}
          <button (click)="toastService.dismiss(toast.id)" class="ml-3 opacity-60 hover:opacity-100">&times;</button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}
