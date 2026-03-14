import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CameraService } from '../../services/camera.service';
import { Camera, CameraStatusEnum } from '../../lib/models';
import { PpeIconListComponent } from '../../components/ppe-icons.component';
import { CameraFormDialogComponent } from '../../components/camera-form-dialog.component';

@Component({
  selector: 'app-cameras',
  standalone: true,
  imports: [RouterLink, PpeIconListComponent, CameraFormDialogComponent],
  template: `
    <div class="space-y-6">
      <div class="flex sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div>
          <h1 class="text-3xl font-display font-bold text-foreground flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3 text-primary"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            CAMERA <span class="text-primary ml-2">NODES</span>
          </h1>
          <p class="text-sm text-muted-foreground mt-1">Manage and monitor vision inference endpoints</p>
        </div>
        <button (click)="formOpen.set(true)"
          class="inline-flex items-center justify-center rounded-md text-sm font-semibold font-display tracking-wider uppercase h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)] transition-all gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          DEPLOY NEW NODE
        </button>
      </div>

      @if (isLoading()) {
        <div class="flex items-center justify-center py-20 text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-pulse-glow"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
        </div>
      } @else if (cameras().length === 0) {
        <div class="rounded-xl border-dashed border-2 border-border/50 bg-transparent text-center py-20">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-muted-foreground mb-4 opacity-50"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          <p class="text-xl font-display uppercase tracking-wider text-muted-foreground mb-4">No Endpoints Detected</p>
          <button (click)="formOpen.set(true)"
            class="inline-flex items-center justify-center rounded-md text-sm font-semibold font-display tracking-wider uppercase h-10 px-4 border border-primary/50 bg-transparent text-primary hover:bg-primary/10 transition-all">
            Initialize First Node
          </button>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          @for (camera of cameras(); track camera.id) {
            <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative flex flex-col group hover:border-primary/50 transition-colors">
              <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
              <div class="relative z-10 flex flex-col flex-1">
                <div class="flex flex-col space-y-1.5 p-6 pb-4">
                  <div class="flex justify-between items-start">
                    <div>
                      <h3 class="text-lg font-display font-bold tracking-wider text-foreground group-hover:text-primary transition-colors">{{ camera.name }}</h3>
                      <p class="text-xs text-muted-foreground font-mono mt-1">LOC: {{ camera.location }}</p>
                    </div>
                    <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider font-display"
                      [class]="camera.status === 'active' ? 'border-success/50 bg-success/10 text-success shadow-[0_0_10px_rgba(0,255,0,0.2)]' : camera.status === 'error' ? 'border-destructive/50 bg-destructive/10 text-destructive shadow-[0_0_10px_rgba(255,0,0,0.2)]' : 'border-secondary-foreground/20 bg-secondary text-secondary-foreground'">
                      {{ camera.status }}
                    </span>
                  </div>
                </div>
                <div class="p-6 pt-0 flex-1 space-y-4">
                  <div>
                    <p class="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">Enforced Protocols</p>
                    <app-ppe-icon-list [ppeList]="camera.ppeRequirements" />
                  </div>
                  
                  <div class="flex items-center justify-between pt-4 border-t border-border/50">
                    <button (click)="toggleStatus(camera)"
                      class="inline-flex items-center justify-center rounded-md text-sm font-semibold font-display tracking-wider uppercase h-9 px-3 hover:bg-accent hover:text-accent-foreground transition-all"
                      [class]="camera.status === 'active' ? 'text-warning hover:text-warning' : 'text-success hover:text-success'">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" x2="12" y1="2" y2="12"/></svg>
                      {{ camera.status === 'active' ? 'DEACTIVATE' : 'ACTIVATE' }}
                    </button>
                    <a [routerLink]="['/cameras', camera.id]"
                      class="inline-flex items-center justify-center rounded-md text-sm font-semibold font-display tracking-wider uppercase h-9 px-3 bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 text-foreground transition-all">
                      VIEW FEED
                    </a>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
    <app-camera-form-dialog [open]="formOpen()" (openChange)="formOpen.set($event)" (created)="refreshCameras()" />
  `
})
export class CamerasComponent implements OnInit, OnDestroy {
  private cameraService = inject(CameraService);
  private sub?: Subscription;

  cameras = signal<Camera[]>([]);
  isLoading = signal(true);
  formOpen = signal(false);

  ngOnInit() {
    this.loadCameras();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  loadCameras() {
    this.sub?.unsubscribe();
    this.sub = this.cameraService.pollCameras(10000).subscribe(data => {
      this.cameras.set(data);
      this.isLoading.set(false);
    });
  }

  refreshCameras() {
    this.loadCameras();
  }

  toggleStatus(camera: Camera) {
    const newStatus = camera.status === 'active' ? 'inactive' : 'active';
    this.cameraService.updateCamera(camera.id, { status: newStatus }).subscribe(() => {
      this.loadCameras();
    });
  }
}
