import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AnalyticsService } from '../../services/analytics.service';
import { AlertService } from '../../services/alert.service';
import { LiveAnalytics, AnalyticsDataPoint, Alert } from '../../lib/models';
import { getComplianceColor, formatTime } from '../../lib/utils';

const ALERT_TYPE_LABELS: Record<string, string> = {
  fall_detected:      'Fall',
  red_zone_intrusion: 'Zone Intrusion',
  missing_ppe:        'Missing PPE',
  fire_detected:      'Fire',
  smoke_detected:     'Smoke',
  camera_offline:     'Camera Offline',
  low_compliance:     'Low Compliance',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, BaseChartDirective],
  template: `
    @if (isLoading()) {
      <div class="flex items-center justify-center h-[calc(100vh-10rem)]">
        <div class="flex flex-col items-center gap-4 text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-pulse"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
          <p class="font-display tracking-widest text-sm uppercase">Initializing Core Systems...</p>
        </div>
      </div>
    } @else {
      <div class="space-y-5">

        <!-- Page header -->
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-2xl font-display font-bold text-foreground tracking-wider">
              COMMAND <span class="text-primary">CENTER</span>
            </h1>
            <p class="text-xs text-muted-foreground font-mono mt-1 flex items-center gap-2">
              <span class="inline-flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                LIVE
              </span>
              <span class="text-border/60">·</span>
              SYNC {{ currentTime() }}
            </p>
          </div>
        </div>

        <!-- KPI cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          @for (stat of statCards(); track stat.title) {
            <div class="rounded-xl border bg-card/70 backdrop-blur-md shadow-md overflow-hidden relative group transition-all duration-300 hover:-translate-y-0.5"
              [class]="stat.cardClass">
              <div class="absolute inset-0 pointer-events-none"
                [class]="stat.topGlow"></div>
              <div class="p-5 relative z-10">
                <div class="flex items-start justify-between mb-3">
                  <p class="text-[10px] font-display tracking-[0.15em] uppercase text-muted-foreground leading-tight">
                    {{ stat.title }}
                  </p>
                  <span [innerHTML]="stat.iconSm" [class]="'opacity-70 ' + stat.color"></span>
                </div>
                <div class="text-3xl font-bold font-display" [class]="stat.color">
                  {{ stat.value }}
                </div>
                @if (stat.sub) {
                  <p class="text-[10px] font-mono text-muted-foreground/70 mt-1.5">{{ stat.sub }}</p>
                }
              </div>
              <!-- Left accent bar -->
              <div class="absolute left-0 top-0 w-0.5 h-full rounded-r opacity-60"
                [class]="stat.accentBar"></div>
            </div>
          }
        </div>

        <!-- Charts + feeds -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

          <!-- Compliance trend chart -->
          <div class="lg:col-span-2 rounded-xl border border-border/40 bg-card/70 backdrop-blur-md shadow-md flex flex-col overflow-hidden">
            <div class="px-5 pt-5 pb-3 flex items-center justify-between border-b border-border/30">
              <div>
                <h3 class="font-display font-bold tracking-wider text-sm text-foreground uppercase">Compliance Trend</h3>
                <p class="text-[10px] font-mono text-muted-foreground/60 mt-0.5">24-hour rolling window</p>
              </div>
              <span class="text-[10px] font-mono px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">24H</span>
            </div>
            <div class="flex-1 min-h-[260px] p-5 pt-4">
              @if (chartData()) {
                <canvas baseChart
                  [data]="chartData()!"
                  [options]="chartOptions"
                  type="line"
                  class="w-full h-full"
                ></canvas>
              } @else {
                <div class="h-full flex items-center justify-center text-muted-foreground/50 font-mono text-xs">
                  AWAITING TELEMETRY...
                </div>
              }
            </div>
          </div>

          <!-- Live feeds panel -->
          <div class="rounded-xl border border-border/40 bg-card/70 backdrop-blur-md shadow-md flex flex-col overflow-hidden">
            <div class="px-5 pt-5 pb-3 border-b border-border/30 flex items-center justify-between">
              <div>
                <h3 class="font-display font-bold tracking-wider text-sm text-foreground uppercase">Live Feeds</h3>
                <p class="text-[10px] font-mono text-muted-foreground/60 mt-0.5">Camera compliance status</p>
              </div>
              <div class="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_6px_rgba(0,255,0,0.7)]"></div>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-2">
              @for (snap of liveData()?.cameraSnapshots; track snap.cameraId) {
                <a [routerLink]="['/cameras', snap.cameraId]"
                  class="block p-3 rounded-lg border border-border/30 bg-background/30 hover:bg-white/5 hover:border-primary/30 transition-all group cursor-pointer">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <div class="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_5px_rgba(0,255,0,0.8)] shrink-0"></div>
                      <span class="font-display font-semibold tracking-wider text-xs group-hover:text-primary transition-colors">
                        CAM-{{ snap.cameraId.toString().padStart(3, '0') }}
                      </span>
                    </div>
                    <span class="text-xs font-mono px-1.5 py-0.5 rounded-full"
                      [class]="getComplianceColor(snap.complianceRate)">
                      {{ Math.round(snap.complianceRate) }}%
                    </span>
                  </div>
                  <!-- Compliance bar -->
                  <div class="h-1 rounded-full bg-white/5 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700"
                      [style.width.%]="snap.complianceRate"
                      [class]="snap.complianceRate >= 90 ? 'bg-success' : snap.complianceRate >= 70 ? 'bg-warning' : 'bg-destructive'">
                    </div>
                  </div>
                  <div class="flex justify-between text-[10px] text-muted-foreground/60 font-mono mt-1.5">
                    <span>{{ snap.personCount }} detected</span>
                    <span class="text-destructive/80">{{ snap.nonCompliantCount }} violation{{ snap.nonCompliantCount !== 1 ? 's' : '' }}</span>
                  </div>
                </a>
              } @empty {
                <div class="flex flex-col items-center justify-center h-full py-8 text-muted-foreground/40 font-mono text-xs text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-3 opacity-40"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                  NO ACTIVE FEEDS
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Recent incidents -->
        <div class="rounded-xl border border-border/40 bg-card/70 backdrop-blur-md shadow-md overflow-hidden">
          <div class="px-5 pt-5 pb-3 border-b border-border/30 flex items-center justify-between">
            <div>
              <h3 class="font-display font-bold tracking-wider text-sm text-foreground uppercase">Recent Incidents</h3>
              <p class="text-[10px] font-mono text-muted-foreground/60 mt-0.5">Latest open violations</p>
            </div>
            <a routerLink="/alerts" class="text-[10px] font-display tracking-widest uppercase text-primary/70 hover:text-primary transition-colors flex items-center gap-1">
              View All
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </a>
          </div>
          <div class="divide-y divide-border/20">
            @if (recentAlerts().length === 0) {
              <div class="py-8 text-center text-muted-foreground/40 font-mono text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2 opacity-40"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12l2 2 4-4"/></svg>
                ALL CLEAR — NO OPEN INCIDENTS
              </div>
            }
            @for (alert of recentAlerts(); track alert.id) {
              <div class="flex items-center gap-4 px-5 py-3 hover:bg-white/3 transition-colors group">
                <!-- Severity dot -->
                <div class="shrink-0 w-2 h-2 rounded-full"
                  [class]="alert.severity === 'critical' ? 'bg-destructive shadow-[0_0_6px_rgba(255,0,0,0.8)] animate-pulse' : alert.severity === 'high' ? 'bg-warning shadow-[0_0_6px_rgba(255,165,0,0.6)]' : 'bg-orange-500'">
                </div>
                <!-- Type badge -->
                <span class="shrink-0 text-[9px] font-display uppercase tracking-widest px-2 py-0.5 rounded border"
                  [class]="getTypeClass(alert.type)">
                  {{ getTypeLabel(alert.type) }}
                </span>
                <!-- Message -->
                <p class="flex-1 text-xs text-muted-foreground truncate">{{ alert.message }}</p>
                <!-- Camera -->
                <span class="shrink-0 text-[10px] font-mono text-muted-foreground/50">{{ alert.cameraName }}</span>
                <!-- Time -->
                <span class="shrink-0 text-[10px] font-mono text-muted-foreground/40">{{ relativeTime(alert.createdAt) }}</span>
              </div>
            }
          </div>
        </div>

      </div>
    }
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  private analyticsService = inject(AnalyticsService);
  private alertService = inject(AlertService);
  private subs: Subscription[] = [];

  isLoading = signal(true);
  liveData = signal<LiveAnalytics | null>(null);
  recentAlerts = signal<Alert[]>([]);
  currentTime = signal(new Date().toLocaleTimeString());

  Math = Math;
  getComplianceColor = getComplianceColor;

  chartData = signal<ChartConfiguration<'line'>['data'] | null>(null);

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    scales: {
      x: {
        ticks: { color: 'hsl(215,20%,55%)', maxTicksLimit: 8, font: { family: 'monospace', size: 10 } },
        grid: { color: 'hsla(224,71%,15%,0.6)', drawTicks: false },
        border: { display: false },
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          color: 'hsl(215,20%,55%)',
          callback: (v) => `${v}%`,
          font: { family: 'monospace', size: 10 },
        },
        grid: { color: 'hsla(224,71%,15%,0.6)', drawTicks: false },
        border: { display: false },
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'hsl(224,71%,6%)',
        borderColor: 'hsl(224,71%,18%)',
        borderWidth: 1,
        titleFont: { family: 'monospace', size: 11 },
        bodyFont:  { family: 'monospace', size: 11 },
        callbacks: { label: (ctx: any) => ` ${(ctx.parsed?.y ?? 0).toFixed(1)}% compliance` }
      }
    },
    elements: {
      point: { radius: 0, hoverRadius: 4, hoverBorderWidth: 2 },
      line: { tension: 0.45 }
    }
  };

  statCards = signal<Array<{
    title: string;
    value: string | number;
    sub: string;
    color: string;
    cardClass: string;
    topGlow: string;
    accentBar: string;
    iconSm: string;
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
        this.updateChart(data);
      })
    );
    this.loadRecentAlerts();
    setInterval(() => this.loadRecentAlerts(), 30000);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  private loadRecentAlerts() {
    this.alertService.listAlerts({ status: 'open' as any, limit: 6 }).subscribe({
      next: d => this.recentAlerts.set(d.alerts),
    });
  }

  private updateStatCards(data: LiveAnalytics) {
    const comp = data.overallComplianceRate;
    const compColor = comp >= 90 ? 'text-success' : comp >= 70 ? 'text-warning' : 'text-destructive';
    const compCard  = comp >= 90 ? 'border-success/20 shadow-[0_0_20px_rgba(0,255,0,0.08)]'
                    : comp >= 70 ? 'border-warning/20 shadow-[0_0_20px_rgba(255,165,0,0.08)]'
                    : 'border-destructive/20 shadow-[0_0_20px_rgba(255,0,0,0.1)]';
    const compBar   = comp >= 90 ? 'bg-success' : comp >= 70 ? 'bg-warning' : 'bg-destructive';

    const cam = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
    const usr = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    const shd = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12l2 2 4-4"/></svg>`;
    const alt = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

    this.statCards.set([
      {
        title: 'Active Cameras',
        value: `${data.activeCameras}/${data.totalCameras}`,
        sub: `${data.totalCameras - data.activeCameras} offline`,
        color: 'text-primary',
        cardClass: 'border-primary/20 shadow-[0_0_20px_rgba(0,255,255,0.06)]',
        topGlow: 'bg-gradient-to-br from-primary/5 to-transparent',
        accentBar: 'bg-primary',
        iconSm: cam,
      },
      {
        title: 'Total Detections',
        value: data.totalPersonsDetected,
        sub: 'persons detected live',
        color: 'text-accent',
        cardClass: 'border-accent/20 shadow-[0_0_20px_rgba(153,50,204,0.06)]',
        topGlow: 'bg-gradient-to-br from-accent/5 to-transparent',
        accentBar: 'bg-accent',
        iconSm: usr,
      },
      {
        title: 'Compliance Rate',
        value: `${Math.round(comp)}%`,
        sub: comp >= 90 ? 'excellent — target met' : comp >= 70 ? 'below target' : 'critical — action needed',
        color: compColor,
        cardClass: compCard,
        topGlow: `bg-gradient-to-br ${comp >= 90 ? 'from-success/5' : comp >= 70 ? 'from-warning/5' : 'from-destructive/5'} to-transparent`,
        accentBar: compBar,
        iconSm: shd,
      },
      {
        title: 'Open Alerts',
        value: data.openAlerts,
        sub: data.openAlerts > 0 ? 'require attention' : 'all clear',
        color: data.openAlerts > 0 ? 'text-destructive' : 'text-muted-foreground',
        cardClass: data.openAlerts > 0 ? 'border-destructive/25 shadow-[0_0_20px_rgba(255,0,0,0.1)]' : 'border-border/40',
        topGlow: data.openAlerts > 0 ? 'bg-gradient-to-br from-destructive/5 to-transparent' : '',
        accentBar: data.openAlerts > 0 ? 'bg-destructive' : 'bg-border',
        iconSm: alt,
      }
    ]);
  }

  private updateChart(data: AnalyticsDataPoint[]) {
    if (!data.length) { this.chartData.set(null); return; }
    this.chartData.set({
      labels: data.map(d => formatTime(d.timestamp).substring(0, 5)),
      datasets: [{
        data: data.map(d => d.complianceRate),
        borderColor: 'hsl(190,90%,50%)',
        backgroundColor: (ctx: any) => {
          const grad = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          grad.addColorStop(0, 'hsla(190,90%,50%,0.25)');
          grad.addColorStop(1, 'hsla(190,90%,50%,0.02)');
          return grad;
        },
        fill: true,
        borderWidth: 2,
      }]
    });
  }

  getTypeLabel(type: string) {
    return ALERT_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
  }

  getTypeClass(type: string) {
    switch (type) {
      case 'fire_detected':      return 'border-red-500/60 bg-red-500/15 text-red-400';
      case 'smoke_detected':     return 'border-slate-400/50 bg-slate-500/10 text-slate-300';
      case 'fall_detected':      return 'border-red-500/50 bg-red-500/10 text-red-400';
      case 'red_zone_intrusion': return 'border-orange-400/50 bg-orange-500/10 text-orange-400';
      case 'missing_ppe':        return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400';
      default:                   return 'border-border/40 bg-white/5 text-muted-foreground';
    }
  }

  relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
}
