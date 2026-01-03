/**
 * Async retry utility with exponential backoff and jitter.
 * Provides a reusable higher-order function for retrying async operations.
 */

/**
 * Options for retry behavior
 */
export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Initial delay in milliseconds (default: 1000) */
    initialDelay?: number;
    /** Maximum delay in milliseconds (default: 30000) */
    maxDelay?: number;
    /** Exponential backoff factor (default: 2) */
    backoffFactor?: number;
    /** Jitter factor between 0-1 (default: 0.3 = 30%) */
    jitterFactor?: number;
    /** Function to determine if error should trigger retry */
    shouldRetry?: (error: Error, attempt: number) => boolean;
    /** Callback invoked before each retry */
    onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitterFactor: 0.3,
    shouldRetry: () => true,
    onRetry: () => {},
} as const;

/**
 * Retry result with attempt information
 */
export interface RetryResult<T> {
    /** The successful result */
    value: T;
    /** Number of attempts made (1 = succeeded on first try) */
    attempts: number;
}

/**
 * Executes an async operation with retry logic and exponential backoff.
 * 
 * @param operation - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws The last error if all retries are exhausted
 * 
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     shouldRetry: (error) => error.message.includes('timeout'),
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
): Promise<RetryResult<T>> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            const value = await operation();
            return { value, attempts: attempt + 1 };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            // Check if we should retry
            const isLastAttempt = attempt === opts.maxRetries;
            if (isLastAttempt || !opts.shouldRetry(lastError, attempt)) {
                throw lastError;
            }
            
            // Calculate delay with exponential backoff and jitter
            const exponentialDelay = Math.min(
                opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
                opts.maxDelay
            );
            const jitter = Math.random() * opts.jitterFactor * exponentialDelay;
            const delay = Math.floor(exponentialDelay + jitter);
            
            // Notify before retry
            opts.onRetry(lastError, attempt + 1, delay);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    // This should never be reached due to the throw in the loop,
    // but TypeScript requires it
    throw lastError ?? new Error('Retry failed with unknown error');
}

/**
 * Common retry strategies for different scenarios
 */
export const RetryStrategies = {
    /**
     * Retry only on network errors (5xx, timeouts, connection errors)
     */
    networkErrors: (error: Error): boolean => {
        const message = error.message.toLowerCase();
        return message.includes('timeout') ||
               message.includes('network') ||
               message.includes('econnrefused') ||
               message.includes('enotfound') ||
               message.includes('http 5') ||
               message.includes('http 429'); // Rate limiting
    },
    
    /**
     * Retry on any error (use with caution)
     */
    allErrors: (): boolean => true,
    
    /**
     * Never retry (for critical errors)
     */
    never: (): boolean => false,
    
    /**
     * Retry only on specific HTTP status codes
     */
    httpStatusCodes: (...codes: number[]) => (error: Error): boolean => {
        const statusMatch = error.message.match(/HTTP (\d+)/);
        if (!statusMatch) return false;
        const status = parseInt(statusMatch[1], 10);
        return codes.includes(status);
    },
} as const;
