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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClerkService } from '../../services/clerk.service';

@Component({
    selector: 'app-sign-in',
    standalone: true,
    imports: [MatProgressSpinnerModule],
    template: `
        <div class="auth-page">
            @if (!clerk.isLoaded()) {
                <div class="auth-loading" aria-label="Loading sign-in">
                    <mat-spinner diameter="40" />
                </div>
            } @else if (!clerk.isAvailable()) {
                <div class="auth-error" role="alert">
                    <p>Authentication is not configured.</p>
                    <p class="auth-error-detail">
                        Ensure <code>CLERK_PUBLISHABLE_KEY</code> is set in the worker environment.
                    </p>
                </div>
            } @else {
                <div #signInContainer class="clerk-container"></div>
            }
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
        .auth-loading {
            display: flex;
            justify-content: center;
            align-items: center;
            padding-top: 4rem;
        }
        .auth-error {
            max-width: 420px;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid var(--mat-sys-error);
            color: var(--mat-sys-error);
        }
        .auth-error-detail {
            font-size: 0.875rem;
            opacity: 0.8;
            margin-top: 0.5rem;
        }
        .auth-error code {
            font-family: monospace;
            background: var(--mat-sys-surface-variant);
            padding: 0.1em 0.3em;
            border-radius: 3px;
        }
    `],
})
export class SignInComponent implements OnDestroy {
    protected readonly clerk = inject(ClerkService);
    private readonly route = inject(ActivatedRoute);
    private readonly container = viewChild<ElementRef<HTMLDivElement>>('signInContainer');

    private readonly _mount = afterNextRender(() => {
        const el = this.container()?.nativeElement;
        if (el) {
            const returnUrl = this.route.snapshot.queryParams['returnUrl'] as string | undefined;
            this.clerk.mountSignIn(el, returnUrl);
        }
    });

    ngOnDestroy(): void {
        const el = this.container()?.nativeElement;
        if (el) {
            this.clerk.unmountSignIn(el);
        }
    }
}
