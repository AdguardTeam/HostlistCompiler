/**
 * Functional HTTP interceptor for centralized error handling.
 *
 * Handles:
 *   401 — Unauthorized (clears admin key, could redirect to login)
 *   429 — Rate limited (surfaces retry-after header)
 *   408/504 — Timeouts (logged with context)
 *   0 — Network failures (offline, DNS, CORS)
 *   5xx — Server errors (logs and re-throws)
 *
 * Also:
 *   - Injects X-Trace-ID header on every outgoing request
 *   - Logs slow requests (>3 s) as warnings
 */

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LogService } from '../services/log.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const log = inject(LogService);

    const traceId = log.generateTraceId();
    const start = Date.now();

    const traced = req.clone({
        setHeaders: { 'X-Trace-ID': traceId },
    });

    return next(traced).pipe(
        tap(() => {
            const elapsed = Date.now() - start;
            if (elapsed > 3000) {
                log.warn(`Slow request: ${req.method} ${req.url} (${elapsed}ms)`, 'HTTP', {
                    traceId,
                    elapsed,
                });
            }
        }),
        catchError((error: HttpErrorResponse) => {
            const context = { traceId, url: req.url, method: req.method };

            if (error.status === 0) {
                log.error('Network failure — offline, DNS, or CORS error', 'HTTP', context);
            } else {
                switch (error.status) {
                    case 401:
                        auth.clearKey();
                        log.warn('Unauthorized — admin key cleared', 'HTTP', context);
                        break;
                    case 408:
                    case 504:
                        log.warn(`Request timeout (${error.status})`, 'HTTP', context);
                        break;
                    case 429: {
                        const retryAfter = error.headers.get('Retry-After');
                        log.warn(`Rate limited. Retry after: ${retryAfter ?? 'unknown'}s`, 'HTTP', {
                            ...context,
                            retryAfter,
                        });
                        break;
                    }
                    default:
                        if (error.status >= 500) {
                            log.error(`Server error ${error.status}: ${error.message}`, 'HTTP', context);
                        }
                }
            }

            return throwError(() => error);
        }),
    );
};
