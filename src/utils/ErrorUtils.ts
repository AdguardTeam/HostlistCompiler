/**
 * Standardized error handling utilities.
 * Provides consistent error handling patterns across the codebase.
 */

/**
 * Error codes for categorizing errors
 */
export enum ErrorCode {
    // Compilation errors
    COMPILATION_FAILED = 'COMPILATION_FAILED',
    CONFIGURATION_INVALID = 'CONFIGURATION_INVALID',
    SOURCE_FETCH_FAILED = 'SOURCE_FETCH_FAILED',
    TRANSFORMATION_FAILED = 'TRANSFORMATION_FAILED',

    // Network errors
    NETWORK_ERROR = 'NETWORK_ERROR',
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    NETWORK_CONNECTION_REFUSED = 'NETWORK_CONNECTION_REFUSED',
    HTTP_ERROR = 'HTTP_ERROR',
    HTTP_RATE_LIMITED = 'HTTP_RATE_LIMITED',

    // Validation errors
    VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',
    VALIDATION_INVALID_TYPE = 'VALIDATION_INVALID_TYPE',
    VALIDATION_CONSTRAINT = 'VALIDATION_CONSTRAINT',

    // File system errors
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    PERMISSION_DENIED = 'PERMISSION_DENIED',

    // Storage errors
    STORAGE_NOT_INITIALIZED = 'STORAGE_NOT_INITIALIZED',
    STORAGE_OPERATION_FAILED = 'STORAGE_OPERATION_FAILED',
}

/**
 * Base class for all custom errors in the application.
 * Provides consistent error structure with error codes.
 */
export abstract class BaseError extends Error {
    /** Error code for categorization */
    public readonly code: ErrorCode;
    /** Original error that caused this error */
    public override readonly cause?: Error;
    /** ISO timestamp when the error occurred */
    public readonly timestamp: string;

    /**
     * Creates a new BaseError
     * @param message - Error message
     * @param code - Error code for categorization
     * @param cause - Original error that caused this error
     */
    constructor(message: string, code: ErrorCode, cause?: Error) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.timestamp = new Date().toISOString();
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Returns a JSON-serializable representation of the error
     */
    public toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            timestamp: this.timestamp,
            cause: this.cause?.message,
            stack: this.stack,
        };
    }
}

/**
 * Custom error class for compilation errors
 */
export class CompilationError extends BaseError {
    /**
     * Creates a new CompilationError
     * @param message - Error message
     * @param code - Error code (defaults to COMPILATION_FAILED)
     * @param cause - Original error that caused this error
     */
    constructor(message: string, code: ErrorCode = ErrorCode.COMPILATION_FAILED, cause?: Error) {
        super(message, code, cause);
        this.name = 'CompilationError';
    }
}

/**
 * Custom error class for configuration errors
 */
export class ConfigurationError extends BaseError {
    /** Name of the configuration that caused the error */
    public readonly configName?: string;

    /**
     * Creates a new ConfigurationError
     * @param message - Error message
     * @param configName - Name of the configuration
     * @param cause - Original error that caused this error
     */
    constructor(message: string, configName?: string, cause?: Error) {
        super(message, ErrorCode.CONFIGURATION_INVALID, cause);
        this.name = 'ConfigurationError';
        this.configName = configName;
    }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends BaseError {
    /** Path to the invalid field */
    public readonly path: string;
    /** Detailed validation error messages */
    public readonly details: string[];

    /**
     * Creates a new ValidationError
     * @param message - Error message
     * @param path - Path to the invalid field
     * @param details - Detailed validation error messages
     * @param cause - Original error that caused this error
     */
    constructor(message: string, path: string, details: string[] = [], cause?: Error) {
        super(message, ErrorCode.VALIDATION_CONSTRAINT, cause);
        this.name = 'ValidationError';
        this.path = path;
        this.details = details;
    }
}

/**
 * Custom error class for network errors
 */
export class NetworkError extends BaseError {
    /** URL that failed */
    public readonly url: string;
    /** HTTP status code if available */
    public readonly statusCode?: number;
    /** Whether the request can be retried */
    public readonly retryable: boolean;

