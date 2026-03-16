import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';

interface SiteOption { id: number; name: string; }
interface UserRow {
  id: number; username: string; email?: string;
  role: string; siteId?: number; siteName?: string;
  active: boolean; createdAt: string;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-display font-bold text-foreground flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3 text-primary"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            USER <span class="text-primary ml-2">MANAGEMENT</span>
          </h1>
          <p class="text-sm text-muted-foreground mt-1">Manage operator accounts and role assignments</p>
        </div>
        <button (click)="openCreate()"
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-display font-bold tracking-wider uppercase text-sm shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)] transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Add User
        </button>
      </div>

      <!-- Users table -->
      <div class="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md overflow-hidden shadow-lg shadow-black/20">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-background/50 border-b border-border/50">
              <tr>
                <th class="h-12 px-4 text-left font-display tracking-wider text-muted-foreground">USERNAME</th>
                <th class="h-12 px-4 text-left font-display tracking-wider text-muted-foreground">EMAIL</th>
                <th class="h-12 px-4 text-left font-display tracking-wider text-muted-foreground">ROLE</th>
                <th class="h-12 px-4 text-left font-display tracking-wider text-muted-foreground">SITE</th>
                <th class="h-12 px-4 text-left font-display tracking-wider text-muted-foreground">STATUS</th>
                <th class="h-12 px-4 text-right font-display tracking-wider text-muted-foreground">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr><td colspan="6" class="text-center py-10 text-muted-foreground font-mono text-xs">LOADING_USERS...</td></tr>
              }
              @for (u of users(); track u.id) {
                <tr class="border-b border-border/50 hover:bg-white/5 transition-colors">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-display font-bold text-xs">
                        {{ u.username[0].toUpperCase() }}
                      </div>
                      <span class="font-mono font-semibold">{{ u.username }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-muted-foreground font-mono text-xs">{{ u.email || '—' }}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider font-display"
                      [class]="getRoleBadge(u.role)">
                      {{ getRoleLabel(u.role) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-muted-foreground text-xs">{{ u.siteName || '—' }}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center gap-1 text-xs font-mono"
                      [class]="u.active ? 'text-success' : 'text-muted-foreground'">
                      <span class="w-1.5 h-1.5 rounded-full" [class]="u.active ? 'bg-success' : 'bg-muted-foreground'"></span>
                      {{ u.active ? 'ACTIVE' : 'INACTIVE' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button (click)="openEdit(u)"
                        class="px-3 py-1.5 rounded-md border border-primary/30 text-primary text-xs font-display tracking-wider hover:bg-primary/10 transition-colors">
                        EDIT
                      </button>
                      <button (click)="confirmDelete(u)"
                        class="px-3 py-1.5 rounded-md border border-destructive/30 text-destructive text-xs font-display tracking-wider hover:bg-destructive/10 transition-colors">
                        DELETE
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    @if (showModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="closeModal()">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="relative z-10 w-full max-w-md rounded-2xl border border-primary/30 bg-card shadow-[0_0_60px_rgba(0,255,255,0.1)] overflow-hidden"
          (click)="$event.stopPropagation()">
          <div class="px-6 py-4 border-b border-border/50 bg-background/60 flex items-center justify-between">
            <h3 class="font-display font-bold tracking-widest uppercase text-foreground">
              {{ editTarget() ? 'Edit User' : 'Create User' }}
            </h3>
            <button (click)="closeModal()" class="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <form (ngSubmit)="submitForm()" class="p-6 space-y-4">
            @if (!editTarget()) {
              <div>
                <label class="text-xs font-display tracking-widest uppercase text-muted-foreground mb-1.5 block">Username *</label>
                <input [(ngModel)]="form.username" name="username" type="text" required
                  class="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all font-mono" />
              </div>
            }

            <div>
              <label class="text-xs font-display tracking-widest uppercase text-muted-foreground mb-1.5 block">Email</label>
              <input [(ngModel)]="form.email" name="email" type="email"
                class="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all font-mono" />
            </div>

            <div>
              <label class="text-xs font-display tracking-widest uppercase text-muted-foreground mb-1.5 block">
                Password {{ editTarget() ? '(leave blank to keep)' : '*' }}
              </label>
              <input [(ngModel)]="form.password" name="password" type="password"
                [required]="!editTarget()"
                class="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all font-mono" />
            </div>

            <div>
              <label class="text-xs font-display tracking-widest uppercase text-muted-foreground mb-1.5 block">Role *</label>
              <select [(ngModel)]="form.role" name="role" required
                class="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-all font-mono">
                <option value="admin">Admin — Full access + user management</option>
                <option value="support">Support — View all sites, manage alerts</option>
                <option value="site_viewer">Site Viewer — Assigned site only</option>
              </select>
            </div>

            @if (form.role === 'site_viewer') {
              <div>
                <label class="text-xs font-display tracking-widest uppercase text-muted-foreground mb-1.5 block">Assigned Site *</label>
                <select [(ngModel)]="form.siteId" name="siteId"
                  class="w-full bg-background/50 border border-border/50 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-all font-mono">
                  <option [ngValue]="null">— Select a site —</option>
                  @for (s of sites(); track s.id) {
                    <option [ngValue]="s.id">{{ s.name }}</option>
                  }
                </select>
              </div>
            }

            @if (editTarget()) {
              <div class="flex items-center gap-3">
                <label class="text-xs font-display tracking-widest uppercase text-muted-foreground">Active</label>
                <button type="button" (click)="form.active = !form.active"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  [class]="form.active ? 'bg-primary' : 'bg-border'">
                  <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    [class]="form.active ? 'translate-x-6' : 'translate-x-1'"></span>
                </button>
              </div>
            }

            @if (formError()) {
              <div class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive font-mono">{{ formError() }}</div>
            }

            <div class="flex gap-3 pt-2">
              <button type="button" (click)="closeModal()"
                class="flex-1 py-2.5 rounded-lg border border-border/50 text-muted-foreground text-sm font-display tracking-wider hover:bg-white/5 transition-colors">
                CANCEL
              </button>
              <button type="submit" [disabled]="saving()"
                class="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-display font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)] disabled:opacity-50 transition-all">
                {{ saving() ? 'SAVING...' : (editTarget() ? 'UPDATE' : 'CREATE') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete confirm -->
    @if (deleteTarget()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="deleteTarget.set(null)">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="relative z-10 w-full max-w-sm rounded-2xl border border-destructive/40 bg-card shadow-[0_0_60px_rgba(255,0,0,0.15)] p-6"
          (click)="$event.stopPropagation()">
          <div class="text-center mb-5">
            <div class="w-12 h-12 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-destructive"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </div>
            <h3 class="font-display font-bold text-foreground tracking-wider">Delete User</h3>
            <p class="text-sm text-muted-foreground mt-1">Delete <span class="text-foreground font-mono font-semibold">{{ deleteTarget()?.username }}</span>? This cannot be undone.</p>
          </div>
          <div class="flex gap-3">
            <button (click)="deleteTarget.set(null)" class="flex-1 py-2.5 rounded-lg border border-border/50 text-muted-foreground text-sm font-display tracking-wider hover:bg-white/5">CANCEL</button>
            <button (click)="doDelete()" class="flex-1 py-2.5 rounded-lg bg-destructive text-white text-sm font-display font-bold tracking-wider hover:bg-destructive/90 transition-colors">DELETE</button>
          </div>
        </div>
      </div>
    }
  `
})
export class UserManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);

  users = signal<UserRow[]>([]);
  sites = signal<SiteOption[]>([]);
  loading = signal(true);
  showModal = signal(false);
  saving = signal(false);
  editTarget = signal<UserRow | null>(null);
  deleteTarget = signal<UserRow | null>(null);
  formError = signal('');

  form: { username: string; email: string; password: string; role: string; siteId: number | null; active: boolean } = {
    username: '', email: '', password: '', role: 'support', siteId: null, active: true,
  };

  ngOnInit() {
    this.loadUsers();
    this.http.get<{ sites: SiteOption[] }>('/api/sites').subscribe({
      next: d => this.sites.set(d.sites ?? []),
    });
  }

  loadUsers() {
    this.loading.set(true);
    this.http.get<{ users: UserRow[] }>('/api/users').subscribe({
      next: d => { this.users.set(d.users); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreate() {
    this.editTarget.set(null);
    this.form = { username: '', email: '', password: '', role: 'support', siteId: null, active: true };
    this.formError.set('');
    this.showModal.set(true);
  }

  openEdit(u: UserRow) {
    this.editTarget.set(u);
    this.form = { username: u.username, email: u.email ?? '', password: '', role: u.role, siteId: u.siteId ?? null, active: u.active };
    this.formError.set('');
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  submitForm() {
    this.formError.set('');
    if (this.form.role === 'site_viewer' && !this.form.siteId) {
      this.formError.set('Please select a site for site_viewer role.');
      return;
    }
    this.saving.set(true);
    const target = this.editTarget();

    if (target) {
      const body: Record<string, unknown> = { role: this.form.role, active: this.form.active };
      if (this.form.email) body['email'] = this.form.email;
      if (this.form.password) body['password'] = this.form.password;
      if (this.form.siteId) body['site_id'] = this.form.siteId;
      this.http.put(`/api/users/${target.id}`, body).subscribe({
        next: () => { this.toast.show('User updated', 'success'); this.closeModal(); this.loadUsers(); this.saving.set(false); },
        error: (e) => { this.formError.set(e.error?.detail ?? 'Update failed'); this.saving.set(false); },
      });
    } else {
      const body = { username: this.form.username, email: this.form.email || undefined, password: this.form.password, role: this.form.role, site_id: this.form.siteId || undefined };
      this.http.post('/api/users', body).subscribe({
        next: () => { this.toast.show('User created', 'success'); this.closeModal(); this.loadUsers(); this.saving.set(false); },
        error: (e) => { this.formError.set(e.error?.detail ?? 'Create failed'); this.saving.set(false); },
      });
    }
  }

  confirmDelete(u: UserRow) { this.deleteTarget.set(u); }

  doDelete() {
    const u = this.deleteTarget();
    if (!u) return;
    this.http.delete(`/api/users/${u.id}`).subscribe({
      next: () => { this.toast.show('User deleted', 'success'); this.deleteTarget.set(null); this.loadUsers(); },
      error: () => this.toast.show('Delete failed', 'error'),
    });
  }

  getRoleLabel(role: string): string {
    return { admin: 'Admin', support: 'Support', site_viewer: 'Site Viewer' }[role] ?? role;
  }

  getRoleBadge(role: string): string {
    switch (role) {
      case 'admin':       return 'border-primary/60 bg-primary/15 text-primary';
      case 'support':     return 'border-warning/60 bg-warning/15 text-warning';
      case 'site_viewer': return 'border-blue-500/60 bg-blue-500/15 text-blue-400';
      default:            return 'border-border/50 bg-secondary text-secondary-foreground';
    }
  }
}
