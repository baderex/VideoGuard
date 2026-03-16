import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidebarComponent } from './sidebar.component';
import { AuthService } from '../services/auth.service';
import { AlertService } from '../services/alert.service';

const PAGE_META: Record<string, { label: string; icon: string }> = {
  '/':            { label: 'Command Center',    icon: 'activity'   },
  '/cameras':     { label: 'Camera Nodes',      icon: 'camera'     },
  '/sites':       { label: 'Site Directory',    icon: 'building'   },
  '/alerts':      { label: 'Incident Log',      icon: 'alert'      },
  '/reports':     { label: 'Analytics Report',  icon: 'report'     },
  '/admin/users': { label: 'User Management',   icon: 'users'      },
};

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SidebarComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-background">

      <!-- Sidebar -->
      <div class="hidden md:flex">
        <app-sidebar />
      </div>

      <!-- Main content -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative">

        <!-- Mobile header -->
        <header class="md:hidden h-14 border-b border-border/50 bg-card/90 backdrop-blur-md flex items-center px-4 justify-between shrink-0 z-20">
          <h1 class="font-display font-bold text-lg tracking-widest">
            SECURE<span class="text-primary">SIGHT</span>
          </h1>
          <div class="flex items-center gap-2">
            <a routerLink="/alerts" class="relative p-2 rounded-lg text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              @if (openAlerts() > 0) {
                <span class="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center shadow-[0_0_6px_rgba(255,0,0,0.8)]">
                  {{ openAlerts() > 9 ? '9+' : openAlerts() }}
                </span>
              }
            </a>
            <button (click)="mobileMenuOpen.set(!mobileMenuOpen())" class="p-2 rounded-md hover:bg-white/10 text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
          </div>
        </header>

        <!-- Desktop top header -->
        <header class="hidden md:flex h-13 shrink-0 border-b border-border/40 bg-background/60 backdrop-blur-xl items-center px-6 gap-4 z-20" style="height:52px">
          <!-- Breadcrumb / page title -->
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <span class="flex items-center gap-1.5 text-xs font-mono text-muted-foreground/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
              VideoGuard
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-border/60"><path d="M9 18l6-6-6-6"/></svg>
            <h2 class="font-display font-bold text-sm tracking-widest text-foreground uppercase truncate">
              {{ pageTitle() }}
            </h2>
          </div>

          <!-- Right controls -->
          <div class="flex items-center gap-3 shrink-0">
            <!-- System status -->
            <div class="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/60 bg-background/50 px-3 py-1.5 rounded-md border border-border/25">
              <div class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
              {{ clock() }}
            </div>

            <!-- Alerts bell -->
            <a routerLink="/alerts"
              class="relative p-2 rounded-lg border border-transparent hover:border-border/40 hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              @if (openAlerts() > 0) {
                <span class="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] rounded-full bg-destructive text-[8px] font-bold text-white flex items-center justify-center px-0.5 shadow-[0_0_8px_rgba(255,0,0,0.7)]">
                  {{ openAlerts() > 9 ? '9+' : openAlerts() }}
                </span>
              }
            </a>

            <!-- Divider -->
            <div class="h-5 w-px bg-border/40"></div>

            <!-- User pill -->
            @if (auth.user()) {
              <div class="flex items-center gap-2 bg-white/3 border border-border/30 rounded-lg px-2.5 py-1.5 cursor-default">
                <div class="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-[10px] font-display font-bold shrink-0">
                  {{ auth.user()!.username[0].toUpperCase() }}
                </div>
                <span class="text-xs font-mono text-foreground/70 hidden lg:block">{{ auth.user()!.username }}</span>
                <span class="text-[9px] font-display uppercase tracking-widest px-1.5 py-0.5 rounded"
                  [class]="getRoleBadge(auth.user()!.role)">
                  {{ getRoleLabel(auth.user()!.role) }}
                </span>
              </div>
            }
          </div>
        </header>

        <!-- Mobile overlay -->
        @if (mobileMenuOpen()) {
          <div class="fixed inset-0 z-50 md:hidden">
            <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="mobileMenuOpen.set(false)"></div>
            <div class="absolute left-0 top-0 h-full w-64 z-50 shadow-2xl">
              <app-sidebar />
            </div>
          </div>
        }

        <!-- Ambient glows -->
        <div class="absolute top-0 left-[10%] w-[35%] h-[35%] rounded-full bg-primary/4 blur-[130px] pointer-events-none"></div>
        <div class="absolute bottom-0 right-0 w-[25%] h-[25%] rounded-full bg-accent/3 blur-[100px] pointer-events-none"></div>

        <!-- Page content -->
        <div class="flex-1 overflow-y-auto">
          <div class="p-4 md:p-6 max-w-[1600px] mx-auto">
            <router-outlet />
          </div>
        </div>
      </main>
    </div>
  `
})
export class AppLayoutComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private alertService = inject(AlertService);
  private router = inject(Router);

  mobileMenuOpen = signal(false);
  openAlerts = signal(0);
  clock = signal('');

  private clockTimer?: ReturnType<typeof setInterval>;
  private alertTimer?: ReturnType<typeof setInterval>;

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  pageTitle = computed(() => {
    const url = this.currentUrl();
    if (url.startsWith('/cameras/')) return 'Camera Detail';
    return PAGE_META[url]?.label ?? 'Dashboard';
  });

  ngOnInit() {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
    this.loadAlertCount();
    this.alertTimer = setInterval(() => this.loadAlertCount(), 30000);
  }

  ngOnDestroy() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.alertTimer) clearInterval(this.alertTimer);
  }

  private updateClock() {
    const now = new Date();
    this.clock.set(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }

  private loadAlertCount() {
    this.alertService.listAlerts({ status: 'open' as any, limit: 1 }).subscribe({
      next: d => this.openAlerts.set((d as any).total ?? d.alerts?.length ?? 0),
    });
  }

  getRoleLabel(role: string) {
    return { admin: 'ADMIN', support: 'SUP', site_viewer: 'SITE' }[role] ?? role.toUpperCase();
  }

  getRoleBadge(role: string) {
    switch (role) {
      case 'admin':       return 'bg-primary/15 text-primary';
      case 'support':     return 'bg-warning/15 text-warning';
      case 'site_viewer': return 'bg-blue-500/15 text-blue-400';
      default:            return 'bg-secondary text-secondary-foreground';
    }
  }
}
