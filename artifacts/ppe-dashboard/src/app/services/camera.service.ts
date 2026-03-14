import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, switchMap, shareReplay } from 'rxjs';
import { Camera, CreateCameraRequest, UpdateCameraRequest, DetectionSnapshot } from '../lib/models';

@Injectable({ providedIn: 'root' })
export class CameraService {
  constructor(private http: HttpClient) {}

  listCameras(): Observable<Camera[]> {
    return this.http.get<Camera[]>('/api/cameras');
  }

  pollCameras(intervalMs = 10000): Observable<Camera[]> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.listCameras()),
      shareReplay(1)
    );
  }

  getCamera(id: number): Observable<Camera> {
    return this.http.get<Camera>(`/api/cameras/${id}`);
  }

  createCamera(data: CreateCameraRequest): Observable<Camera> {
    return this.http.post<Camera>('/api/cameras', data);
  }

  updateCamera(id: number, data: UpdateCameraRequest): Observable<Camera> {
    return this.http.patch<Camera>(`/api/cameras/${id}`, data);
  }

  getCameraSnapshot(id: number): Observable<DetectionSnapshot> {
    return this.http.get<DetectionSnapshot>(`/api/cameras/${id}/snapshot`);
  }

  pollCameraSnapshot(id: number, intervalMs = 2000): Observable<DetectionSnapshot> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getCameraSnapshot(id)),
      shareReplay(1)
    );
  }
}
