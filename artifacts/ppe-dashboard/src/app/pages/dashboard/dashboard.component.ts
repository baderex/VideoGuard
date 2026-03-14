import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AnalyticsService } from '../../services/analytics.service';
import { LiveAnalytics, AnalyticsDataPoint } from '../../lib/models';
import { getComplianceColor, formatTime } from '../../lib/utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, BaseChartDirective],
  template: `
    @if (isLoading()) {
      <div class="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div class="flex flex-col items-center text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-pulse-glow mb-4"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
          <p class="font-display tracking-widest uppercase">Initializing Core Systems...</p>
        </div>
      </div>
    } @else {
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-display font-bold text-foreground">COMMAND <span class="text-primary">CENTER</span></h1>
            <p class="text-sm text-muted-foreground font-mono mt-1">SYS_STATUS: ONLINE | LAST_SYNC: {{ currentTime() }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          @for (stat of statCards(); track stat.title) {
            <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative group" [class]="stat.glow">
              <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
              <div class="relative z-10">
                <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span [innerHTML]="stat.iconLg" [class]="stat.color"></span>
                </div>
                <div class="p-6">
                  <div class="flex items-center justify-between mb-4">
                    <p class="text-sm font-display tracking-wider uppercase text-muted-foreground">{{ stat.title }}</p>
                    <span [innerHTML]="stat.iconSm" [class]="stat.color"></span>
                  </div>
                  <div class="text-3xl font-bold font-display">{{ stat.value }}</div>
                </div>
              </div>
            </div>
          }
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative flex flex-col">
            <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
            <div class="relative z-10 flex flex-col flex-1">
              <div class="flex flex-col space-y-1.5 p-6">
                <h3 class="font-display font-semibold leading-none tracking-wider text-primary">System Compliance Trend (24H)</h3>
              </div>
              <div class="p-6 pt-0 flex-1 min-h-[300px]">
                @if (chartData()) {
                  <canvas baseChart
                    [data]="chartData()!"
                    [options]="chartOptions"
                    type="line"
                    class="w-full h-full"
                  ></canvas>
                } @else {
                  <div class="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                    AWAITING_TELEMETRY_DATA...
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative flex flex-col">
            <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
            <div class="relative z-10 flex flex-col flex-1">
              <div class="flex flex-col space-y-1.5 p-6">
                <h3 class="font-display font-semibold leading-none tracking-wider text-primary">Active Feeds</h3>
              </div>
              <div class="p-6 pt-0 flex-1 overflow-y-auto pr-2 space-y-3">
                @for (snap of liveData()?.cameraSnapshots; track snap.cameraId) {
                  <a [routerLink]="['/cameras', snap.cameraId]" class="block">
                    <div class="p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-white/5 transition-colors group cursor-pointer relative overflow-hidden">
                      <div class="flex justify-between items-center mb-2">
                        <div class="font-display font-semibold tracking-wider text-sm">CAM-{{ snap.cameraId.toString().padStart(3, '0') }}</div>
                        <div class="text-xs font-mono px-1.5 py-0.5 rounded" [class]="getComplianceColor(snap.complianceRate)">
                          {{ Math.round(snap.complianceRate) }}% COMP
                        </div>
                      </div>
                      <div class="flex justify-between text-xs text-muted-foreground">
                        <span>Targets: <span class="text-foreground">{{ snap.personCount }}</span></span>
                        <span>Violations: <span class="text-destructive">{{ snap.nonCompliantCount }}</span></span>
                      </div>
                    </div>
                  </a>
                } @empty {
                  <div class="text-center py-8 text-muted-foreground font-mono text-xs">
                    NO_ACTIVE_FEEDS_DETECTED
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  private analyticsService = inject(AnalyticsService);
  private subs: Subscription[] = [];

  isLoading = signal(true);
  liveData = signal<LiveAnalytics | null>(null);
  historyData = signal<AnalyticsDataPoint[]>([]);

  Math = Math;
  getComplianceColor = getComplianceColor;

  currentTime = signal(new Date().toLocaleTimeString());

  chartData = signal<ChartConfiguration<'line'>['data'] | null>(null);

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: 'hsl(215, 20%, 65%)', maxTicksLimit: 8 },
        grid: { color: 'hsl(224, 71%, 15%)', drawTicks: false },
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          color: 'hsl(215, 20%, 65%)',
          callback: (v) => `${v}%`
        },
        grid: { color: 'hsl(224, 71%, 15%)', drawTicks: false },
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
      line: { tension: 0.4 }
    }
  };

  statCards = signal<Array<{
    title: string;
    value: string | number;
    color: string;
    glow: string;
    iconSm: string;
    iconLg: string;
  }>>([]);

  ngOnInit() {
    this.subs.push(
      this.analyticsService.pollLiveAnalytics(5000).subscribe(data => {
        this.liveData.set(data);
        this.isLoading.set(false);
        this.currentTime.set(new Date().toLocaleTimeString());
        this.updateStatCards(data);
      })
    );

    this.subs.push(
      this.analyticsService.pollAnalyticsHistory({ interval: 'hour' }, 60000).subscribe(data => {
        this.historyData.set(data);
        this.updateChart(data);
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  private updateStatCards(data: LiveAnalytics) {
    const compColor = data.overallComplianceRate >= 90 ? 'text-success' : data.overallComplianceRate >= 70 ? 'text-warning' : 'text-destructive';

    const cameraIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';
    const usersIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    const shieldIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12l2 2 4-4"/></svg>';
    const alertIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

    const makeLg = (svg: string) => svg.replace('width="20" height="20"', 'width="64" height="64"');

    this.statCards.set([
      {
        title: 'Active Cameras',
        value: `${data.activeCameras} / ${data.totalCameras}`,
        color: 'text-primary',
        glow: 'shadow-[0_0_20px_rgba(0,255,255,0.15)]',
        iconSm: cameraIcon,
        iconLg: makeLg(cameraIcon),
      },
      {
        title: 'Total Detections',
        value: data.totalPersonsDetected,
        color: 'text-accent',
        glow: 'shadow-[0_0_20px_rgba(153,50,204,0.15)]',
        iconSm: usersIcon,
        iconLg: makeLg(usersIcon),
      },
      {
        title: 'System Compliance',
        value: `${Math.round(data.overallComplianceRate)}%`,
        color: compColor,
        glow: 'shadow-[0_0_20px_rgba(0,255,0,0.15)]',
        iconSm: shieldIcon,
        iconLg: makeLg(shieldIcon),
      },
      {
        title: 'Active Alerts',
        value: data.openAlerts,
        color: data.openAlerts > 0 ? 'text-destructive' : 'text-muted-foreground',
        glow: data.openAlerts > 0 ? 'shadow-[0_0_20px_rgba(255,0,0,0.2)] border-destructive/30' : '',
        iconSm: alertIcon,
        iconLg: makeLg(alertIcon),
      }
    ]);
  }

  private updateChart(data: AnalyticsDataPoint[]) {
    if (!data.length) {
      this.chartData.set(null);
      return;
    }

    this.chartData.set({
      labels: data.map(d => formatTime(d.timestamp).substring(0, 5)),
      datasets: [{
        data: data.map(d => d.complianceRate),
        borderColor: 'hsl(190, 90%, 50%)',
        backgroundColor: 'hsla(190, 90%, 50%, 0.15)',
        fill: true,
        borderWidth: 2,
      }]
    });
  }
}
