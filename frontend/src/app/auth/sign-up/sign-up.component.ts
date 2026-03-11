/**
 * SignUpComponent — Mounts Clerk's pre-built sign-up UI.
 *
 * Uses `afterNextRender` to mount the Clerk sign-up widget into a container
 * div, ensuring SSR safety (no DOM access during server render).
 */

import { Component, ElementRef, afterNextRender, inject, viewChild, OnDestroy } from '@angular/core';
import { ClerkService } from '../../services/clerk.service';

@Component({
    selector: 'app-sign-up',
    standalone: true,
    template: `
        <div class="auth-page">
            <div #signUpContainer class="clerk-container"></div>
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
export class SignUpComponent implements OnDestroy {
    private readonly clerk = inject(ClerkService);
    private readonly container = viewChild<ElementRef<HTMLElement>>('signUpContainer');

    constructor() {
        afterNextRender(() => {
            const el = this.container()?.nativeElement;
            if (el) {
                this.clerk.mountSignUp(el);
            }
        });
    }

    ngOnDestroy(): void {
        const el = this.container()?.nativeElement;
        if (el) {
            this.clerk.unmountSignUp(el);
        }
    }
}
