import { Component } from '@angular/core';

@Component({
  selector: 'app-not-found',
  standalone: true,
  template: `
    <div class="min-h-screen w-full flex items-center justify-center bg-background">
      <div class="w-full max-w-md mx-4 rounded-xl border border-border/50 bg-card/80 backdrop-blur-md text-card-foreground shadow-lg">
        <div class="p-6">
          <div class="flex mb-4 gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-destructive"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            <h1 class="text-2xl font-bold text-foreground">404 Page Not Found</h1>
          </div>
          <p class="mt-4 text-sm text-muted-foreground">
            The requested page could not be found.
          </p>
        </div>
      </div>
    </div>
  `
})
export class NotFoundComponent {}
