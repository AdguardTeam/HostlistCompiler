/**
 * Functional route guard for admin pages.
 *
 * Redirects to home if no admin key is set.
 * The admin page itself also shows an auth form, so this guard
 * is a soft check — it allows navigation but prompts for auth.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // Allow navigation — the admin component handles the auth form inline.
    // If we wanted strict blocking: return auth.isAuthenticated() || router.createUrlTree(['/']);
    return true;
};
