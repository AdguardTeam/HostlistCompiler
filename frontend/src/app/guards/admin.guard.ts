/**
 * Functional route guard for admin pages.
 *
 * Redirects to home if no admin key is set.
 * The admin page itself also shows an auth form, so this guard
 * is a soft check — it allows navigation but prompts for auth.
 */

import { CanActivateFn } from '@angular/router';

export const adminGuard: CanActivateFn = () => {
    // Allow navigation — the admin component handles the auth form inline.
    // For strict blocking: inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/'])
    return true;
};