    /**
     * Creates a new NetworkError
     * @param message - Error message
     * @param url - URL that failed
     * @param statusCode - HTTP status code
     * @param retryable - Whether the request can be retried
     */
    constructor(message: string, url: string, statusCode?: number, retryable = false) {
        const code = NetworkError.getErrorCode(statusCode);
        super(message, code);
        this.name = 'NetworkError';
        this.url = url;
        this.statusCode = statusCode;
        this.retryable = retryable;
    }

    /**
     * Gets error code from status code
     * @param statusCode - HTTP status code
     * @returns Appropriate error code
     */
    private static getErrorCode(statusCode?: number): ErrorCode {
        if (statusCode === 429) return ErrorCode.HTTP_RATE_LIMITED;
        if (statusCode && statusCode >= 400) return ErrorCode.HTTP_ERROR;
        return ErrorCode.NETWORK_ERROR;
    }
}

/**
 * Custom error class for source errors
 */
export class SourceError extends BaseError {
    /** Source URL or path that failed */
    public readonly source: string;

    /**
     * Creates a new SourceError
     * @param message - Error message
     * @param source - Source URL or path
     * @param cause - Original error that caused this error
     */
    constructor(message: string, source: string, cause?: Error) {
        super(message, ErrorCode.SOURCE_FETCH_FAILED, cause);
        this.name = 'SourceError';
        this.source = source;
    }
}

/**
 * Custom error class for transformation errors
 */
export class TransformationError extends BaseError {
    public readonly transformationType: string;
    public readonly ruleCount?: number;

    constructor(message: string, transformationType: string, ruleCount?: number, cause?: Error) {
        super(message, ErrorCode.TRANSFORMATION_FAILED, cause);
        this.name = 'TransformationError';
        this.transformationType = transformationType;
        this.ruleCount = ruleCount;
    }
}

/**
 * Custom error class for storage errors
 */
export class StorageError extends BaseError {
    public readonly operation: string;
    public readonly key?: string[];

    constructor(message: string, operation: string, key?: string[], cause?: Error) {
        super(message, ErrorCode.STORAGE_OPERATION_FAILED, cause);
        this.name = 'StorageError';
        this.operation = operation;
        this.key = key;
    }
}

/**
 * Custom error class for file system errors
 */
export class FileSystemError extends BaseError {
    public readonly path: string;

