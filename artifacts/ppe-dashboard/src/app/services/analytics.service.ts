import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timer, switchMap, shareReplay } from 'rxjs';
import { LiveAnalytics, AnalyticsDataPoint, DailyReport } from '../lib/models';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private http: HttpClient) {}

  getLiveAnalytics(): Observable<LiveAnalytics> {
    return this.http.get<LiveAnalytics>('/api/analytics/live');
  }

  pollLiveAnalytics(intervalMs = 5000): Observable<LiveAnalytics> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getLiveAnalytics()),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  getAnalyticsHistory(params: {
    cameraId?: number;
    interval?: 'minute' | 'hour' | 'day';
  }): Observable<AnalyticsDataPoint[]> {
    let httpParams = new HttpParams();
    if (params.cameraId != null) httpParams = httpParams.set('cameraId', params.cameraId);
    if (params.interval) httpParams = httpParams.set('interval', params.interval);
    return this.http.get<AnalyticsDataPoint[]>('/api/analytics/history', { params: httpParams });
  }

  pollAnalyticsHistory(params: {
    cameraId?: number;
    interval?: 'minute' | 'hour' | 'day';
  }, intervalMs = 60000): Observable<AnalyticsDataPoint[]> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getAnalyticsHistory(params)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  getDailyReport(date?: string): Observable<DailyReport> {
    let httpParams = new HttpParams();
    if (date) httpParams = httpParams.set('date', date);
    return this.http.get<DailyReport>('/api/reports/daily', { params: httpParams });
  }
}
