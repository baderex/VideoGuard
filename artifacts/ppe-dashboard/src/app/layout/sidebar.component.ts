import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';
import { AlertService } from '../services/alert.service';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
  badge?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <aside class="w-60 flex-shrink-0 border-r border-border/40 bg-card/40 backdrop-blur-xl h-screen flex flex-col">

      <!-- Logo -->
      <div class="h-[52px] flex items-center px-5 border-b border-border/30 bg-background/30 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary mr-2.5 shrink-0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        <h1 class="font-display font-bold text-lg tracking-widest text-foreground">
          SECURE<span class="text-primary">SIGHT</span>
        </h1>
      </div>

      <!-- Nav section label -->
      <div class="flex-1 flex flex-col overflow-y-auto">
        <div class="px-4 pt-5 pb-2">
          <p class="text-[9px] font-display font-semibold text-muted-foreground/50 uppercase tracking-[0.2em] px-2 mb-2">Navigation</p>
        </div>

        <nav class="px-3 space-y-0.5">
          @for (item of visibleNavItems(); track item.href) {
            <a [routerLink]="item.href"
              [class]="getNavClasses(item)"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative">
              <span [innerHTML]="getIcon(item.icon)"
                class="shrink-0 [&>svg]:w-[18px] [&>svg]:h-[18px] transition-colors"
                [class]="isActive(item) ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-muted-foreground'">
              </span>
              <span class="font-display tracking-wide uppercase text-sm flex-1">{{ item.name }}</span>
              <!-- Alert badge -->
              @if (item.badge && openAlerts() > 0) {
                <span class="shrink-0 min-w-[18px] h-[18px] rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center px-1 shadow-[0_0_6px_rgba(255,0,0,0.7)]"
                  [class]="isActive(item) ? '' : 'animate-pulse'">
                  {{ openAlerts() > 9 ? '9+' : openAlerts() }}
                </span>
              }
              <!-- Active indicator -->
              @if (isActive(item) && !(item.badge && openAlerts() > 0)) {
                <div class="shrink-0 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(0,255,255,0.9)]"></div>
              }
            </a>
          }
        </nav>

        <!-- Divider + version info -->
        <div class="mt-auto px-4 pb-3">
          <div class="border-t border-border/20 pt-3">
            <div class="flex items-center gap-2 px-2 py-2 rounded-lg">
              <div class="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0"></div>
              <p class="text-[10px] font-mono text-muted-foreground/40 tracking-wider">AI ENGINE ONLINE</p>
            </div>
          </div>
        </div>
      </div>

      <!-- User section -->
      <div class="p-3 border-t border-border/30 bg-background/20">
        @if (user()) {
          <div class="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/3 border border-border/20 mb-2">
            <div class="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-display font-bold text-xs shrink-0">
              {{ user()!.username[0].toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-display font-semibold text-foreground truncate tracking-wider">{{ user()!.username }}</p>
              <span class="text-[9px] font-display uppercase tracking-widest rounded px-1.5 py-0.5 mt-0.5 inline-block"
                [class]="getRoleBadge(user()!.role)">{{ getRoleLabel(user()!.role) }}</span>
            </div>
          </div>
          <button (click)="logout()"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground/60 text-xs font-display tracking-wider uppercase border border-transparent hover:border-destructive/30 hover:text-destructive hover:bg-destructive/5 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        }
      </div>
    </aside>
  `
})
export class SidebarComponent implements OnInit {
  private router = inject(Router);
  readonly auth = inject(AuthService);
  private alertService = inject(AlertService);
  readonly user = this.auth.user;

  openAlerts = signal(0);

  navItems: NavItem[] = [
    { name: 'Dashboard', href: '/',            icon: 'activity'       },
    { name: 'Cameras',   href: '/cameras',     icon: 'camera'         },
    { name: 'Sites',     href: '/sites',       icon: 'building'       },
    { name: 'Alerts',    href: '/alerts',      icon: 'alert-triangle', badge: true },
    { name: 'Reports',   href: '/reports',     icon: 'file-text'      },
    { name: 'Users',     href: '/admin/users', icon: 'users', adminOnly: true },
  ];

  visibleNavItems = computed(() =>
    this.navItems.filter(item => !item.adminOnly || this.auth.isAdmin())
  );

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  ngOnInit() {
    this.loadAlertCount();
    setInterval(() => this.loadAlertCount(), 30000);
  }

  private loadAlertCount() {
    this.alertService.listAlerts({ status: 'open' as any, limit: 1 }).subscribe({
      next: d => this.openAlerts.set(d.total ?? d.alerts?.length ?? 0),
    });
  }

  isActive(item: NavItem): boolean {
    const url = this.currentUrl();
    if (item.href === '/') return url === '/' || url === '';
    return url.startsWith(item.href);
  }

  getNavClasses(item: NavItem): string {
    if (this.isActive(item)) {
      return 'bg-primary/10 text-primary border border-primary/15';
    }
    return 'text-muted-foreground hover:bg-white/4 hover:text-foreground border border-transparent';
  }

  logout() { this.auth.logout(); }

  getRoleLabel(role: string): string {
    return { admin: 'Admin', support: 'Support', site_viewer: 'Site Viewer' }[role] ?? role;
  }

  getRoleBadge(role: string): string {
    switch (role) {
      case 'admin':       return 'bg-primary/15 text-primary';
      case 'support':     return 'bg-warning/15 text-warning';
      case 'site_viewer': return 'bg-blue-500/15 text-blue-400';
      default:            return 'bg-secondary text-secondary-foreground';
    }
  }

  getIcon(name: string): string {
    const icons: Record<string, string> = {
      'activity':      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>',
      'camera':        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
      'alert-triangle':'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
      'file-text':     '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
      'building':      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      'users':         '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    };
    return icons[name] || '';
  }
}
