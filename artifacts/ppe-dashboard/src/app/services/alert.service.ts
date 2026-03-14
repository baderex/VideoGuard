import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AlertListResponse, AlertStatus } from '../lib/models';

@Injectable({ providedIn: 'root' })
export class AlertService {
  constructor(private http: HttpClient) {}

  listAlerts(params: { status?: AlertStatus; limit?: number; offset?: number }): Observable<AlertListResponse> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.limit != null) httpParams = httpParams.set('limit', params.limit);
    if (params.offset != null) httpParams = httpParams.set('offset', params.offset);
    return this.http.get<AlertListResponse>('/api/alerts', { params: httpParams });
  }

  acknowledgeAlert(alertId: number): Observable<unknown> {
    return this.http.post(`/api/alerts/${alertId}/acknowledge`, {});
  }

  resolveAlert(alertId: number): Observable<unknown> {
    return this.http.post(`/api/alerts/${alertId}/resolve`, {});
  }
}