    constructor(message: string, path: string, code: ErrorCode = ErrorCode.FILE_NOT_FOUND, cause?: Error) {
        super(message, code, cause);
        this.name = 'FileSystemError';
        this.path = path;
    }
}

/**
 * Error utility functions providing consistent error handling across the codebase.
 */
export class ErrorUtils {
    /**
     * Extracts error message from unknown error type.
     * This is the standard way to get error messages - use this instead of inline checks.
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
     * Wraps an error with additional context.
     * Use this to add context when re-throwing errors.
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
     * Converts unknown error to Error instance.
     * Preserves the original error if it's already an Error.
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
     * Checks if an error is retryable (network-related).
     * Use this to determine if an operation should be retried.
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
                message.includes('fetch failed') ||
                message.includes('http 5') ||
                message.includes('http 429')
            );
        }
        return false;
    }

    /**
     * Creates a formatted error stack for logging.
     * Includes cause chain if available.
     * @param error - Error to format
     * @returns Formatted error string
     */
    static format(error: unknown): string {
        if (error instanceof BaseError) {
            const lines = [
                `${error.name} [${error.code}]: ${error.message}`,
                `  Timestamp: ${error.timestamp}`,
            ];
            if (error.cause instanceof Error) {
                lines.push(`  Caused by: ${error.cause.name}: ${error.cause.message}`);
            }
            if (error.stack) {
                lines.push('  Stack trace:', error.stack);
            }
            return lines.join('\n');
        }
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

    // ============================================================================
    // Factory methods for creating specific error types
    // ============================================================================

    /**
     * Creates a NetworkError for HTTP failures.
     * @param url - The URL that failed
     * @param statusCode - HTTP status code
     * @param statusText - HTTP status text
     */
    static httpError(url: string, statusCode: number, statusText: string): NetworkError {
        const retryable = statusCode >= 500 || statusCode === 429;
        return new NetworkError(
            `HTTP ${statusCode}: ${statusText}`,
            url,
            statusCode,
            retryable,
        );
    }

    /**
     * Creates a NetworkError for timeout failures.
     * @param url - The URL that timed out
     * @param timeoutMs - Timeout duration in milliseconds
     */
    static timeoutError(url: string, timeoutMs: number): NetworkError {
        return new NetworkError(
            `Request timeout after ${timeoutMs}ms`,
            url,
            undefined,
            true, // Timeouts are retryable
        );
    }

    /**
     * Creates a SourceError for source download failures.
     * @param source - The source that failed
     * @param cause - The underlying error
     */
    static sourceDownloadError(source: string, cause?: Error): SourceError {
        const message = cause ? `Failed to download source ${source}: ${cause.message}` : `Failed to download source ${source}`;
        return new SourceError(message, source, cause);
    }

    /**
     * Creates a ConfigurationError for invalid configurations.
     * @param message - Error message
     * @param configName - Configuration name
     */
    static configurationError(message: string, configName?: string): ConfigurationError {
        return new ConfigurationError(message, configName);
    }

    /**
     * Creates a TransformationError for transformation failures.
     * @param transformationType - The transformation that failed
     * @param message - Error message
     * @param ruleCount - Number of rules being transformed
     * @param cause - The underlying error
     */
    static transformationError(
        transformationType: string,
        message: string,
        ruleCount?: number,
        cause?: Error,
    ): TransformationError {
        return new TransformationError(message, transformationType, ruleCount, cause);
    }

    /**
     * Creates a FileSystemError for file not found.
     * @param path - The file path
     */
    static fileNotFoundError(path: string): FileSystemError {
        return new FileSystemError(`File not found: ${path}`, path, ErrorCode.FILE_NOT_FOUND);
    }

    /**
     * Creates a FileSystemError for permission denied.
     * @param path - The file path
     * @param operation - The operation that was denied
     */
    static permissionDeniedError(path: string, operation: string): FileSystemError {
        return new FileSystemError(
            `Permission denied: ${operation} on ${path}`,
            path,
            ErrorCode.PERMISSION_DENIED,
        );
    }

    /**
     * Creates a StorageError for storage operations.
     * @param operation - The operation that failed
     * @param key - The storage key
     * @param cause - The underlying error
     */
    static storageError(operation: string, key?: string[], cause?: Error): StorageError {
        const keyStr = key ? key.join('/') : 'unknown';
        const message = cause ? `Storage ${operation} failed for key ${keyStr}: ${cause.message}` : `Storage ${operation} failed for key ${keyStr}`;
        return new StorageError(message, operation, key, cause);
    }

    // ============================================================================
    // Type guards for error classification
    // ============================================================================

    /**
     * Checks if an error is a BaseError (custom application error).
     */
    static isBaseError(error: unknown): error is BaseError {
        return error instanceof BaseError;
    }

    /**
     * Checks if an error is a NetworkError.
     */
    static isNetworkError(error: unknown): error is NetworkError {
        return error instanceof NetworkError;
    }

    /**
     * Checks if an error is a ValidationError.
     */
    static isValidationError(error: unknown): error is ValidationError {
        return error instanceof ValidationError;
    }

    /**
     * Checks if an error is a ConfigurationError.
     */
    static isConfigurationError(error: unknown): error is ConfigurationError {
        return error instanceof ConfigurationError;
    }

    /**
     * Gets the error code if the error is a BaseError, otherwise returns undefined.
     */
    static getErrorCode(error: unknown): ErrorCode | undefined {
        if (error instanceof BaseError) {
            return error.code;
        }
        return undefined;
    }
}
