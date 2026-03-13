/**
 * Functional HTTP interceptor for Clerk JWT authentication.
 *
 * Attaches `Authorization: Bearer <token>` to outgoing API requests when
 * the user is signed in via Clerk. Skips public/health endpoints that
 * never require auth.
 *
 * Runs alongside the existing `errorInterceptor` — order matters:
 *   withInterceptors([authInterceptor, errorInterceptor])
 *   1. authInterceptor adds the Bearer header
 *   2. errorInterceptor adds X-Trace-ID and handles errors
 */

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { ClerkService } from '../services/clerk.service';

/** Paths that never need a Bearer token. */
const PUBLIC_PATHS = [
    '/api/version',
    '/api/health',
    '/api/turnstile-config',
    '/api/clerk-config',
    '/api/deployments',
    '/api/metrics',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const clerk = inject(ClerkService);

    // Skip if not signed in or if targeting a public endpoint
    if (!clerk.isSignedIn()) {
        return next(req);
    }

    const isPublic = PUBLIC_PATHS.some((p) => req.url.includes(p));
    if (isPublic) {
        return next(req);
    }

    // Get fresh JWT and attach as Bearer header
    return from(clerk.getToken()).pipe(
        switchMap((token) => {
            if (token) {
                const authed = req.clone({
                    setHeaders: { Authorization: `Bearer ${token}` },
                });
                return next(authed);
            }
            return next(req);
        }),
    );
};
