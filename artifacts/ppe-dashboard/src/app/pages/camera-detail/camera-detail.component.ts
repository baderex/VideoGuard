import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, switchMap, of, EMPTY } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { CameraService } from '../../services/camera.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Camera, DetectionSnapshot, AnalyticsDataPoint, YoloStats } from '../../lib/models';
import { getComplianceColor, formatTime } from '../../lib/utils';
import { SimulatedFeedComponent } from '../../components/simulated-feed.component';
import { PpeIconListComponent } from '../../components/ppe-icons.component';

@Component({
  selector: 'app-camera-detail',
  standalone: true,
  imports: [RouterLink, BaseChartDirective, SimulatedFeedComponent, PpeIconListComponent],
  template: `
    @if (isLoading()) {
      <div class="flex justify-center py-20 text-primary">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-pulse"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
      </div>
    } @else if (!camera()) {
      <div class="p-8 text-destructive">Camera not found.</div>
    } @else {
      <div class="space-y-6">
        <div class="flex items-center gap-4">
          <a routerLink="/cameras"
            class="inline-flex items-center justify-center rounded-full w-10 h-10 hover:bg-accent hover:text-accent-foreground text-muted-foreground bg-white/5 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          </a>
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-display font-bold text-foreground tracking-wider">{{ camera()!.name }}</h1>
              <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider font-display"
                [class]="camera()!.status === 'active' ? 'border-success/50 bg-success/10 text-success shadow-[0_0_10px_rgba(0,255,0,0.2)]' : camera()!.status === 'error' ? 'border-destructive/50 bg-destructive/10 text-destructive shadow-[0_0_10px_rgba(255,0,0,0.2)]' : 'border-secondary-foreground/20 bg-secondary text-secondary-foreground'">
                {{ camera()!.status }}
              </span>
            </div>
            <p class="text-sm text-muted-foreground font-mono mt-1">ID: {{ camera()!.id }} | LOC: {{ camera()!.location }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-6">
            <!-- Feed Card -->
            <div class="rounded-xl border border-primary/20 bg-card/80 backdrop-blur-md shadow-[0_0_30px_rgba(0,255,255,0.05)] overflow-hidden relative">
              <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
              <div class="relative z-10 p-1 bg-black">
                <app-simulated-feed
                  [snapshot]="snapshot()"
                  [status]="camera()!.status"
                  [cameraId]="camera()!.id"
                  (yoloStats)="onYoloStats($event)"
                />
              </div>
            </div>

            <!-- Chart Card -->
            <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative">
              <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
              <div class="relative z-10">
                <div class="flex flex-col space-y-1.5 p-6">
                  <h3 class="font-display font-semibold leading-none tracking-wider text-primary">Local Compliance Trend (60m)</h3>
                </div>
                <div class="p-6 pt-0 h-64">
                  @if (lineChartData()) {
                    <canvas baseChart
                      [data]="lineChartData()!"
                      [options]="lineChartOptions"
                      type="line"
                    ></canvas>
                  } @else {
                    <div class="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">NO_DATA_AVAILABLE</div>
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <!-- Live Telemetry Card -->
            <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative">
              <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
              <div class="relative z-10">
                <div class="flex flex-col space-y-1.5 p-6 pb-2">
                  <h3 class="font-display font-semibold leading-none tracking-wider text-primary flex items-center text-sm justify-between">
                    <span class="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
                      Live Telemetry
                    </span>
                    @if (yoloStats()) {
                      <span class="flex items-center gap-1 text-[10px] font-mono text-green-400/80 bg-green-400/10 px-2 py-0.5 rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
                        YOLO LIVE
                      </span>
                    }
                  </h3>
                </div>
                <div class="p-6 pt-0">
                  <div class="grid grid-cols-2 gap-4">
                    <div class="bg-background/50 rounded-lg p-3 border border-border/50 text-center">
                      <p class="text-xs font-display text-muted-foreground tracking-wider mb-1">TARGETS</p>
                      <p class="text-2xl font-bold font-mono">{{ getPersonCount() }}</p>
                    </div>
                    <div class="rounded-lg p-3 border text-center" [class]="getComplianceColor(getComplianceRate())">
                      <p class="text-xs font-display tracking-wider mb-1 opacity-80">COMPLIANCE</p>
                      <p class="text-2xl font-bold font-mono">{{ Math.round(getComplianceRate()) }}%</p>
                    </div>
                  </div>
                  @if (yoloStats() && yoloStats()!.violationCount > 0) {
                    <div class="mt-3 rounded-lg p-2 border border-destructive/40 bg-destructive/10 text-center">
                      <p class="text-xs font-display text-destructive tracking-wider">
                        ⚠ {{ yoloStats()!.violationCount }} PPE VIOLATION{{ yoloStats()!.violationCount !== 1 ? 'S' : '' }} DETECTED
                      </p>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Detected Subjects Card -->
            <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative flex flex-col h-[500px]">
              <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
              <div class="relative z-10 flex flex-col flex-1">
                <div class="flex flex-col space-y-1.5 p-6 pb-2">
                  <h3 class="font-display font-semibold leading-none tracking-wider text-primary flex items-center text-sm justify-between">
                    <span class="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      Detected Subjects
                    </span>
                    <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider font-display text-foreground">
                      {{ snapshot()?.detectedPersons?.length || 0 }}
                    </span>
                  </h3>
                </div>
                <div class="p-6 pt-0 flex-1 overflow-y-auto pr-2 space-y-3">
                  @if (!snapshot()?.detectedPersons?.length) {
                    <div class="text-center py-10 text-muted-foreground font-mono text-xs">NO_SUBJECTS_DETECTED</div>
                  } @else {
                    @for (person of snapshot()!.detectedPersons; track person.id) {
                      <div class="p-3 rounded-lg border bg-background/50 relative overflow-hidden"
                        [class]="person.compliant ? 'border-success/30 hover:border-success/60' : 'border-destructive/50 shadow-[inset_0_0_15px_rgba(255,0,0,0.1)]'">
                        <div class="flex justify-between items-start mb-2">
                          <div class="font-mono text-xs text-muted-foreground">ID: {{ person.id.substring(0,8) }}</div>
                          @if (person.compliant) {
                            <span class="inline-flex items-center rounded-full border px-1.5 py-0 h-4 text-[10px] font-semibold uppercase tracking-wider font-display border-success/50 bg-success/10 text-success shadow-[0_0_10px_rgba(0,255,0,0.2)]">PASS</span>
                          } @else {
                            <span class="inline-flex items-center rounded-full border px-1.5 py-0 h-4 text-[10px] font-semibold uppercase tracking-wider font-display border-destructive/50 bg-destructive/10 text-destructive shadow-[0_0_10px_rgba(255,0,0,0.2)] animate-pulse">FAIL</span>
                          }
                        </div>
                        <div class="mt-3">
                          <p class="text-[10px] font-display text-muted-foreground uppercase tracking-widest mb-1">Equipment Check</p>
                          <app-ppe-icon-list [ppeList]="camera()!.ppeRequirements" [missing]="person.missingPpe" />
                        </div>
                      </div>
                    }
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class CameraDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private cameraService = inject(CameraService);
  private analyticsService = inject(AnalyticsService);
  private subs: Subscription[] = [];

  isLoading = signal(true);
  camera = signal<Camera | null>(null);
  snapshot = signal<DetectionSnapshot | null>(null);
  yoloStats = signal<YoloStats | null>(null);
  lineChartData = signal<ChartConfiguration<'line'>['data'] | null>(null);

  Math = Math;
  getComplianceColor = getComplianceColor;

  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: 'hsl(215, 20%, 65%)', maxTicksLimit: 8 },
        grid: { color: 'hsl(224, 71%, 15%)' },
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: 'hsl(215, 20%, 65%)' },
        grid: { color: 'hsl(224, 71%, 15%)' },
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'hsl(224, 71%, 8%)',
        borderColor: 'hsl(224, 71%, 15%)',
        borderWidth: 1,
      }
    },
    elements: {
      point: { radius: 0 },
      line: { stepped: true }
    }
  };

  ngOnInit() {
    this.subs.push(
      this.route.params.pipe(
        switchMap(params => {
          const id = parseInt(params['id'], 10);
          if (!id) return EMPTY;
          return this.cameraService.getCamera(id);
        })
      ).subscribe({
        next: cam => {
          this.camera.set(cam);
          this.isLoading.set(false);
          this.setupPolling(cam);
        },
        error: () => {
          this.isLoading.set(false);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  onYoloStats(stats: YoloStats) {
    this.yoloStats.set(stats);
  }

  getPersonCount(): number {
    return this.yoloStats()?.personCount ?? this.snapshot()?.personCount ?? 0;
  }

  getComplianceRate(): number {
    return this.yoloStats()?.complianceRate ?? this.snapshot()?.complianceRate ?? 0;
  }

  private setupPolling(cam: Camera) {
    if (cam.status === 'active') {
      this.subs.push(
        this.cameraService.pollCameraSnapshot(cam.id, 2000).subscribe({
          next: snap => this.snapshot.set(snap),
          error: () => {}
        })
      );
    }

    this.subs.push(
      this.analyticsService.pollAnalyticsHistory({ cameraId: cam.id, interval: 'minute' }, 60000).subscribe(data => {
        this.updateChart(data);
      })
    );
  }

  private updateChart(data: AnalyticsDataPoint[]) {
    if (!data.length) {
      this.lineChartData.set(null);
      return;
    }
    this.lineChartData.set({
      labels: data.map(d => formatTime(d.timestamp).substring(0, 5)),
      datasets: [{
        data: data.map(d => d.complianceRate),
        borderColor: 'hsl(190, 90%, 50%)',
        backgroundColor: 'transparent',
        borderWidth: 2,
      }]
    });
  }
}
