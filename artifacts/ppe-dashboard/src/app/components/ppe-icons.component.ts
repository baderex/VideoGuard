import { Component, Input } from '@angular/core';
import { ppeLabelMap } from '../lib/utils';

@Component({
  selector: 'app-ppe-icon-list',
  standalone: true,
  template: `
    <div class="flex gap-2 flex-wrap">
      @for (ppe of ppeList; track ppe) {
        <div
          class="p-1.5 rounded-md border cursor-default"
          [class]="isMissing(ppe) ? 'bg-destructive/10 border-destructive text-destructive shadow-[0_0_8px_rgba(255,0,0,0.3)]' : 'bg-success/10 border-success/50 text-success'"
          [title]="getLabel(ppe) + (isMissing(ppe) ? ' (MISSING)' : ' (DETECTED)')"
        >
          <span [innerHTML]="getIconSvg(ppe)" class="[&>svg]:w-4 [&>svg]:h-4" [class]="size === 'md' ? '[&>svg]:w-5 [&>svg]:h-5' : ''"></span>
        </div>
      }
    </div>
  `
})
export class PpeIconListComponent {
  @Input() ppeList: string[] = [];
  @Input() missing: string[] = [];
  @Input() size: 'sm' | 'md' = 'sm';

  isMissing(ppe: string): boolean {
    return this.missing.includes(ppe);
  }

  getLabel(ppe: string): string {
    return ppeLabelMap[ppe] || ppe;
  }

  getIconSvg(ppe: string): string {
    const icons: Record<string, string> = {
      hard_hat: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a6 6 0 0 1 6-6h0"/><path d="M14 6a6 6 0 0 1 6 6v3"/></svg>',
      safety_vest: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
      gloves: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 13"/></svg>',
      safety_glasses: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-4 0"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.4-2-3-2"/></svg>',
      face_mask: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V7h-5a8 8 0 0 0-5 2 8 8 0 0 0-5-2H2Z"/><path d="M6 11c1.5 0 3 .5 3 2-2 0-3 0-3-2Z"/><path d="M18 11c-1.5 0-3 .5-3 2 2 0 3 0 3-2Z"/></svg>',
      safety_boots: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-3.9 2.02-4.26a4 4 0 0 1 3.56-.42c2.78 1.05 5.36 0 5.36 0s2.01-.97 3.69-.97c.87 0 1.47.25 2.11.8 1.24 1.06 1.26 3.73 1.26 5.19V16c0 1.1-.9 2-2 2h-1a2 2 0 0 1-2-2 2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M2 17h20"/><path d="M6 20h12"/></svg>',
    };
    return icons[ppe] || '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  }
}
