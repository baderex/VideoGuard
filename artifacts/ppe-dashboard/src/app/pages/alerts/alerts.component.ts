import { Component, inject, OnInit, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { AlertService } from '../../services/alert.service';
import { ToastService } from '../../services/toast.service';
import { Alert, AlertStatus, AlertSeverity } from '../../lib/models';
import { formatDateTime } from '../../lib/utils';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [UpperCasePipe],
  template: `
    <div class="space-y-5">

      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-display font-bold text-foreground tracking-wider flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-destructive shrink-0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            INCIDENT <span class="text-destructive ml-1">LOG</span>
          </h1>
          <p class="text-xs text-muted-foreground font-mono mt-1">Safety compliance violations — review, acknowledge, and resolve</p>
        </div>
        <!-- Refresh button -->
        <button (click)="loadAlerts()"
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 bg-card/50 hover:bg-white/5 text-muted-foreground hover:text-foreground text-xs font-display tracking-wider uppercase transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          Refresh
        </button>
      </div>

      <!-- Status summary cards -->
      <div class="grid grid-cols-3 gap-4">
        <div class="rounded-xl border border-destructive/20 bg-card/60 backdrop-blur-md p-4 relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent pointer-events-none"></div>
          <div class="absolute left-0 top-0 w-0.5 h-full bg-destructive opacity-60 rounded-r"></div>
          <p class="text-[10px] font-display uppercase tracking-widest text-muted-foreground">Open</p>
          <p class="text-3xl font-bold font-display text-destructive mt-1">{{ counts().open }}</p>
          <p class="text-[10px] font-mono text-muted-foreground/50 mt-0.5">require attention</p>
        </div>
        <div class="rounded-xl border border-warning/20 bg-card/60 backdrop-blur-md p-4 relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent pointer-events-none"></div>
          <div class="absolute left-0 top-0 w-0.5 h-full bg-warning opacity-60 rounded-r"></div>
          <p class="text-[10px] font-display uppercase tracking-widest text-muted-foreground">Acknowledged</p>
          <p class="text-3xl font-bold font-display text-warning mt-1">{{ counts().acknowledged }}</p>
          <p class="text-[10px] font-mono text-muted-foreground/50 mt-0.5">in progress</p>
        </div>
        <div class="rounded-xl border border-success/20 bg-card/60 backdrop-blur-md p-4 relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent pointer-events-none"></div>
          <div class="absolute left-0 top-0 w-0.5 h-full bg-success opacity-60 rounded-r"></div>
          <p class="text-[10px] font-display uppercase tracking-widest text-muted-foreground">Resolved</p>
          <p class="text-3xl font-bold font-display text-success mt-1">{{ counts().resolved }}</p>
          <p class="text-[10px] font-mono text-muted-foreground/50 mt-0.5">closed</p>
        </div>
      </div>

      <!-- Alerts table -->
      <div class="rounded-xl border border-border/40 bg-card/70 backdrop-blur-md shadow-md overflow-hidden">
        <!-- Filter tabs -->
        <div class="px-5 py-3.5 border-b border-border/30 flex gap-2 flex-wrap">
          @for (filter of filterOptions; track filter.label) {
            <button (click)="setFilter(filter.value)"
              class="inline-flex items-center gap-1.5 rounded-lg text-xs font-display tracking-wider uppercase h-8 px-3.5 transition-all"
              [class]="statusFilter() === filter.value
                ? 'bg-primary text-primary-foreground shadow-[0_0_12px_rgba(0,255,255,0.25)]'
                : 'border border-border/40 bg-transparent text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5'">
              @if (filter.value === 'open') {
                <span class="w-1.5 h-1.5 rounded-full bg-destructive" [class]="counts().open > 0 ? 'animate-pulse' : ''"></span>
              }
              {{ filter.label }}
              @if (filter.value !== undefined) {
                <span class="text-[9px] font-mono opacity-60">
                  ({{ filter.value === 'open' ? counts().open : filter.value === 'acknowledged' ? counts().acknowledged : counts().resolved }})
                </span>
              }
            </button>
          }
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border/25 bg-background/30">
                <th class="h-10 px-5 text-left text-[10px] font-display tracking-widest text-muted-foreground/70 uppercase font-medium">Severity / Type</th>
                <th class="h-10 px-4 text-left text-[10px] font-display tracking-widest text-muted-foreground/70 uppercase font-medium">Time</th>
                <th class="h-10 px-4 text-left text-[10px] font-display tracking-widest text-muted-foreground/70 uppercase font-medium">Camera</th>
                <th class="h-10 px-4 text-left text-[10px] font-display tracking-widest text-muted-foreground/70 uppercase font-medium">Incident</th>
                <th class="h-10 px-4 text-left text-[10px] font-display tracking-widest text-muted-foreground/70 uppercase font-medium">Status</th>
                <th class="h-10 px-5 text-right text-[10px] font-display tracking-widest text-muted-foreground/70 uppercase font-medium">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/15">
              @if (!isLoading() && alerts().length === 0) {
                <tr>
                  <td colspan="6" class="py-12 text-center text-muted-foreground/40 font-mono text-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3 opacity-40"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12l2 2 4-4"/></svg>
                    NO INCIDENTS FOUND
                  </td>
                </tr>
              }
              @if (isLoading()) {
                @for (i of [1,2,3,4,5]; track i) {
                  <tr class="border-b border-border/15">
                    <td colspan="6" class="p-4">
                      <div class="h-8 rounded bg-white/3 animate-pulse"></div>
                    </td>
                  </tr>
                }
              }
              @for (alert of alerts(); track alert.id) {
                <tr class="group hover:bg-white/3 transition-colors relative"
                  [class]="alert.severity === 'critical' ? 'bg-destructive/3' : alert.severity === 'high' ? 'bg-warning/2' : ''">
                  <!-- Severity left border -->
                  <td class="px-5 py-3.5 relative">
                    <div class="absolute left-0 top-0 w-0.5 h-full rounded-r opacity-70"
                      [class]="alert.severity === 'critical' ? 'bg-destructive' : alert.severity === 'high' ? 'bg-warning' : alert.severity === 'medium' ? 'bg-orange-500' : 'bg-border'">
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-display uppercase tracking-wider font-semibold"
                        [class]="getSeverityClasses(alert.severity)">
                        @if (alert.severity === 'critical') {
                          <span class="w-1 h-1 rounded-full bg-current animate-pulse"></span>
                        }
                        {{ alert.severity | uppercase }}
                      </span>
                      <span class="inline-flex items-center rounded border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider"
                        [class]="getTypeBadgeClass(alert.type)">
                        {{ getTypeLabel(alert.type) }}
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-3.5 font-mono text-[10px] text-muted-foreground/60 whitespace-nowrap">
                    <div>{{ formatDate(alert.createdAt) }}</div>
                    <div class="text-muted-foreground/40 mt-0.5">{{ relativeTime(alert.createdAt) }}</div>
                  </td>
                  <td class="px-4 py-3.5">
                    <span class="font-display tracking-wider text-xs text-foreground/80">{{ alert.cameraName }}</span>
                  </td>
                  <td class="px-4 py-3.5 max-w-[280px]">
                    <p class="text-xs text-foreground/80 leading-snug">{{ alert.message }}</p>
                    @if (alert.missingPpe && alert.missingPpe.length > 0) {
                      <div class="text-[10px] text-destructive/80 font-mono mt-1 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Missing: {{ alert.missingPpe.join(', ') }}
                      </div>
                    }
                    @if (alert.screenshotUrl) {
                      <button (click)="screenshotModal.set(alert.screenshotUrl)"
                        class="mt-2 block relative group/thumb rounded overflow-hidden border border-border/30 hover:border-destructive/50 transition-all">
                        <img [src]="alert.screenshotUrl" alt="Violation"
                          class="h-14 w-24 object-cover" />
                        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                        </div>
                      </button>
                    }
                  </td>
                  <td class="px-4 py-3.5">
                    <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-display uppercase tracking-wider font-semibold"
                      [class]="getStatusClasses(alert.status)">
                      {{ alert.status }}
                    </span>
                  </td>
                  <td class="px-5 py-3.5 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-2">
                      @if (alert.status === 'open') {
                        <button (click)="acknowledgeAlert(alert.id)"
                          class="inline-flex items-center gap-1 rounded-lg text-[10px] font-display tracking-wider uppercase h-7 px-2.5 border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                          ACK
                        </button>
                      }
                      @if (alert.status !== 'resolved') {
                        <button (click)="resolveAlert(alert.id)"
                          class="inline-flex items-center gap-1 rounded-lg text-[10px] font-display tracking-wider uppercase h-7 px-2.5 border border-success/30 text-success hover:bg-success/10 hover:border-success/50 transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/></svg>
                          Resolve
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Screenshot modal -->
    @if (screenshotModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="screenshotModal.set(null)">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-sm"></div>
        <div class="relative z-10 max-w-3xl w-full rounded-xl border border-destructive/30 bg-card overflow-hidden shadow-[0_0_80px_rgba(255,0,0,0.15)]"
          (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-background/60">
            <div class="flex items-center gap-2 text-xs font-display tracking-widest">
              <div class="w-2 h-2 rounded-full bg-destructive animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.8)]"></div>
              <span class="text-destructive uppercase">Violation Evidence</span>
            </div>
            <button (click)="screenshotModal.set(null)"
              class="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="p-3 bg-black/80">
            <img [src]="screenshotModal()!" alt="Violation" class="w-full rounded object-contain max-h-[70vh]" />
          </div>
        </div>
      </div>
    }
  `
})
export class AlertsComponent implements OnInit {
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);

  statusFilter = signal<AlertStatus | undefined>(undefined);
  alerts = signal<Alert[]>([]);
  isLoading = signal(true);
  screenshotModal = signal<string | null>(null);
  counts = signal({ open: 0, acknowledged: 0, resolved: 0 });

  formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  };

  filterOptions = [
    { label: 'All',           value: undefined as AlertStatus | undefined },
    { label: 'Open',          value: AlertStatus.open as AlertStatus | undefined },
    { label: 'Acknowledged',  value: AlertStatus.acknowledged as AlertStatus | undefined },
    { label: 'Resolved',      value: AlertStatus.resolved as AlertStatus | undefined },
  ];

  ngOnInit() {
    this.loadAlerts();
    this.loadCounts();
  }

  setFilter(status: AlertStatus | undefined) {
    this.statusFilter.set(status);
    this.loadAlerts();
  }

  loadAlerts() {
    this.isLoading.set(true);
    this.alertService.listAlerts({ status: this.statusFilter(), limit: 50 }).subscribe({
      next: data => {
        this.alerts.set(data.alerts);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  private loadCounts() {
    const statuses: AlertStatus[] = [AlertStatus.open, AlertStatus.acknowledged, AlertStatus.resolved];
    statuses.forEach(s => {
      this.alertService.listAlerts({ status: s, limit: 1 }).subscribe({
        next: d => this.counts.update(c => ({ ...c, [s]: d.total }))
      });
    });
  }

  acknowledgeAlert(id: number) {
    this.alertService.acknowledgeAlert(id).subscribe({
      next: () => {
        this.toastService.show('Alert acknowledged', 'success');
        this.loadAlerts();
        this.loadCounts();
      },
      error: () => this.toastService.show('Failed to acknowledge', 'error')
    });
  }

  resolveAlert(id: number) {
    this.alertService.resolveAlert(id).subscribe({
      next: () => {
        this.toastService.show('Alert resolved', 'success');
        this.loadAlerts();
        this.loadCounts();
      },
      error: () => this.toastService.show('Failed to resolve', 'error')
    });
  }

  relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
  }

  getTypeLabel(type: string): string {
    const labels: Record<string,string> = {
      fall_detected:      'FALL',
      red_zone_intrusion: 'ZONE',
      missing_ppe:        'PPE',
      fire_detected:      'FIRE',
      smoke_detected:     'SMOKE',
      camera_offline:     'OFFLINE',
      low_compliance:     'COMPLIANCE',
    };
    return labels[type] ?? type.toUpperCase().replace(/_/g,' ');
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'fire_detected':      return 'border-red-500/70 bg-red-500/15 text-red-400 animate-pulse';
      case 'smoke_detected':     return 'border-slate-400/50 bg-slate-500/10 text-slate-300';
      case 'fall_detected':      return 'border-red-500/50 bg-red-500/10 text-red-400';
      case 'red_zone_intrusion': return 'border-orange-400/50 bg-orange-500/10 text-orange-400';
      case 'missing_ppe':        return 'border-yellow-500/40 bg-yellow-500/8 text-yellow-400';
      default:                   return 'border-border/40 bg-white/4 text-muted-foreground';
    }
  }

  getSeverityClasses(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return 'border-destructive/50 bg-destructive/10 text-destructive shadow-[0_0_8px_rgba(255,0,0,0.5)]';
      case 'high':     return 'border-warning/50 bg-warning/10 text-warning';
      case 'medium':   return 'border-orange-500/40 bg-orange-500/10 text-orange-400';
      default:         return 'border-border/40 bg-white/5 text-muted-foreground';
    }
  }

  getStatusClasses(status: AlertStatus): string {
    switch (status) {
      case 'resolved':     return 'border-success/40 bg-success/10 text-success';
      case 'acknowledged': return 'border-warning/40 bg-warning/10 text-warning';
      default:             return 'border-border/40 bg-white/5 text-foreground/70';
    }
  }
}
