/**
 * UserButtonComponent — Mounts Clerk's user button (avatar + dropdown menu).
 *
 * Shown in the app header. When the user is signed in, mounts Clerk's user
 * button widget. When Clerk is loaded but the user is signed out, renders
 * sign-in / sign-up navigation links. When the config fetch failed, renders a
 * "Sign in unavailable" error hint. Renders nothing while Clerk is still
 * loading.
 *
 * Uses `afterNextRender` for SSR-safe DOM mounting, and `effect` to remount
 * when `isSignedIn()` changes.
 */

import { Component, ElementRef, afterNextRender, inject, viewChild, effect, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClerkService } from '../../services/clerk.service';

@Component({
    selector: 'app-user-button',
    standalone: true,
    imports: [RouterLink],
    template: `
        @if (clerk.isSignedIn()) {
            <div #userButtonContainer class="user-button-container"></div>
        } @else if (clerk.isLoaded()) {
            @if (clerk.configLoadFailed()) {
                <span class="auth-config-error" title="Authentication service is temporarily unavailable. Please try refreshing the page.">Sign in unavailable</span>
            } @else {
                <nav class="auth-links" aria-label="Authentication">
                    <a routerLink="/sign-in" class="auth-link">Sign in</a>
                    <a routerLink="/sign-up" class="auth-link auth-link--primary">Sign up</a>
                </nav>
            }
        }
    `,
    styles: [`
        .user-button-container {
            display: inline-flex;
            align-items: center;
        }
        .auth-links {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .auth-link {
            font-size: 0.875rem;
            font-weight: 500;
            text-decoration: none;
            padding: 0.375rem 0.75rem;
            border-radius: 4px;
            color: var(--mat-sys-on-surface);
            transition: background 0.15s;
        }
        .auth-link:hover {
            background: var(--mat-sys-surface-variant);
        }
        .auth-link--primary {
            background: var(--mat-sys-primary);
            color: var(--mat-sys-on-primary);
        }
        .auth-link--primary:hover {
            opacity: 0.9;
        }
        .auth-config-error {
            font-size: 0.875rem;
            color: var(--mat-sys-error, #b00020);
            padding: 0.375rem 0.75rem;
            cursor: default;
        }
    `],
})
export class UserButtonComponent implements OnDestroy {
    protected readonly clerk = inject(ClerkService);
    private readonly container = viewChild<ElementRef<HTMLDivElement>>('userButtonContainer');
    private mounted = false;

    private readonly _mountEffect = afterNextRender(() => {
        this.tryMount();
    });

    // Re-mount when sign-in state changes (e.g. user signs in while on page)
    private readonly _signInEffect = effect(() => {
        const signedIn = this.clerk.isSignedIn();
        if (signedIn && !this.mounted) {
            // Wait a tick for the @if to render the container
            queueMicrotask(() => this.tryMount());
        } else if (!signedIn) {
            this.mounted = false;
        }
    });

    ngOnDestroy(): void {
        const el = this.container()?.nativeElement;
        if (el) {
            this.clerk.unmountUserButton(el);
        }
    }

    private tryMount(): void {
        const el = this.container()?.nativeElement;
        if (el && !this.mounted) {
            this.clerk.mountUserButton(el);
            this.mounted = true;
        }
    }
}
