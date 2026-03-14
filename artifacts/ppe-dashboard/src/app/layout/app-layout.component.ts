import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-background">
      <div class="hidden md:flex">
        <app-sidebar />
      </div>
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header class="md:hidden h-16 border-b border-border/50 bg-card flex items-center px-4 justify-between shrink-0">
          <h1 class="font-display font-bold text-xl tracking-widest text-foreground">
            SECURE<span class="text-primary">SIGHT</span>
          </h1>
          <button (click)="mobileMenuOpen.set(!mobileMenuOpen())" class="p-2 rounded-md hover:bg-white/10 text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>
        </header>

        @if (mobileMenuOpen()) {
          <div class="fixed inset-0 z-50 md:hidden">
            <div class="absolute inset-0 bg-black/50" (click)="mobileMenuOpen.set(false)"></div>
            <div class="absolute left-0 top-0 h-full w-64 z-50">
              <app-sidebar />
            </div>
          </div>
        }

        <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] pointer-events-none"></div>
        
        <div class="flex-1 overflow-y-auto p-4 md:p-8">
          <div class="max-w-7xl mx-auto h-full">
            <router-outlet />
          </div>
        </div>
      </main>
    </div>
  `
})
export class AppLayoutComponent {
  mobileMenuOpen = signal(false);
}
