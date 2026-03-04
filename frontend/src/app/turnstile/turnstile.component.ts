/**
 * TurnstileComponent — Standalone wrapper for Cloudflare Turnstile widget.
 *
 * Renders the Turnstile challenge widget and emits the verification token.
 * Uses afterRenderEffect() to safely interact with the DOM after Angular
 * has committed the render.
 *
 * Usage:
 *   <app-turnstile [siteKey]="siteKey" (tokenChange)="onToken($event)" />
 *
 * Angular 21 patterns: input(), output(), viewChild(), afterRenderEffect(),
 *   inject(), standalone component
 */

import { Component, DestroyRef, afterRenderEffect, inject, input, output, viewChild, ElementRef } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TurnstileService } from '../services/turnstile.service';

@Component({
    selector: 'app-turnstile',
    standalone: true,
    imports: [MatCardModule],
    template: `
        <mat-card appearance="outlined" class="turnstile-card">
            <mat-card-content>
                <div #turnstileContainer class="turnstile-container"></div>
            </mat-card-content>
        </mat-card>
    `,
    styles: [`
        .turnstile-card { text-align: center; }
        .turnstile-container {
            display: flex;
            justify-content: center;
            margin: 8px 0;
            min-height: 65px;
        }
    `],
})
export class TurnstileComponent {
    /** Cloudflare Turnstile site key */
    readonly siteKey = input.required<string>();
    /** Theme for the widget */
    readonly theme = input<'light' | 'dark' | 'auto'>('auto');

    /** Emits the verification token when the user completes the challenge */
    readonly tokenChange = output<string>();

    private readonly containerRef = viewChild.required<ElementRef>('turnstileContainer');
    private readonly turnstileService = inject(TurnstileService);
    private readonly destroyRef = inject(DestroyRef);

    constructor() {
        afterRenderEffect(() => {
            const key = this.siteKey();
            if (key) {
                this.turnstileService.setSiteKey(key);
                this.turnstileService.render(
                    this.containerRef().nativeElement,
                    this.theme(),
                );
            }
        });

        // Clean up widget on destroy
        this.destroyRef.onDestroy(() => this.turnstileService.remove());
    }
}
