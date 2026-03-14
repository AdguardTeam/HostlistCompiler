/**
 * Functional route guard for admin pages.
 *
 * Requires the user to be signed in via Clerk AND have the 'admin' role
 * in their Clerk public metadata. Redirects unauthenticated users to
 * /sign-in and unauthorized users to /.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ClerkService } from '../services/clerk.service';

export const adminGuard: CanActivateFn = async (_route, state) => {
    const clerk = inject(ClerkService);
    const router = inject(Router);

    // Wait for Clerk SDK to finish loading (max 5 s)
    if (!clerk.isLoaded()) {
        await waitForClerk(clerk, 5000);
    }

    if (!clerk.isSignedIn()) {
        return router.createUrlTree(['/sign-in'], {
            queryParams: { returnUrl: state.url },
        });
    }

    // Check for admin role in Clerk public metadata
    const user = clerk.user();
    const role = (user?.publicMetadata as Record<string, unknown> | undefined)?.['role'];
    if (role !== 'admin') {
        return router.createUrlTree(['/']);
    }

    return true;
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
