import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { format } from 'date-fns';
import { AnalyticsService } from '../../services/analytics.service';
import { DailyReport } from '../../lib/models';
import { getComplianceColor, ppeLabelMap } from '../../lib/utils';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, BaseChartDirective],
  template: `
    <div class="space-y-6">
      <div class="flex sm:items-center justify-between flex-col sm:flex-row gap-4">
        <div>
          <h1 class="text-3xl font-display font-bold text-foreground flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3 text-primary"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
            ANALYTICS <span class="text-primary ml-2">REPORT</span>
          </h1>
          <p class="text-sm text-muted-foreground mt-1">Historical compliance data and violation breakdown</p>
        </div>
        
        <div class="flex items-center bg-card border border-border/50 rounded-lg px-3 py-2 shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary mr-2"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
          <input
            type="date"
            [ngModel]="date()"
            (ngModelChange)="onDateChange($event)"
            class="bg-transparent text-sm font-mono text-foreground focus:outline-none [color-scheme:dark]"
          />
        </div>
      </div>

      @if (isLoading()) {
        <div class="h-64 flex items-center justify-center text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-pulse"><path d="m22 12-2.3-2.3"/><path d="M2 12h4"/><path d="M12 2v4"/><path d="m19.07 4.93-1.41 1.41"/><path d="m4.93 19.07 1.41-1.41"/><path d="M12 18v4"/><path d="m4.93 4.93 1.41 1.41"/><path d="m19.07 19.07-1.41-1.41"/></svg>
        </div>
      } @else if (!report()) {
        <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md p-10 text-center text-muted-foreground font-mono">NO_DATA_FOR_SELECTED_CYCLE</div>
      } @else {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative">
            <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
            <div class="relative z-10 p-6">
              <p class="text-xs font-display tracking-wider text-muted-foreground">AVG COMPLIANCE</p>
              <p class="text-3xl font-bold font-mono mt-2" [class]="getComplianceColor(report()!.averageComplianceRate).split(' ')[0]">
                {{ Math.round(report()!.averageComplianceRate) }}%
              </p>
            </div>
          </div>
          <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative">
            <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
            <div class="relative z-10 p-6">
              <p class="text-xs font-display tracking-wider text-muted-foreground">TOTAL SCANS</p>
              <p class="text-3xl font-bold font-mono mt-2 text-foreground">{{ report()!.totalPersonDetections }}</p>
            </div>
          </div>
          <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative">
            <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
            <div class="relative z-10 p-6">
              <p class="text-xs font-display tracking-wider text-muted-foreground">UNIQUE VIOLATIONS</p>
              <p class="text-3xl font-bold font-mono mt-2 text-destructive">{{ report()!.uniqueViolations }}</p>
            </div>
          </div>
          <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative">
            <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
            <div class="relative z-10 p-6">
              <p class="text-xs font-display tracking-wider text-muted-foreground">PEAK TRAFFIC HR</p>
              <p class="text-3xl font-bold font-mono mt-2 text-accent">{{ report()!.peakHour }}</p>
              <p class="text-xs text-muted-foreground mt-1">{{ report()!.peakPersonCount }} subjects</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative">
            <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
            <div class="relative z-10">
              <div class="flex flex-col space-y-1.5 p-6">
                <h3 class="font-display font-semibold leading-none tracking-wider text-primary">Top Violation Categories</h3>
              </div>
              <div class="p-6 pt-0 h-80">
                @if (violationsChartData()) {
                  <canvas baseChart
                    [data]="violationsChartData()!"
                    [options]="violationsChartOptions"
                    type="bar"
                  ></canvas>
                }
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg shadow-black/20 overflow-hidden relative">
            <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] pointer-events-none opacity-50"></div>
            <div class="relative z-10">
              <div class="flex flex-col space-y-1.5 p-6">
                <h3 class="font-display font-semibold leading-none tracking-wider text-primary">Hourly Volume vs Compliance</h3>
              </div>
              <div class="p-6 pt-0 h-80">
                @if (hourlyChartData()) {
                  <canvas baseChart
                    [data]="hourlyChartData()!"
                    [options]="hourlyChartOptions"
                    type="bar"
                  ></canvas>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ReportsComponent implements OnInit {
  private analyticsService = inject(AnalyticsService);

  date = signal(format(new Date(), 'yyyy-MM-dd'));
  report = signal<DailyReport | null>(null);
  isLoading = signal(true);

  violationsChartData = signal<ChartConfiguration<'bar'>['data'] | null>(null);
  hourlyChartData = signal<ChartConfiguration<'bar'>['data'] | null>(null);

  Math = Math;
  getComplianceColor = getComplianceColor;

  violationsChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: {
        ticks: { color: 'hsl(215, 20%, 65%)' },
        grid: { color: 'hsl(224, 71%, 15%)' },
      },
      y: {
        ticks: { color: 'hsl(215, 20%, 65%)' },
        grid: { display: false },
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'hsl(224, 71%, 8%)',
        borderColor: 'hsl(224, 71%, 15%)',
        borderWidth: 1,
      }
    }
  };

  hourlyChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: 'hsl(215, 20%, 65%)' },
        grid: { color: 'hsl(224, 71%, 15%)' },
      },
      'y-left': {
        type: 'linear',
        position: 'left',
        ticks: { color: 'hsl(215, 20%, 65%)' },
        grid: { color: 'hsl(224, 71%, 15%)' },
      },
      'y-right': {
        type: 'linear',
        position: 'right',
        min: 0,
        max: 100,
        ticks: {
          color: 'hsl(190, 90%, 50%)',
          callback: (v) => `${v}%`
        },
        grid: { drawOnChartArea: false },
      }
    },
    plugins: {
      legend: { display: true, labels: { color: 'hsl(215, 20%, 65%)' } },
      tooltip: {
        backgroundColor: 'hsl(224, 71%, 8%)',
        borderColor: 'hsl(224, 71%, 15%)',
        borderWidth: 1,
      }
    }
  };

  ngOnInit() {
    this.loadReport();
  }

  onDateChange(newDate: string) {
    this.date.set(newDate);
    this.loadReport();
  }

  private loadReport() {
    this.isLoading.set(true);
    this.analyticsService.getDailyReport(this.date()).subscribe({
      next: data => {
        this.report.set(data);
        this.updateCharts(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.report.set(null);
        this.isLoading.set(false);
      }
    });
  }

  private updateCharts(data: DailyReport) {
    if (data.topViolations?.length) {
      this.violationsChartData.set({
        labels: data.topViolations.map(v => ppeLabelMap[v.ppe] || v.ppe),
        datasets: [{
          data: data.topViolations.map(v => v.count),
          backgroundColor: 'hsla(348, 83%, 47%, 0.8)',
          borderRadius: 4,
        }]
      });
    }

    if (data.hourlyData?.length) {
      this.hourlyChartData.set({
        labels: data.hourlyData.map(h => format(new Date(h.timestamp), 'HH:mm')),
        datasets: [
          {
            label: 'Total Detected',
            data: data.hourlyData.map(h => h.personCount),
            backgroundColor: 'hsla(270, 90%, 60%, 0.6)',
            borderRadius: 4,
            yAxisID: 'y-left',
          },
          {
            label: 'Compliance %',
            data: data.hourlyData.map(h => h.complianceRate),
            backgroundColor: 'hsl(190, 90%, 50%)',
            borderRadius: 4,
            yAxisID: 'y-right',
          }
        ]
      });
    }
  }
}
