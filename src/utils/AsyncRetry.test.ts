import { assertEquals, assertRejects } from '@std/assert';
import { RetryStrategies, withRetry } from './AsyncRetry.ts';

Deno.test('withRetry - should succeed on first attempt', async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
        attempts++;
        return 'success';
    });

    assertEquals(result.value, 'success');
    assertEquals(result.attempts, 1);
    assertEquals(attempts, 1);
});

Deno.test('withRetry - should retry on failure and succeed', async () => {
    let attempts = 0;
    const result = await withRetry(
        async () => {
            attempts++;
            if (attempts < 3) {
                throw new Error('temporary failure');
            }
            return 'success';
        },
        {
            maxRetries: 3,
            initialDelay: 10,
        },
    );

    assertEquals(result.value, 'success');
    assertEquals(result.attempts, 3);
});

Deno.test('withRetry - should throw after exhausting retries', async () => {
    let attempts = 0;
    await assertRejects(
        async () => {
            await withRetry(
                async () => {
                    attempts++;
                    throw new Error('always fails');
                },
                {
                    maxRetries: 2,
                    initialDelay: 10,
                },
            );
        },
        Error,
        'always fails',
    );

    assertEquals(attempts, 3); // Initial + 2 retries
});

Deno.test('withRetry - should respect shouldRetry callback', async () => {
    let attempts = 0;
    await assertRejects(
        async () => {
            await withRetry(
                async () => {
                    attempts++;
                    throw new Error('do not retry');
                },
                {
                    maxRetries: 5,
                    shouldRetry: () => false,
                },
            );
        },
        Error,
        'do not retry',
    );

    assertEquals(attempts, 1); // Should not retry
});

Deno.test('withRetry - should call onRetry callback', async () => {
    const retryLogs: { error: string; attempt: number; delay: number }[] = [];
    let attempts = 0;

    const result = await withRetry(
        async () => {
            attempts++;
            if (attempts < 3) {
                throw new Error(`failure ${attempts}`);
            }
            return 'done';
        },
        {
            maxRetries: 3,
            initialDelay: 10,
            onRetry: (error, attempt, delay) => {
                retryLogs.push({ error: error.message, attempt, delay });
            },
        },
    );

    assertEquals(result.value, 'done');
    assertEquals(retryLogs.length, 2);
    assertEquals(retryLogs[0].attempt, 1);
    assertEquals(retryLogs[1].attempt, 2);
});

Deno.test('withRetry - should handle non-Error throws', async () => {
    let attempts = 0;
    await assertRejects(
        async () => {
            await withRetry(
                async () => {
                    attempts++;
                    throw 'string error';
                },
                {
                    maxRetries: 1,
                    initialDelay: 10,
                },
            );
        },
        Error,
        'string error',
    );
});

Deno.test('withRetry - should use default options', async () => {
    const result = await withRetry(async () => 'default');

    assertEquals(result.value, 'default');
    assertEquals(result.attempts, 1);
});

Deno.test('withRetry - should respect maxDelay', async () => {
    let attempts = 0;
    const startTime = Date.now();

    await assertRejects(
        async () => {
            await withRetry(
                async () => {
                    attempts++;
                    throw new Error('fail');
                },
                {
                    maxRetries: 2,
                    initialDelay: 10,
                    maxDelay: 20,
                    backoffFactor: 10, // Would normally result in large delays
                    jitterFactor: 0,
                },
            );
        },
        Error,
    );

    const elapsed = Date.now() - startTime;
    // Should be capped by maxDelay, not exponential
    assertEquals(elapsed < 100, true);
});

// RetryStrategies tests
Deno.test('RetryStrategies.networkErrors - should match timeout errors', () => {
    const error = new Error('Request timeout');
    assertEquals(RetryStrategies.networkErrors(error), true);
});

Deno.test('RetryStrategies.networkErrors - should match network errors', () => {
    const error = new Error('Network error occurred');
    assertEquals(RetryStrategies.networkErrors(error), true);
});

Deno.test('RetryStrategies.networkErrors - should match connection refused', () => {
    const error = new Error('ECONNREFUSED');
    assertEquals(RetryStrategies.networkErrors(error), true);
});

Deno.test('RetryStrategies.networkErrors - should match DNS errors', () => {
    const error = new Error('ENOTFOUND');
    assertEquals(RetryStrategies.networkErrors(error), true);
});

Deno.test('RetryStrategies.networkErrors - should match HTTP 5xx errors', () => {
    const error = new Error('HTTP 500 Internal Server Error');
    assertEquals(RetryStrategies.networkErrors(error), true);
});

Deno.test('RetryStrategies.networkErrors - should match rate limiting', () => {
    const error = new Error('HTTP 429 Too Many Requests');
    assertEquals(RetryStrategies.networkErrors(error), true);
});

Deno.test('RetryStrategies.networkErrors - should not match client errors', () => {
    const error = new Error('HTTP 404 Not Found');
    assertEquals(RetryStrategies.networkErrors(error), false);
});

Deno.test('RetryStrategies.allErrors - should always return true', () => {
    assertEquals(RetryStrategies.allErrors(), true);
});

Deno.test('RetryStrategies.never - should always return false', () => {
    assertEquals(RetryStrategies.never(), false);
});

Deno.test('RetryStrategies.httpStatusCodes - should match specified codes', () => {
    const strategy = RetryStrategies.httpStatusCodes(500, 502, 503);

    assertEquals(strategy(new Error('HTTP 500 error')), true);
    assertEquals(strategy(new Error('HTTP 502 error')), true);
    assertEquals(strategy(new Error('HTTP 503 error')), true);
    assertEquals(strategy(new Error('HTTP 404 error')), false);
    assertEquals(strategy(new Error('No HTTP status')), false);
});
