# Structured Logging & OpenTelemetry

← [Back to README](../../README.md)

## Structured Logging

The compiler supports structured JSON logging for production observability and log aggregation systems (CloudWatch, Datadog, Splunk, etc.).

### Basic Usage

```typescript
import { createLogger, LogLevel } from '@jk-com/adblock-compiler';

// Create a structured logger
const logger = createLogger({
    structured: true,
    level: LogLevel.Info,
});

// Log messages with context
logger.info('Processing started', { itemCount: 42 });
// Output: {"timestamp":"2024-01-01T12:00:00.000Z","level":"info","message":"Processing started","context":{"itemCount":42}}
```

### Advanced Features

```typescript
import { LogLevel, StructuredLogger } from '@jk-com/adblock-compiler';

// Create logger with correlation and trace IDs
const logger = new StructuredLogger({
    level: LogLevel.Info,
    prefix: 'compiler',
    correlationId: 'req-abc-123',
    traceId: 'trace-xyz-456',
});

// Log with additional context
logger.info('Compilation started', {
    sources: 5,
    transformations: 3,
});

// Create child logger (inherits correlation/trace IDs)
const sourceLogger = logger.child('source-1');
sourceLogger.info('Downloading filter list', { url: 'https://example.com/list.txt' });

// Update correlation ID dynamically
logger.setCorrelationId('req-def-789');

// All log levels supported
logger.trace('Detailed trace information', { step: 1 });
logger.debug('Debug information', { cacheHit: true });
logger.warn('Warning message', { retryCount: 3 });
logger.error('Error occurred', { errorCode: 'ERR_NETWORK' });
logger.success('Operation completed', { duration: 1234 });
```

### Structured Log Format

```json
{
    "timestamp": "2024-01-01T12:00:00.000Z",
    "level": "info",
    "message": "Processing started",
    "prefix": "compiler:source-1",
    "context": {
        "sources": 5,
        "transformations": 3
    },
    "correlationId": "req-abc-123",
    "traceId": "trace-xyz-456"
}
```

### Configuration Options

