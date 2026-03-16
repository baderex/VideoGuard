import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CameraService } from '../../services/camera.service';
import { Camera } from '../../lib/models';
import { PpeIconListComponent } from '../../components/ppe-icons.component';
import { CameraFormDialogComponent } from '../../components/camera-form-dialog.component';

@Component({
  selector: 'app-cameras',
  standalone: true,
  imports: [RouterLink, PpeIconListComponent, CameraFormDialogComponent],
  template: `
    <div class="space-y-5">

      <!-- Header -->
      <div class="flex sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div>
          <h1 class="text-2xl font-display font-bold text-foreground tracking-wider flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary shrink-0"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            CAMERA <span class="text-primary ml-1">NODES</span>
          </h1>
          <p class="text-xs text-muted-foreground font-mono mt-1">
            {{ cameras().length }} endpoints — {{ activeCount() }} online
          </p>
        </div>
        <button (click)="formOpen.set(true)"
          class="inline-flex items-center gap-2 rounded-lg text-xs font-display tracking-widest uppercase h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_16px_rgba(0,255,255,0.3)] hover:shadow-[0_0_24px_rgba(0,255,255,0.5)] transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Deploy Node
        </button>
      </div>

      @if (isLoading()) {
        <!-- Loading skeleton -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="rounded-xl border border-border/30 bg-card/50 p-5 space-y-3 animate-pulse">
              <div class="flex justify-between">
                <div class="h-4 w-32 rounded bg-white/5"></div>
                <div class="h-5 w-16 rounded-full bg-white/5"></div>
              </div>
              <div class="h-3 w-24 rounded bg-white/5"></div>
              <div class="h-8 rounded bg-white/5"></div>
              <div class="h-1.5 rounded-full bg-white/5"></div>
            </div>
          }
        </div>
      } @else if (cameras().length === 0) {
        <div class="rounded-xl border-2 border-dashed border-border/30 text-center py-16 px-8">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-muted-foreground/30 mb-4"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          <p class="font-display uppercase tracking-widest text-muted-foreground/50 mb-4">No Endpoints Detected</p>
          <button (click)="formOpen.set(true)"
            class="inline-flex items-center gap-2 rounded-lg text-xs font-display tracking-widest uppercase h-9 px-4 border border-primary/40 text-primary hover:bg-primary/10 transition-all">
            Initialize First Node
          </button>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          @for (camera of cameras(); track camera.id) {
            <div class="rounded-xl border bg-card/70 backdrop-blur-md shadow-md overflow-hidden relative flex flex-col group transition-all duration-300 hover:-translate-y-0.5"
              [class]="camera.status === 'active'
                ? 'border-border/40 hover:border-primary/40 hover:shadow-[0_4px_30px_rgba(0,255,255,0.08)]'
                : camera.status === 'error'
                ? 'border-destructive/20 hover:border-destructive/40'
                : 'border-border/30'">

              <!-- Status accent bar -->
              <div class="absolute top-0 left-0 w-full h-0.5"
                [class]="camera.status === 'active' ? 'bg-gradient-to-r from-primary/60 via-primary/30 to-transparent'
                       : camera.status === 'error' ? 'bg-gradient-to-r from-destructive/60 via-destructive/30 to-transparent'
                       : 'bg-gradient-to-r from-border/40 via-border/20 to-transparent'">
              </div>

              <div class="relative z-10 flex flex-col flex-1 p-5 pt-6">
                <!-- Header row -->
                <div class="flex items-start justify-between gap-3 mb-4">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <!-- Live pulse -->
                      <div class="shrink-0 w-2 h-2 rounded-full"
                        [class]="camera.status === 'active'
                          ? 'bg-success shadow-[0_0_6px_rgba(0,255,0,0.8)] animate-pulse'
                          : camera.status === 'error'
                          ? 'bg-destructive shadow-[0_0_6px_rgba(255,0,0,0.7)]'
                          : 'bg-muted-foreground/40'">
                      </div>
                      <h3 class="font-display font-bold tracking-wider text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {{ camera.name }}
                      </h3>
                    </div>
                    <p class="text-[10px] text-muted-foreground/60 font-mono">{{ camera.location }}</p>
                  </div>
                  <!-- Status badge -->
                  <span class="shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-display uppercase tracking-widest font-semibold"
                    [class]="camera.status === 'active'
                      ? 'border-success/40 bg-success/10 text-success'
                      : camera.status === 'error'
                      ? 'border-destructive/40 bg-destructive/10 text-destructive'
                      : 'border-border/40 bg-white/5 text-muted-foreground'">
                    {{ camera.status }}
                  </span>
                </div>

                <!-- Camera ID chip -->
                <div class="flex items-center gap-2 mb-4">
                  <span class="font-mono text-[9px] text-muted-foreground/40 bg-white/3 border border-border/20 rounded px-2 py-0.5">
                    ID-{{ camera.id.toString().padStart(3,'0') }}
                  </span>
                  @if (camera.siteId) {
                    <span class="font-mono text-[9px] text-primary/50 bg-primary/5 border border-primary/10 rounded px-2 py-0.5">
                      SITE-{{ camera.siteId }}
                    </span>
                  }
                </div>

                <!-- PPE protocols -->
                <div class="mb-4">
                  <p class="text-[9px] font-display tracking-widest uppercase text-muted-foreground/50 mb-2">Enforced Protocols</p>
                  <app-ppe-icon-list [ppeList]="camera.ppeRequirements" />
                </div>

                <!-- Activity bar placeholder -->
                @if (camera.status === 'active') {
                  <div class="mb-4">
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">AI Inference</span>
                      <span class="text-[9px] font-mono text-success/70">ACTIVE</span>
                    </div>
                    <div class="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div class="h-full w-full bg-gradient-to-r from-primary/50 via-success/40 to-primary/30 rounded-full"
                        style="background-size: 200% 100%; animation: shimmer 2s ease-in-out infinite alternate">
                      </div>
                    </div>
                  </div>
                }

                <!-- Actions -->
                <div class="mt-auto flex items-center justify-between pt-4 border-t border-border/20">
                  <button (click)="toggleStatus(camera)"
                    class="inline-flex items-center gap-1.5 rounded-lg text-[10px] font-display tracking-wider uppercase h-8 px-3 border transition-all"
                    [class]="camera.status === 'active'
                      ? 'border-warning/30 text-warning hover:bg-warning/10 hover:border-warning/50'
                      : 'border-success/30 text-success hover:bg-success/10 hover:border-success/50'">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" x2="12" y1="2" y2="12"/></svg>
                    {{ camera.status === 'active' ? 'Deactivate' : 'Activate' }}
                  </button>
                  <a [routerLink]="['/cameras', camera.id]"
                    class="inline-flex items-center gap-1.5 rounded-lg text-[10px] font-display tracking-widest uppercase h-8 px-3 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 hover:border-primary/40 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    View Feed
                  </a>
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

  activeCount = () => this.cameras().filter(c => c.status === 'active').length;

  ngOnInit() { this.loadCameras(); }
  ngOnDestroy() { this.sub?.unsubscribe(); }

  loadCameras() {
    this.sub?.unsubscribe();
    this.sub = this.cameraService.pollCameras(10000).subscribe(data => {
      this.cameras.set(data);
      this.isLoading.set(false);
    });
  }

  refreshCameras() { this.loadCameras(); }

  toggleStatus(camera: Camera) {
    const s = camera.status === 'active' ? 'inactive' : 'active';
    this.cameraService.updateCamera(camera.id, { status: s }).subscribe(() => this.loadCameras());
  }
}
