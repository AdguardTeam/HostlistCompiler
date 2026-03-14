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
import { from, switchMap, catchError, throwError } from 'rxjs';
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

    // Get fresh JWT and attach as Bearer header.
    // catchError is scoped to the getToken() observable only (placed before switchMap)
    // so HTTP errors from next(...) propagate normally and aren't misreported as token failures.
    return from(clerk.getToken()).pipe(
        catchError((err) => {
            console.warn('[authInterceptor] Failed to get session token:', err instanceof Error ? err.message : String(err));
            return throwError(() => new Error('Session token refresh failed — please sign in again'));
        }),
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
