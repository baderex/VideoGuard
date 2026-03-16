import { Component, inject, OnInit, signal, computed } from '@angular/core';
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
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-display font-bold text-foreground flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3 text-destructive"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          INCIDENT <span class="text-destructive ml-2">LOG</span>
        </h1>
        <p class="text-sm text-muted-foreground mt-1">Review and resolve safety compliance violations</p>
      </div>

      <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative">
        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
        <div class="relative z-10">
          <div class="p-4 border-b border-border/50 flex gap-2">
            @for (filter of filterOptions; track filter.value) {
              <button (click)="setFilter(filter.value)"
                class="inline-flex items-center justify-center rounded-md text-sm font-semibold font-display tracking-wider uppercase h-9 px-3 transition-all"
                [class]="statusFilter() === filter.value ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,255,255,0.3)]' : 'border border-primary/50 bg-transparent text-primary hover:bg-primary/10'">
                {{ filter.label }}
              </button>
            }
          </div>

          <div class="p-0 overflow-x-auto">
            <table class="w-full caption-bottom text-sm">
              <thead class="bg-background/50">
                <tr class="border-b border-border/50 hover:bg-transparent">
                  <th class="h-12 px-4 text-left font-display tracking-wider text-muted-foreground">SEVERITY</th>
                  <th class="h-12 px-4 text-left font-display tracking-wider text-muted-foreground">TIME</th>
                  <th class="h-12 px-4 text-left font-display tracking-wider text-muted-foreground">NODE</th>
                  <th class="h-12 px-4 text-left font-display tracking-wider text-muted-foreground">MESSAGE</th>
                  <th class="h-12 px-4 text-left font-display tracking-wider text-muted-foreground">STATUS</th>
                  <th class="h-12 px-4 text-right font-display tracking-wider text-muted-foreground">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                @if (!isLoading() && alerts().length === 0) {
                  <tr>
                    <td colspan="6" class="text-center py-10 text-muted-foreground font-mono p-4">
                      NO_INCIDENTS_FOUND
                    </td>
                  </tr>
                }
                @for (alert of alerts(); track alert.id) {
                  <tr class="border-b border-border/50 group hover:bg-white/5">
                    <td class="p-4">
                      <div class="flex flex-col gap-1">
                        <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider font-display"
                          [class]="getSeverityClasses(alert.severity)">
                          {{ alert.severity | uppercase }}
                        </span>
                        <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider"
                          [class]="getTypeBadgeClass(alert.type)">
                          {{ getTypeLabel(alert.type) }}
                        </span>
                      </div>
                    </td>
                    <td class="p-4 font-mono text-xs whitespace-nowrap text-muted-foreground">{{ formatDateTime(alert.createdAt) }}</td>
                    <td class="p-4 font-display tracking-wider">{{ alert.cameraName }}</td>
                    <td class="p-4">
                      <span class="text-sm">{{ alert.message }}</span>
                      @if (alert.missingPpe && alert.missingPpe.length > 0) {
                        <div class="text-xs text-destructive mt-1 font-mono">MISSING: {{ alert.missingPpe.join(', ') }}</div>
                      }
                      @if (alert.screenshotUrl) {
                        <button (click)="screenshotModal.set(alert.screenshotUrl)"
                          class="mt-2 block relative group/thumb">
                          <img [src]="alert.screenshotUrl" alt="Violation screenshot"
                            class="h-16 w-28 object-cover rounded border border-destructive/40 hover:border-destructive transition-all" />
                          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                          </div>
                        </button>
                      }
                    </td>
                    <td class="p-4">
                      <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider font-display"
                        [class]="getStatusClasses(alert.status)">
                        {{ alert.status }}
                      </span>
                    </td>
                    <td class="p-4 text-right whitespace-nowrap">
                      @if (alert.status === 'open') {
                        <button (click)="acknowledgeAlert(alert.id)"
                          class="inline-flex items-center justify-center rounded-md text-sm font-semibold font-display tracking-wider uppercase h-9 px-3 border border-primary/50 bg-transparent text-primary hover:bg-primary/10 transition-all mr-2">
                          ACKNOWLEDGE
                        </button>
                      }
                      @if (alert.status !== 'resolved') {
                        <button (click)="resolveAlert(alert.id)"
                          class="inline-flex items-center justify-center rounded-md text-sm font-semibold font-display tracking-wider uppercase h-9 px-3 bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 text-success border-success/30 hover:bg-success/10 hover:text-success transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                          RESOLVE
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    @if (screenshotModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="screenshotModal.set(null)">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        <div class="relative z-10 max-w-3xl w-full rounded-xl border border-destructive/40 bg-card overflow-hidden shadow-[0_0_60px_rgba(255,0,0,0.2)]"
          (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80">
            <div class="flex items-center gap-2 text-sm font-display tracking-wider">
              <div class="w-2 h-2 rounded-full bg-destructive animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.8)]"></div>
              <span class="text-destructive">VIOLATION SCREENSHOT</span>
            </div>
            <button (click)="screenshotModal.set(null)"
              class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="p-2 bg-black">
            <img [src]="screenshotModal()!" alt="Violation screenshot" class="w-full rounded object-contain max-h-[70vh]" />
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

  formatDateTime = formatDateTime;

  filterOptions = [
    { label: 'All', value: undefined as AlertStatus | undefined },
    { label: 'Open', value: AlertStatus.open as AlertStatus | undefined },
    { label: 'Acknowledged', value: AlertStatus.acknowledged as AlertStatus | undefined },
    { label: 'Resolved', value: AlertStatus.resolved as AlertStatus | undefined },
  ];

  ngOnInit() {
    this.loadAlerts();
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

  acknowledgeAlert(id: number) {
    this.alertService.acknowledgeAlert(id).subscribe({
      next: () => {
        this.toastService.show('Alert acknowledged', 'success');
        this.loadAlerts();
      },
      error: () => this.toastService.show('Failed to acknowledge alert', 'error')
    });
  }

  resolveAlert(id: number) {
    this.alertService.resolveAlert(id).subscribe({
      next: () => {
        this.toastService.show('Alert resolved', 'success');
        this.loadAlerts();
      },
      error: () => this.toastService.show('Failed to resolve alert', 'error')
    });
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      fall_detected:      'FALL',
      red_zone_intrusion: 'ZONE',
      missing_ppe:        'PPE',
      fire_detected:      'FIRE',
      smoke_detected:     'SMOKE',
      camera_offline:     'OFFLINE',
      low_compliance:     'COMPLIANCE',
    };
    return labels[type] ?? type.toUpperCase().replace(/_/g, ' ');
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'fire_detected':      return 'border-red-500/80 bg-red-500/20 text-red-400 animate-pulse';
      case 'smoke_detected':     return 'border-slate-400/60 bg-slate-500/15 text-slate-300';
      case 'fall_detected':      return 'border-red-500/60 bg-red-500/15 text-red-400';
      case 'red_zone_intrusion': return 'border-orange-500/60 bg-orange-500/15 text-orange-400';
      case 'missing_ppe':        return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400';
      default:                   return 'border-border/50 bg-white/5 text-muted-foreground';
    }
  }

  getSeverityClasses(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return 'border-destructive/50 bg-destructive/10 text-destructive shadow-[0_0_10px_rgba(255,0,0,0.8)] animate-pulse';
      case 'high': return 'border-warning/50 bg-warning/10 text-warning shadow-[0_0_10px_rgba(255,165,0,0.2)]';
      case 'medium': return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
      default: return 'border-secondary-foreground/20 bg-secondary text-secondary-foreground';
    }
  }

  getStatusClasses(status: AlertStatus): string {
    switch (status) {
      case 'resolved': return 'border-success/50 bg-success/10 text-success shadow-[0_0_10px_rgba(0,255,0,0.2)]';
      case 'acknowledged': return 'border-warning/50 bg-warning/10 text-warning shadow-[0_0_10px_rgba(255,165,0,0.2)]';
      default: return 'text-foreground';
    }
  }
}
