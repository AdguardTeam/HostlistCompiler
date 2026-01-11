/**
 * Standardized error handling utilities.
 * Provides consistent error handling patterns across the codebase.
 */

/**
 * Custom error class for compilation errors
 */
export class CompilationError extends Error {
    public readonly code: string;
    public readonly cause?: Error;

    constructor(message: string, code: string, cause?: Error) {
        super(message);
        this.name = 'CompilationError';
        this.code = code;
        this.cause = cause;
    }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
    public readonly path: string;
    public readonly details: string[];

    constructor(message: string, path: string, details: string[] = []) {
        super(message);
        this.name = 'ValidationError';
        this.path = path;
        this.details = details;
    }
}

/**
 * Custom error class for network errors
 */
export class NetworkError extends Error {
    public readonly url: string;
    public readonly statusCode?: number;
    public readonly retryable: boolean;

    constructor(message: string, url: string, statusCode?: number, retryable = false) {
        super(message);
        this.name = 'NetworkError';
        this.url = url;
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

/**
 * Custom error class for source errors
 */
export class SourceError extends Error {
    public readonly source: string;
    public readonly cause?: Error;

    constructor(message: string, source: string, cause?: Error) {
        super(message);
        this.name = 'SourceError';
        this.source = source;
        this.cause = cause;
    }
}

/**
 * Error utility functions
 */
export class ErrorUtils {
    /**
     * Extracts error message from unknown error type
     * @param error - Unknown error value
     * @returns Error message string
     */
    static getMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return String(error);
    }

    /**
     * Wraps an error with additional context
     * @param error - Original error
     * @param context - Additional context message
     * @returns New error with context
     */
    static wrap(error: unknown, context: string): Error {
        const message = `${context}: ${this.getMessage(error)}`;
        const wrapped = new Error(message);
        if (error instanceof Error) {
            wrapped.cause = error;
        }
        return wrapped;
    }

    /**
     * Converts unknown error to Error instance
     * @param error - Unknown error value
     * @returns Error instance
     */
    static toError(error: unknown): Error {
        if (error instanceof Error) {
            return error;
        }
        return new Error(this.getMessage(error));
    }

    /**
     * Checks if an error is retryable (network-related)
     * @param error - Error to check
     * @returns True if the error is retryable
     */
    static isRetryable(error: unknown): boolean {
        if (error instanceof NetworkError) {
            return error.retryable;
        }
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return (
                message.includes('timeout') ||
                message.includes('econnreset') ||
                message.includes('econnrefused') ||
                message.includes('network') ||
                message.includes('fetch failed')
            );
        }
        return false;
    }

    /**
     * Creates a formatted error stack for logging
     * @param error - Error to format
     * @returns Formatted error string
     */
    static format(error: unknown): string {
        if (error instanceof Error) {
            const lines = [`${error.name}: ${error.message}`];
            if (error.cause instanceof Error) {
                lines.push(`  Caused by: ${error.cause.message}`);
            }
            if (error.stack) {
                lines.push(error.stack);
            }
            return lines.join('\n');
        }
        return String(error);
    }
}
