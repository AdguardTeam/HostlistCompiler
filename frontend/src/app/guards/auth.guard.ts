/**
 * Functional route guard for Clerk-authenticated routes.
 *
 * Waits for Clerk to finish loading, then:
 *   - If signed in → allows navigation
 *   - If not signed in → redirects to /sign-in with a returnUrl query param
 *
 * Uses a polling approach (50 ms intervals, max 5 s) to wait for Clerk's
 * async load, which is more predictable than effect/computed watching in
 * a guard context.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ClerkService } from '../services/clerk.service';

export const authGuard: CanActivateFn = async (route, state) => {
    const clerk = inject(ClerkService);
    const router = inject(Router);

    // Wait for Clerk SDK to finish loading (max 5 s)
    if (!clerk.isLoaded()) {
        await waitForClerk(clerk, 5000);
    }

    if (clerk.isSignedIn()) {
        return true;
    }

    // Redirect to sign-in with return URL
    return router.createUrlTree(['/sign-in'], {
        queryParams: { returnUrl: state.url },
    });
};

/** Poll `isLoaded()` until it becomes true or timeout expires. */
function waitForClerk(clerk: ClerkService, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
        if (clerk.isLoaded()) {
            resolve();
            return;
        }

        const start = Date.now();
        const interval = setInterval(() => {
            if (clerk.isLoaded() || Date.now() - start > timeoutMs) {
                clearInterval(interval);
                resolve();
            }
        }, 50);
    });
}
