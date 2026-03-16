import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Zone } from '../lib/models';

@Injectable({ providedIn: 'root' })
export class ZoneService {
  private http = inject(HttpClient);
  getZones(cameraId: number): Observable<Zone[]> {
    return this.http.get<Zone[]>(`/api/cameras/${cameraId}/zones`);
  }

  createZone(cameraId: number, name: string, points: { x: number; y: number }[], color: string): Observable<Zone> {
    return this.http.post<Zone>(`/api/cameras/${cameraId}/zones`, { name, points, color });
  }

  deleteZone(cameraId: number, zoneId: number): Observable<unknown> {
    return this.http.delete(`/api/cameras/${cameraId}/zones/${zoneId}`);
  }

  toggleZone(cameraId: number, zoneId: number, active: boolean): Observable<Zone> {
    return this.http.put<Zone>(`/api/cameras/${cameraId}/zones/${zoneId}`, { active });
  }

  reloadZones(cameraId: number): Observable<unknown> {
    return this.http.post(`/api/cameras/${cameraId}/zones/reload`, {});
  }
}
