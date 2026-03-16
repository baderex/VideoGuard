import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <!-- Background grid -->
      <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTSAwIDYwIEwgNjAgMCIgc3Ryb2tlPSJyZ2JhKDAsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] opacity-40 pointer-events-none"></div>

      <!-- Glow orbs -->
      <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/8 blur-[140px] pointer-events-none"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] pointer-events-none"></div>

      <div class="relative z-10 w-full max-w-md px-6">
        <!-- Brand -->
        <div class="text-center mb-10">
          <div class="flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary mr-3 animate-pulse-glow"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            <h1 class="font-display font-bold text-4xl tracking-widest text-foreground">
              SECURE<span class="text-primary">SIGHT</span>
            </h1>
          </div>
          <p class="text-muted-foreground text-sm font-mono tracking-widest uppercase">VideoGuard · AI Safety Platform</p>
          <div class="mt-3 flex items-center justify-center gap-2">
            <div class="h-px w-12 bg-primary/30"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <div class="h-px w-12 bg-primary/30"></div>
          </div>
        </div>

        <!-- Login card -->
        <div class="rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-xl shadow-[0_0_80px_rgba(0,255,255,0.05)] p-8">
          <div class="mb-6">
            <h2 class="text-lg font-display font-bold tracking-widest text-foreground uppercase">Operator Login</h2>
            <p class="text-xs text-muted-foreground font-mono mt-1">Authenticate to access the control panel</p>
          </div>

          <form (ngSubmit)="onLogin()" class="space-y-5">
            <!-- Username -->
            <div>
              <label class="text-xs font-display tracking-widest uppercase text-muted-foreground mb-2 block">Username</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <input
                  [(ngModel)]="username" name="username" type="text"
                  placeholder="Enter username"
                  autocomplete="username"
                  class="w-full bg-background/50 border border-border/50 rounded-lg pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all font-mono"
                />
              </div>
            </div>

            <!-- Password -->
            <div>
              <label class="text-xs font-display tracking-widest uppercase text-muted-foreground mb-2 block">Password</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input
                  [(ngModel)]="password" name="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  placeholder="Enter password"
                  autocomplete="current-password"
                  class="w-full bg-background/50 border border-border/50 rounded-lg pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all font-mono"
                />
                <button type="button" (click)="showPassword.set(!showPassword())"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  @if (showPassword()) {
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            <!-- Error -->
            @if (error()) {
              <div class="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {{ error() }}
              </div>
            }

            <!-- Submit -->
            <button type="submit" [disabled]="loading() || !username || !password"
              class="w-full py-3 rounded-lg bg-primary text-primary-foreground font-display font-bold tracking-widest uppercase text-sm transition-all
                     hover:bg-primary/90 shadow-[0_0_20px_rgba(0,255,255,0.3)] hover:shadow-[0_0_30px_rgba(0,255,255,0.5)]
                     disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                     flex items-center justify-center gap-2">
              @if (loading()) {
                <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                AUTHENTICATING...
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                ACCESS SYSTEM
              }
            </button>
          </form>

          <!-- Demo accounts hint -->
          <div class="mt-6 pt-5 border-t border-border/40">
            <p class="text-xs font-mono text-muted-foreground/60 uppercase tracking-wider mb-3">Demo Accounts</p>
            <div class="grid grid-cols-3 gap-2">
              @for (acc of demoAccounts; track acc.user) {
                <button (click)="fillDemo(acc.user, acc.pass)"
                  class="rounded-md border border-border/40 bg-background/40 hover:border-primary/40 hover:bg-primary/5 transition-all py-2 px-2 text-center">
                  <span class="block text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{{ acc.label }}</span>
                  <span class="block text-[10px] font-display tracking-widest text-foreground/70 mt-0.5">{{ acc.user }}</span>
                </button>
              }
            </div>
          </div>
        </div>

        <p class="text-center text-xs text-muted-foreground/40 font-mono mt-6">
          VIDEOGUARD &copy; 2026 · INDUSTRIAL AI SAFETY SYSTEM
        </p>
      </div>
    </div>
  `
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  username = '';
  password = '';
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  demoAccounts = [
    { label: 'Admin',   user: 'admin',   pass: 'admin123'   },
    { label: 'Support', user: 'support', pass: 'support123' },
    { label: 'Site 1',  user: 'site1',   pass: 'site123'    },
  ];

  fillDemo(user: string, pass: string) {
    this.username = user;
    this.password = pass;
    this.error.set('');
  }

  onLogin() {
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigate([returnUrl]);
      },
      error: (err) => {
        this.error.set(err.error?.detail ?? 'Login failed. Check credentials.');
        this.loading.set(false);
      },
    });
  }
}
