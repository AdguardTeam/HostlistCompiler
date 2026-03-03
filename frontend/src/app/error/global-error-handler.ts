/**
 * GlobalErrorHandler — Custom ErrorHandler with signal-based state.
 *
 * Replaces Angular's default ErrorHandler to:
 * 1. Store the last error in a signal (consumed by ErrorBoundaryComponent)
 * 2. Log errors via LogService with structured context
 * 3. Report errors to the Cloudflare Worker via LogService.reportError()
 *
 * Angular 21 patterns: ErrorHandler override, signal(), inject()
 */

import { ErrorHandler, Injectable, signal, computed, inject } from '@angular/core';
import { LogService } from '../services/log.service';

export interface AppError {
    readonly message: string;
    readonly stack?: string;
    readonly timestamp: Date;
    readonly context?: string;
}

@Injectable()
export class GlobalErrorHandler extends ErrorHandler {
    private readonly log = inject(LogService);

    /** The most recent unhandled error */
    readonly lastError = signal<AppError | null>(null);

    /** Whether there's an active error to display */
    readonly hasError = computed(() => this.lastError() !== null);

    /** Error history (last 10 errors) */
    private readonly _errorHistory = signal<AppError[]>([]);
    readonly errorHistory = this._errorHistory.asReadonly();

    override handleError(error: unknown): void {
        const appError = this.normalizeError(error);
        this.lastError.set(appError);

        // Maintain history (last 10)
        this._errorHistory.update(history => {
            const updated = [appError, ...history];
            return updated.slice(0, 10);
        });

        // Log via LogService (structured console + buffer)
        this.log.error(appError.message, 'unhandled-error', {
            stack: appError.stack,
            context: appError.context,
            timestamp: appError.timestamp.toISOString(),
        });

        // Report to Cloudflare Worker backend
        this.log.reportError({
            message: appError.message,
            stack: appError.stack,
            context: appError.context,
        });
    }

    /** Clear the current error (e.g. user clicks "Dismiss") */
    clearError(): void {
        this.lastError.set(null);
    }

    /** Clear all error history */
    clearHistory(): void {
        this._errorHistory.set([]);
        this.lastError.set(null);
    }

    private normalizeError(error: unknown): AppError {
        if (error instanceof Error) {
            return {
                message: error.message,
                stack: error.stack,
                timestamp: new Date(),
                context: (error as { ngDebugContext?: string }).ngDebugContext,
            };
        }

        if (typeof error === 'string') {
            return { message: error, timestamp: new Date() };
        }

        return {
            message: 'An unexpected error occurred',
            timestamp: new Date(),
            context: JSON.stringify(error),
        };
    }
}
