# Centralized Error Reporting

← [Back to README](../../README.md)

The adblock-compiler provides centralized error reporting for production monitoring, enabling you to track errors across all instances and integrate with services like Sentry or Cloudflare Analytics Engine.

## Features

- **Multiple Backends**: Support for Sentry, Cloudflare Analytics Engine, and console logging
- **Composite Reporting**: Send errors to multiple services simultaneously
- **Context Enrichment**: Attach request metadata (IP, path, request ID) to error reports
- **Cloudflare Workers Integration**: Native support for edge runtime error tracking

## Basic Usage

The individual reporter classes live in `src/utils/ErrorReporter.ts` and are not currently re-exported from the package entry point. Import them directly from the source path when working within the repository, or use `createWorkerErrorReporter` (see [Cloudflare Worker Integration](#cloudflare-worker-integration)) for the Cloudflare Workers use case.

```typescript
import { CloudflareErrorReporter, CompositeErrorReporter, ConsoleErrorReporter, SentryErrorReporter } from '../../src/utils/ErrorReporter.ts';

// Console reporter (development)
const consoleReporter = new ConsoleErrorReporter(true /* verbose */);
consoleReporter.report(new Error('Test error'), {
    requestId: 'req-123',
    path: '/api/compile',
});

// Cloudflare Analytics Engine reporter (production)
const analyticsReporter = new CloudflareErrorReporter(env.ANALYTICS_ENGINE, {
    environment: 'production',
    release: '1.0.0',
});

// Sentry reporter (cloud-based)
const sentryReporter = new SentryErrorReporter('https://key@org.ingest.sentry.io/project', {
    environment: 'production',
    release: '1.0.0',
});

// Composite reporter (send to multiple services)
const reporter = new CompositeErrorReporter([
    consoleReporter,
    analyticsReporter,
    sentryReporter,
]);

// Report errors with context
try {
    await compileFilters(config);
} catch (error) {
    reporter.reportSync(error, {
        requestId: 'req-456',
        ip: '192.168.1.1',
        path: '/api/compile',
        configName: config.name,
    });
}
```

## Cloudflare Worker Integration

The worker includes a `createWorkerErrorReporter` helper in `worker/utils/errorReporter.ts` that automatically selects the right reporter based on environment variables:

```typescript
// In your Cloudflare Worker
import { createWorkerErrorReporter } from '../utils/errorReporter.ts';

export default {
    async fetch(request: Request, env: Env) {
        const errorReporter = createWorkerErrorReporter(env);

        try {
            return await handleRequest(request, env);
        } catch (error) {
            // Automatically reports to configured services
            errorReporter.reportSync(error, {
                requestId: crypto.randomUUID(),
                path: new URL(request.url).pathname,
                ip: request.headers.get('CF-Connecting-IP') || 'unknown',
            });
            return new Response('Internal Server Error', { status: 500 });
        }
    },
};
```

## Environment Configuration

Configure error reporting via environment variables in `wrangler.toml`:

```toml
[vars]
# Error reporter type: 'console', 'cloudflare', 'sentry', 'composite', or 'none'
ERROR_REPORTER_TYPE = "composite"

# Sentry configuration (optional)
SENTRY_DSN = "https://your-key@org.ingest.sentry.io/project-id"

# Verbose console logging
ERROR_REPORTER_VERBOSE = "true"
```

## Available Reporters

1. **ConsoleErrorReporter** - Logs errors to console with formatted output
2. **CloudflareErrorReporter** - Reports to Cloudflare Analytics Engine (no external dependencies)
3. **SentryErrorReporter** - Reports to Sentry with full stack traces and context
4. **CompositeErrorReporter** - Reports to multiple services simultaneously
5. **NoOpErrorReporter** - Disabled reporter for testing

## Error Context

All reporters support enriching errors with contextual data:

```typescript
interface ErrorContext {
    requestId?: string; // Unique request identifier
    ip?: string; // Client IP address
    path?: string; // Request path
    method?: string; // HTTP method
    [key: string]: unknown; // Any additional context
}
```
