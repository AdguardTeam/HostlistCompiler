/**
 * SignInComponent — Mounts Clerk's pre-built sign-in UI.
 *
 * Uses `afterNextRender` to mount the Clerk sign-in widget into a container
 * div, ensuring SSR safety (no DOM access during server render).
 *
 * Reads `returnUrl` from query params so Clerk can redirect back after sign-in.
 */

import { Component, ElementRef, afterNextRender, inject, viewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ClerkService } from '../../services/clerk.service';

@Component({
    selector: 'app-sign-in',
    standalone: true,
    template: `
        <div class="auth-page">
            <div #signInContainer class="clerk-container"></div>
        </div>
    `,
    styles: [`
        .auth-page {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 2rem;
            min-height: 60vh;
        }
        .clerk-container {
            min-width: 320px;
        }
    `],
})
export class SignInComponent implements OnDestroy {
    private readonly clerk = inject(ClerkService);
    private readonly route = inject(ActivatedRoute);
    private readonly container = viewChild<ElementRef<HTMLDivElement>>('signInContainer');

    private readonly _mount = afterNextRender(() => {
        const el = this.container()?.nativeElement;
        if (el) {
            this.clerk.mountSignIn(el);
        }
    });

    ngOnDestroy(): void {
        const el = this.container()?.nativeElement;
        if (el) {
            this.clerk.unmountSignIn(el);
        }
    }
}
