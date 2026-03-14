import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, signal } from '@angular/core';
import { YoloStats } from '../lib/models';

@Component({
  selector: 'app-simulated-feed',
  standalone: true,
  template: `
    @if (status === 'inactive') {
      <div class="w-full aspect-video bg-black rounded-lg border border-border flex items-center justify-center flex-col text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-4 opacity-50"><circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
        <p class="font-display tracking-widest uppercase">Feed Offline</p>
      </div>
    } @else if (status === 'error') {
      <div class="w-full aspect-video bg-black rounded-lg border border-destructive/50 flex items-center justify-center flex-col text-destructive shadow-[inset_0_0_50px_rgba(255,0,0,0.1)]">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-4"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        <p class="font-display tracking-widest uppercase text-xl">Connection Lost</p>
        <p class="text-sm font-mono mt-2">ERR_STREAM_TIMEOUT</p>
      </div>
    } @else if (streamError()) {
      <div class="w-full aspect-video bg-[#050a10] rounded-lg border border-border/50 flex items-center justify-center flex-col text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-3 animate-spin text-primary/60"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <p class="font-display tracking-wider uppercase text-sm">Loading YOLO Detection Engine...</p>
        <p class="text-xs font-mono mt-1 opacity-60">Downloading model weights on first run</p>
      </div>
    } @else {
      <div class="relative w-full aspect-video bg-[#050a10] rounded-lg border border-border/50 overflow-hidden">
        @if (streamUrl && !streamLoaded()) {
          <div class="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground z-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-3 animate-spin text-primary/60"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <p class="font-display tracking-wider uppercase text-sm">Initialising YOLO v11...</p>
            <p class="text-xs font-mono mt-1 opacity-60">CAM-{{ padId() }} ∙ Awaiting stream</p>
          </div>
        }
        @if (streamUrl) {
          <img
            [src]="streamUrl"
            [alt]="'Camera ' + cameraId + ' YOLO Feed'"
            class="absolute inset-0 w-full h-full object-cover"
            [style.display]="streamLoaded() ? 'block' : 'none'"
            (load)="onStreamLoad()"
            (error)="onStreamError()"
          />
        }
      </div>
    }
  `
})
export class SimulatedFeedComponent implements OnChanges, OnDestroy {
  @Input() snapshot: unknown;
  @Input() status?: string;
  @Input() cameraId?: number;
  @Output() yoloStats = new EventEmitter<YoloStats>();

  streamError = signal(false);
  streamLoaded = signal(false);

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  get streamUrl(): string | null {
    return this.cameraId ? `/api/yolo/stream/${this.cameraId}` : null;
  }

  padId(): string {
    return String(this.cameraId || 0).padStart(2, '0');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['cameraId']) {
      this.streamError.set(false);
      this.streamLoaded.set(false);
      this.setupStatsPoll();
    }
    if (changes['status']) {
      this.setupStatsPoll();
    }
  }

  ngOnDestroy() {
    this.clearPoll();
  }

  onStreamLoad() {
    this.streamLoaded.set(true);
  }

  onStreamError() {
    this.streamLoaded.set(false);
    this.streamError.set(true);
    setTimeout(() => this.streamError.set(false), 4000);
  }

  private setupStatsPoll() {
    this.clearPoll();
    if (!this.cameraId || this.status !== 'active') return;

    const statsUrl = `/api/yolo/stats/${this.cameraId}`;
    const poll = async () => {
      try {
        const res = await fetch(statsUrl);
        if (res.ok) {
          const data: YoloStats = await res.json();
          this.yoloStats.emit(data);
        }
      } catch {}
    };

    poll();
    this.pollInterval = setInterval(poll, 2000);
  }

  private clearPoll() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
