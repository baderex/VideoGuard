import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CameraService } from '../services/camera.service';
import { CameraPpeRequirementsItem } from '../lib/models';
import { ppeLabelMap } from '../lib/utils';

@Component({
  selector: 'app-camera-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="close()"></div>
        <div class="relative bg-card border border-border/50 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <div class="p-6 border-b border-border/50">
            <h2 class="text-lg font-display font-bold tracking-wider text-foreground">Deploy New Camera Node</h2>
            <p class="text-sm text-muted-foreground mt-1">Initialize a new analytics endpoint on the network.</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="p-6 space-y-4">
            <div class="space-y-2">
              <label class="text-xs font-display tracking-wider uppercase text-muted-foreground">Node Designation</label>
              <input
                formControlName="name"
                class="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/50"
                placeholder="e.g. Loading Dock Cam 01"
              />
            </div>
            
            <div class="space-y-2">
              <label class="text-xs font-display tracking-wider uppercase text-muted-foreground">Location</label>
              <input
                formControlName="location"
                class="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/50"
                placeholder="e.g. Sector 7G"
              />
            </div>

            <div class="space-y-2">
              <label class="text-xs font-display tracking-wider uppercase text-muted-foreground">Stream URL (RTSP/HLS)</label>
              <input
                formControlName="streamUrl"
                class="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/50 font-mono"
                placeholder="rtsp://admin:pass@ip:port/stream"
              />
            </div>

            <div class="space-y-2 pt-2">
              <label class="text-xs font-display tracking-wider uppercase text-muted-foreground">Enforced PPE Protocols</label>
              <div class="grid grid-cols-2 gap-2 mt-2">
                @for (ppe of allPpe; track ppe) {
                  <div
                    (click)="togglePpe(ppe)"
                    class="cursor-pointer border rounded-md px-3 py-2 text-sm transition-all flex items-center"
                    [class]="isPpeActive(ppe) ? 'border-primary bg-primary/10 text-primary shadow-[inset_0_0_10px_rgba(0,255,255,0.1)]' : 'border-border/50 bg-background text-muted-foreground hover:bg-white/5'"
                  >
                    <div class="w-3 h-3 rounded-sm border mr-2" [class]="isPpeActive(ppe) ? 'bg-primary border-primary' : 'border-muted-foreground'"></div>
                    {{ getLabel(ppe) }}
                  </div>
                }
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-border/50">
              <button type="button" (click)="close()"
                class="inline-flex items-center justify-center rounded-md text-sm font-semibold font-display tracking-wider uppercase h-10 px-4 hover:bg-accent hover:text-accent-foreground text-muted-foreground transition-all">
                Cancel
              </button>
              <button type="submit" [disabled]="isPending()"
                class="inline-flex items-center justify-center rounded-md text-sm font-semibold font-display tracking-wider uppercase h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)] transition-all disabled:opacity-50">
                {{ isPending() ? 'INITIALIZING...' : 'DEPLOY NODE' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class CameraFormDialogComponent {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();
  @Output() created = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private cameraService = inject(CameraService);

  isPending = signal(false);

  allPpe = Object.values(CameraPpeRequirementsItem);
  selectedPpe = signal<CameraPpeRequirementsItem[]>([
    CameraPpeRequirementsItem.hard_hat,
    CameraPpeRequirementsItem.safety_vest
  ]);

  form = this.fb.group({
    name: ['', Validators.required],
    location: ['', Validators.required],
    streamUrl: [''],
  });

  isPpeActive(ppe: CameraPpeRequirementsItem): boolean {
    return this.selectedPpe().includes(ppe);
  }

  togglePpe(ppe: CameraPpeRequirementsItem) {
    const current = this.selectedPpe();
    if (current.includes(ppe)) {
      this.selectedPpe.set(current.filter(p => p !== ppe));
    } else {
      this.selectedPpe.set([...current, ppe]);
    }
  }

  getLabel(ppe: string): string {
    return ppeLabelMap[ppe] || ppe;
  }

  close() {
    this.openChange.emit(false);
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.isPending.set(true);

    const val = this.form.value;
    this.cameraService.createCamera({
      name: val.name!,
      location: val.location!,
      streamUrl: val.streamUrl || undefined,
      ppeRequirements: this.selectedPpe(),
    }).subscribe({
      next: () => {
        this.isPending.set(false);
        this.form.reset();
        this.selectedPpe.set([CameraPpeRequirementsItem.hard_hat, CameraPpeRequirementsItem.safety_vest]);
        this.created.emit();
        this.close();
      },
      error: () => {
        this.isPending.set(false);
      }
    });
  }
}
