import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <aside class="w-64 flex-shrink-0 border-r border-border/50 bg-card/50 backdrop-blur-xl h-screen flex flex-col">
      <!-- Logo -->
      <div class="h-16 flex items-center px-6 border-b border-border/50 bg-background/50">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-primary mr-3 animate-pulse-glow"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        <h1 class="font-display font-bold text-xl tracking-widest text-foreground">
          SECURE<span class="text-primary">SIGHT</span>
        </h1>
      </div>

      <!-- Nav -->
      <div class="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        <div class="text-xs font-display font-semibold text-muted-foreground mb-4 uppercase tracking-widest px-2">
          System Core
        </div>

        @for (item of visibleNavItems(); track item.href) {
          <a
            [routerLink]="item.href"
            [class]="getNavClasses(item)"
            class="flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group"
          >
            <span [innerHTML]="getIcon(item.icon)" class="mr-3 [&>svg]:w-5 [&>svg]:h-5" [class]="isActive(item) ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'"></span>
            <span class="font-display tracking-wider uppercase">{{ item.name }}</span>
            @if (isActive(item)) {
              <div class="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(0,255,255,1)] animate-pulse"></div>
            }
          </a>
        }
      </div>

      <!-- User + Logout -->
      <div class="p-4 border-t border-border/50 space-y-3">
        @if (user()) {
          <!-- User info -->
          <div class="flex items-center gap-3 px-2">
            <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-display font-bold text-xs flex-shrink-0">
              {{ user()!.username[0].toUpperCase() }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-display font-semibold text-foreground truncate">{{ user()!.username }}</p>
              <span class="inline-block text-[10px] font-display uppercase tracking-widest rounded px-1.5 py-0.5 mt-0.5"
                [class]="getRoleBadge(user()!.role)">
                {{ getRoleLabel(user()!.role) }}
              </span>
            </div>
          </div>

          <!-- Logout button -->
          <button (click)="logout()"
            class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-muted-foreground text-sm font-display tracking-wider uppercase border border-border/40 hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log Out
          </button>
        } @else {
          <!-- Engine status fallback -->
          <div class="bg-secondary/50 rounded-lg p-4 border border-border/50 flex items-center space-x-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-primary"><path d="M10 7.75a.75.75 0 0 1 1.142-.638l3.664 2.249a.75.75 0 0 1 0 1.278l-3.664 2.25a.75.75 0 0 1-1.142-.64z"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M2 14h20"/></svg>
            <div>
              <p class="text-xs font-display text-muted-foreground uppercase tracking-wider">Engine Status</p>
              <p class="text-sm font-semibold text-success flex items-center">
                ONLINE <span class="inline-block w-1.5 h-1.5 ml-2 bg-success rounded-full animate-pulse"></span>
              </p>
            </div>
          </div>
        }
      </div>
    </aside>
  `
})
export class SidebarComponent {
  private router = inject(Router);
  readonly auth = inject(AuthService);
  readonly user = this.auth.user;

  navItems: NavItem[] = [
    { name: 'Live Dashboard', href: '/',             icon: 'activity'       },
    { name: 'Cameras',        href: '/cameras',      icon: 'camera'         },
    { name: 'Sites',          href: '/sites',        icon: 'building'       },
    { name: 'Alerts',         href: '/alerts',       icon: 'alert-triangle' },
    { name: 'Reports',        href: '/reports',      icon: 'file-text'      },
    { name: 'Users',          href: '/admin/users',  icon: 'users',   adminOnly: true },
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

  isActive(item: NavItem): boolean {
    const url = this.currentUrl();
    if (item.href === '/') return url === '/' || url === '';
    return url.startsWith(item.href);
  }

  getNavClasses(item: NavItem): string {
    if (this.isActive(item)) {
      return 'bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_20px_rgba(0,255,255,0.05)]';
    }
    return 'text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent';
  }

  logout() {
    this.auth.logout();
  }

  getRoleLabel(role: string): string {
    return { admin: 'Admin', support: 'Support', site_viewer: 'Site Viewer' }[role] ?? role;
  }

  getRoleBadge(role: string): string {
    switch (role) {
      case 'admin':       return 'bg-primary/15 text-primary border border-primary/30';
      case 'support':     return 'bg-warning/15 text-warning border border-warning/30';
      case 'site_viewer': return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
      default:            return 'bg-secondary text-secondary-foreground border border-border/30';
    }
  }

  getIcon(name: string): string {
    const icons: Record<string, string> = {
      'activity':      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>',
      'camera':        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
      'alert-triangle':'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
      'file-text':     '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
      'building':      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      'users':         '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    };
    return icons[name] || '';
  }
}
