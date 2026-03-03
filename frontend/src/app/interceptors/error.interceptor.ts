/**
 * Functional HTTP interceptor for centralized error handling.
 *
 * Handles:
 *   401 — Unauthorized (clears admin key, could redirect to login)
 *   429 — Rate limited (surfaces retry-after header)
 *   5xx — Server errors (logs and re-throws)
 */

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            switch (error.status) {
                case 401:
                    auth.clearKey();
                    console.warn('[HTTP] Unauthorized — admin key cleared');
                    break;
                case 429: {
                    const retryAfter = error.headers.get('Retry-After');
                    console.warn(`[HTTP] Rate limited. Retry after: ${retryAfter ?? 'unknown'}s`);
                    break;
                }
                default:
                    if (error.status >= 500) {
                        console.error(`[HTTP] Server error ${error.status}:`, error.message);
                    }
            }
            return throwError(() => error);
        }),
    );
};
