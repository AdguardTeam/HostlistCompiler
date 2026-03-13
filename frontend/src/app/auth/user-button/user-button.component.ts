/**
 * UserButtonComponent — Mounts Clerk's user button (avatar + dropdown menu).
 *
 * Shown in the app header when the user is signed in. Renders nothing when
 * Clerk hasn't loaded or the user is anonymous.
 *
 * Uses `afterNextRender` for SSR-safe DOM mounting, and `effect` to remount
 * when `isSignedIn()` changes.
 */

import { Component, ElementRef, afterNextRender, inject, viewChild, effect, OnDestroy } from '@angular/core';
import { ClerkService } from '../../services/clerk.service';

@Component({
    selector: 'app-user-button',
    standalone: true,
    template: `
        @if (clerk.isSignedIn()) {
            <div #userButtonContainer class="user-button-container"></div>
        }
    `,
    styles: [`
        .user-button-container {
            display: inline-flex;
            align-items: center;
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
