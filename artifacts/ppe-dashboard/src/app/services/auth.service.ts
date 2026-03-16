import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

export interface User {
  id: number;
  username: string;
  email?: string;
  role: 'admin' | 'support' | 'site_viewer';
  siteId?: number;
  siteName?: string;
}

const TOKEN_KEY = 'vg_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _user = signal<User | null>(null);
  private _loading = signal(true);

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly isAdmin = computed(() => this._user()?.role === 'admin');
  readonly isSupport = computed(() => this._user()?.role === 'support');
  readonly isSiteViewer = computed(() => this._user()?.role === 'site_viewer');

  constructor() {
    if (this._token()) {
      this.http.get<User>('/api/auth/me').subscribe({
        next: user => { this._user.set(user); this._loading.set(false); },
        error: () => { this.clearSession(); this._loading.set(false); },
      });
    } else {
      this._loading.set(false);
    }
  }

  login(username: string, password: string) {
    return this.http.post<{ token: string; user: User }>('/api/auth/login', { username, password }).pipe(
      tap(res => {
        localStorage.setItem(TOKEN_KEY, res.token);
        this._token.set(res.token);
        this._user.set(res.user);
      })
    );
  }

  logout() {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    this._token.set(null);
    this._user.set(null);
  }
}