- `structured: boolean` - Enable JSON output mode (default: `false`)
- `level: LogLevel` - Minimum log level to output
- `prefix: string` - Logger name/prefix (included in output)
- `module: string` - Module name for this logger instance (enables module-specific log levels)
- `moduleOverrides: ModuleOverrides` - Per-module log level overrides
- `correlationId: string` - Correlation ID for grouping related logs
- `traceId: string` - Trace ID for distributed tracing
- `timestamps: boolean` - Not used in structured mode (always ISO 8601)
- `colors: boolean` - Not used in structured mode (JSON doesn't need colors)

### Per-Module Log Levels

Control log verbosity for specific modules independently of the global log level. Perfect for debugging specific components without flooding logs with verbose output from all modules.

**Basic Usage:**

```typescript
import { createLogger, LogLevel } from '@jk-com/adblock-compiler';

// Create logger with module-specific overrides
const logger = createLogger({
    level: LogLevel.Info, // Default level
    moduleOverrides: {
        'compiler': LogLevel.Debug, // Show debug logs for compiler
        'downloader': LogLevel.Trace, // Show all logs for downloader
    },
});

// Create module-specific loggers
const compilerLogger = createLogger({
    level: LogLevel.Info,
    module: 'compiler',
    prefix: 'Compiler',
    moduleOverrides: logger.getModuleOverrides(),
});

compilerLogger.debug('This will show'); // Module override is Debug
compilerLogger.info('This will also show');
```

**Environment Variable Configuration:**

```bash
# Set default level and module overrides via environment variables
export LOG_LEVEL=info
export LOG_MODULE_OVERRIDES=compiler:debug,downloader:trace

# Create logger from environment
import { createLoggerFromEnv } from '@jk-com/adblock-compiler';

const logger = createLoggerFromEnv({ prefix: 'myapp' });
```

**Real-World Example:**

```typescript
// Production setup: minimal logging by default, detailed for specific modules
const logger = createLogger({
    level: LogLevel.Warn, // Only warnings and errors by default
    moduleOverrides: {
        'compiler': LogLevel.Info, // Show compilation progress
        'downloader': LogLevel.Debug, // Debug network issues
    },
});

const compilerLogger = createLogger({
    level: LogLevel.Warn,
    module: 'compiler',
    prefix: 'FilterCompiler',
    moduleOverrides: {
        'compiler': LogLevel.Info,
        'downloader': LogLevel.Debug,
    },
});

const downloaderLogger = createLogger({
    level: LogLevel.Warn,
    module: 'downloader',
    prefix: 'FilterDownloader',
    moduleOverrides: {
        'compiler': LogLevel.Info,
        'downloader': LogLevel.Debug,
    },
});

const transformLogger = createLogger({
    level: LogLevel.Warn,
    module: 'transformation',
    prefix: 'Transformation',
    moduleOverrides: {
        'compiler': LogLevel.Info,
        'downloader': LogLevel.Debug,
    },
});

// Only logs matching their module's override level
compilerLogger.info('Starting compilation'); // Shows (override: Info)
downloaderLogger.debug('Checking cache'); // Shows (override: Debug)
transformLogger.info('Processing rules'); // Hidden (default: Warn)
```

**Child Loggers Inherit Module Configuration:**

```typescript
const parentLogger = createLogger({
    level: LogLevel.Info,
    module: 'compiler',
    moduleOverrides: { 'compiler': LogLevel.Debug },
});

// Child inherits module and overrides
const childLogger = parentLogger.child('SourceCompiler');
childLogger.debug('This shows'); // Inherits compiler:Debug override
```

See `examples/module-log-levels-example.ts` for more examples.

### Backward Compatibility

The standard `Logger` class remains unchanged and continues to output human-readable text:

```typescript
import { createLogger, LogLevel } from '@jk-com/adblock-compiler';

// Standard text logger (default)
const logger = createLogger({
    level: LogLevel.Info,
    timestamps: true,
    colors: true,
});

logger.info('Processing started');
// Output: 2024-01-01T12:00:00.000Z INFO Processing started
```

---

## OpenTelemetry Integration

The adblock-compiler supports **OpenTelemetry** for distributed tracing, enabling integration with major observability platforms like Datadog, Honeycomb, Jaeger, and others.

### Features

- **Standard OpenTelemetry API**: Compatible with all platforms supporting OTLP
- **Automatic instrumentation**: Compilation operations are automatically traced
- **Distributed tracing**: Context propagation across services
- **Rich ecosystem**: Works with standard OpenTelemetry exporters and collectors

### Basic Usage

```typescript
import { createOpenTelemetryExporter, SourceCompiler } from '@jk-com/adblock-compiler';

// Create an OpenTelemetry diagnostics collector
const diagnostics = createOpenTelemetryExporter({
    serviceName: 'adblock-compiler',
    enableConsoleLogging: false, // Optional: log to console for debugging
});

// Use with SourceCompiler
const compiler = new SourceCompiler({ diagnostics });

// All compilation operations are now traced
const rules = await compiler.compile({
    name: 'Example List',
    source: 'https://example.com/filters.txt',
});
```

### Running with Deno

Deno 2.2+ has built-in OpenTelemetry support. Enable it with environment variables:

```bash
# Enable OpenTelemetry in Deno
OTEL_DENO=true deno run --unstable-otel --allow-net your-script.ts

# Export to a custom OTLP endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
OTEL_DENO=true \
deno run --unstable-otel --allow-net your-script.ts
```

### Manual Span Creation

You can also create custom spans for fine-grained tracing:

```typescript
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { createOpenTelemetryExporter, createTracingContext, WorkerCompiler } from '@jk-com/adblock-compiler';

const tracer = trace.getTracer('my-service', '1.0.0');

await tracer.startActiveSpan('compile-filters', async (span) => {
    try {
        span.setAttribute('config.name', 'My Config');
        span.setAttribute('sources.count', 3);

        const otelExporter = createOpenTelemetryExporter();
        const tracingContext = createTracingContext({ diagnostics: otelExporter });
        const compiler = new WorkerCompiler({ tracingContext });

        const result = await compiler.compile(config);

        span.setAttribute('output.rules.count', result.length);
        span.setStatus({ code: SpanStatusCode.OK });

        return result;
    } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
    } finally {
        span.end();
    }
});
```

### Configuration Options

```typescript
interface OpenTelemetryExporterOptions {
    /** Service name for telemetry (default: 'adblock-compiler') */
    serviceName?: string;

    /** Service version (default: package version) */
    serviceVersion?: string;

    /** Enable console logging for debugging (default: false) */
    enableConsoleLogging?: boolean;

    /** Custom tracer instance (optional) */
    tracer?: Tracer;
}
```

### Viewing Traces

Set up a local OpenTelemetry collector with Grafana LGTM stack:

```bash
# Run with Docker Compose (example)
docker-compose -f docker-compose.otel.yml up -d

# Access Grafana at http://localhost:3000
# Default credentials: admin/admin
```

Traces include:

- **Operation spans**: Compilation, downloads, transformations
- **Performance metrics**: Duration, rule counts, sizes
- **Error tracking**: Exceptions with stack traces
- **Cache events**: Hit/miss/write operations
- **Network events**: HTTP requests with status codes

📚 **[OpenTelemetry Example](../../examples/opentelemetry-example.ts)** - Complete example with manual instrumentation
