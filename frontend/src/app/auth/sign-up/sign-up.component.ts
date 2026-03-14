/**
 * SignUpComponent — Mounts Clerk's pre-built sign-up UI.
 *
 * Uses `afterNextRender` to mount the Clerk sign-up widget into a container
 * div, ensuring SSR safety (no DOM access during server render).
 */

import { Component, ElementRef, afterNextRender, inject, viewChild, OnDestroy, effect } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClerkService } from '../../services/clerk.service';
import { ThemeService } from '../../services/theme.service';

@Component({
    selector: 'app-sign-up',
    standalone: true,
    imports: [MatProgressSpinnerModule],
    template: `
        <div class="auth-page">
            @if (!clerk.isLoaded()) {
                <div class="auth-loading" aria-label="Loading sign-up">
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
                <div #signUpContainer class="clerk-container"></div>
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
export class SignUpComponent implements OnDestroy {
    protected readonly clerk = inject(ClerkService);
    private readonly theme = inject(ThemeService);
    private readonly container = viewChild<ElementRef<HTMLDivElement>>('signUpContainer');
    private mounted = false;

    private readonly _mount = afterNextRender(() => {
        this.tryMount();
    });

    // Re-mount with updated appearance when the user toggles dark/light mode
    private readonly _themeEffect = effect(() => {
        this.theme.isDark(); // track the signal
        if (this.mounted) {
            const el = this.container()?.nativeElement;
            if (el) {
                this.clerk.unmountSignUp(el);
                this.mounted = false;
                this.tryMount();
            }
        }
    });

    ngOnDestroy(): void {
        const el = this.container()?.nativeElement;
        if (el) {
            this.clerk.unmountSignUp(el);
        }
    }

    private tryMount(): void {
        const el = this.container()?.nativeElement;
        if (el && !this.mounted) {
            this.clerk.mountSignUp(el);
            this.mounted = true;
        }
    }
}
