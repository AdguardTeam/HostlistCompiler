# GitHub Issue Templates

This document provides ready-to-use GitHub issue templates for the bugs and features identified in the production readiness assessment.

---

## Critical Bugs

### BUG-002: Add request body size limits

**Title**: Add request body size limits to prevent DoS attacks

**Labels**: `bug`, `security`, `priority:critical`

**Description**:
Currently, the worker endpoints do not enforce request body size limits, which could allow DoS attacks via large payloads.

**Impact**:

- Memory exhaustion
- Worker crashes
- Service unavailability

**Affected Files**:

- `worker/handlers/compile.ts`
- `worker/middleware/index.ts`

**Proposed Solution**:

```typescript
async function validateRequestSize(
    request: Request,
    maxBytes: number = 1024 * 1024,
): Promise<void> {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxBytes) {
        throw new Error(`Request body exceeds ${maxBytes} bytes`);
    }
    // Also enforce during body read for requests without Content-Length
}
```

**Acceptance Criteria**:

- [ ] Request body size limited to 1MB by default
- [ ] Configurable via environment variable
- [ ] Returns 413 Payload Too Large when exceeded
- [ ] Tests added for size limit validation

---

### BUG-010: Add CSRF protection

**Title**: Add CSRF protection to state-changing endpoints

**Labels**: `bug`, `security`, `priority:critical`

**Description**:
Worker endpoints accept POST requests without CSRF token validation, making them vulnerable to CSRF attacks.

**Impact**:

- Unauthorized actions via cross-site requests
- Security vulnerability

**Affected Files**:

- `worker/handlers/compile.ts`
- `worker/middleware/index.ts`

**Proposed Solution**:

```typescript
function validateCsrfToken(request: Request): boolean {
    const token = request.headers.get('X-CSRF-Token');
    const cookie = getCookie(request, 'csrf-token');
    return Boolean(token && cookie && token === cookie);
}
```

**Acceptance Criteria**:

- [ ] CSRF token validation middleware created
- [ ] Applied to all POST/PUT/DELETE endpoints
- [ ] Token generation endpoint added
- [ ] Tests added for CSRF validation
- [ ] Documentation updated

---

### BUG-012: Add SSRF protection for source URLs

**Title**: Prevent SSRF attacks via malicious source URLs

**Labels**: `bug`, `security`, `priority:critical`

**Description**:
The FilterDownloader fetches arbitrary URLs without validation, allowing potential SSRF attacks to access internal networks.

**Impact**:

- Access to internal network resources
- Potential data exposure
- Security vulnerability

**Affected Files**:

- `src/downloader/FilterDownloader.ts`
- `src/platform/HttpFetcher.ts`

**Proposed Solution**:

```typescript
function isSafeUrl(url: string): boolean {
    const parsed = new URL(url);

    // Block private IPs
    if (
        parsed.hostname === 'localhost' ||
        parsed.hostname.startsWith('127.') ||
        parsed.hostname.startsWith('192.168.') ||
        parsed.hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(parsed.hostname)
    ) {
        return false;
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
    }

    return true;
}
```

**Acceptance Criteria**:

- [ ] URL validation function created
- [ ] Blocks localhost, private IPs, link-local addresses
- [ ] Only allows HTTP/HTTPS protocols
- [ ] Tests added for URL validation
- [ ] Error handling for blocked URLs
- [ ] Documentation updated

---

## Critical Features

### FEATURE-001: Add structured JSON logging

**Title**: Implement structured JSON logging for production observability

**Labels**: `enhancement`, `observability`, `priority:critical`

**Description**:
Current logging outputs human-readable text which is difficult to parse in production log aggregation systems. Need structured JSON format.

**Why**:
Production log aggregation systems (CloudWatch, Datadog, Splunk) require structured logs for:

- Filtering and searching
- Alerting on specific conditions
- Analytics and dashboards

**Affected Files**:

- `src/utils/logger.ts`
- `src/types/index.ts`

**Proposed Implementation**:

```typescript
interface StructuredLog {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    correlationId?: string;
    traceId?: string;
}

class StructuredLogger extends Logger {
    log(level: LogLevel, message: string, context?: Record<string, unknown>) {
        const entry: StructuredLog = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            correlationId: this.correlationId,
        };
        console.log(JSON.stringify(entry));
    }
}
```

**Acceptance Criteria**:

- [ ] StructuredLogger class created
- [ ] JSON output format implemented
- [ ] Backward compatible with existing Logger
- [ ] Configuration option to enable JSON mode
- [ ] Tests added for structured logging
- [ ] Documentation updated

---

### FEATURE-004: Add Zod schema validation

**Title**: Replace manual validation with Zod schema validation

**Labels**: `enhancement`, `validation`, `priority:critical`

**Description**:
Current manual validation is error-prone and lacks type safety. Zod provides runtime validation with TypeScript integration.

**Why**:

- Type-safe validation
- Better error messages
- Reduced boilerplate
- Maintained by community

**Affected Files**:

- `src/configuration/ConfigurationValidator.ts`
- `worker/handlers/compile.ts`
- `deno.json` (add dependency)

**Proposed Implementation**:

```typescript
import { z } from "https://deno.land/x/zod/mod.ts";

const SourceSchema = z.object({
    source: z.string().url(),
    name: z.string().optional(),
    type: z.enum(['adblock', 'hosts']).optional(),
});

const ConfigurationSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    sources: z.array(SourceSchema).nonempty(),
    transformations: z.array(z.nativeEnum(TransformationType)).optional(),
    exclusions: z.array(z.string()).optional(),
    inclusions: z.array(z.string()).optional(),
});
```

**Acceptance Criteria**:

- [ ] Zod dependency added to deno.json
- [ ] ConfigurationSchema created
- [ ] ConfigurationValidator refactored to use Zod
- [ ] Request body schemas added to handlers
- [ ] Error messages match or improve on current format
- [ ] All tests passing
- [ ] Documentation updated

---

### FEATURE-006: Add centralized error reporting service

**Title**: Implement centralized error reporting for production monitoring

**Labels**: `enhancement`, `observability`, `priority:critical`

**Description**:
Errors are currently only logged locally. Need centralized error reporting to tracking services like Sentry or Datadog.

**Why**:

- Aggregate errors across all instances
- Alert on error rate increases
- Track error trends
- Capture stack traces and context
- Monitor production health

**Affected Files**:

- Create `src/utils/ErrorReporter.ts`
- Update all try/catch blocks

**Proposed Implementation**:

```typescript
interface ErrorReporter {
    report(error: Error, context?: Record<string, unknown>): void;
}

class SentryErrorReporter implements ErrorReporter {
    constructor(private dsn: string) {}

    report(error: Error, context?: Record<string, unknown>): void {
        // Send to Sentry with context
    }
}

class ConsoleErrorReporter implements ErrorReporter {
    report(error: Error, context?: Record<string, unknown>): void {
        console.error(ErrorUtils.format(error), context);
    }
}
```

**Acceptance Criteria**:

- [ ] ErrorReporter interface created
- [ ] SentryErrorReporter implementation
- [ ] ConsoleErrorReporter implementation
- [ ] Integration points added to catch blocks
- [ ] Configuration via environment variable
- [ ] Tests added
- [ ] Documentation updated

---

### FEATURE-008: Implement circuit breaker pattern

**Title**: Add circuit breaker for unreliable source downloads

**Labels**: `enhancement`, `resilience`, `priority:critical`

**Description**:
When filter list sources are consistently failing, we continue retrying them, wasting resources. Circuit breaker prevents cascading failures.

**Why**:

- Prevent resource waste on failing sources
- Fail fast for known-bad sources
- Automatic recovery attempt after timeout
- Improve overall system resilience

**Affected Files**:

- Create `src/utils/CircuitBreaker.ts`
- `src/downloader/FilterDownloader.ts`

**Proposed Implementation**:

```typescript
class CircuitBreaker {
    private failureCount = 0;
    private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
    private lastFailureTime?: Date;

    constructor(
        private threshold: number = 5,
        private timeout: number = 60000,
    ) {}

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime!.getTime() > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
}
```

**Acceptance Criteria**:

- [ ] CircuitBreaker class created
- [ ] States: CLOSED, OPEN, HALF_OPEN
- [ ] Configurable failure threshold and timeout
- [ ] Integration with FilterDownloader
- [ ] Status monitoring endpoint
- [ ] Tests added for all states
- [ ] Documentation updated

---

### FEATURE-009: Add OpenTelemetry integration

**Title**: Implement OpenTelemetry for distributed tracing

**Labels**: `enhancement`, `observability`, `priority:critical`

**Description**:
Current tracing system is custom and not compatible with standard observability platforms. OpenTelemetry is industry standard.

**Why**:

- Compatible with all major platforms (Datadog, Honeycomb, Jaeger)
- Distributed tracing across services
- Standard instrumentation
- Rich ecosystem of integrations

**Affected Files**:

- Create `src/diagnostics/OpenTelemetryExporter.ts`
- `src/compiler/SourceCompiler.ts`
- `worker/worker.ts`
- `deno.json` (add dependency)

**Proposed Implementation**:

```typescript
import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer('adblock-compiler', VERSION);

async function compileWithTracing(config: IConfiguration): Promise<string> {
    return tracer.startActiveSpan('compile', async (span) => {
        try {
            span.setAttribute('config.name', config.name);
            span.setAttribute('config.sources.count', config.sources.length);

            const result = await compile(config);

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
}
```

**Acceptance Criteria**:

- [ ] OpenTelemetry dependencies added
- [ ] Tracer configuration
- [ ] Spans added to compilation operations
- [ ] Integration with existing tracing context
- [ ] Exporter configuration (OTLP, console)
- [ ] Tests added
- [ ] Documentation updated

---

## Medium Priority Examples

### FEATURE-002: Per-module log level configuration

**Title**: Add per-module log level configuration

**Labels**: `enhancement`, `observability`, `priority:medium`

**Description**:
Currently log level is global. Need ability to set different log levels for different modules during debugging.

**Example**:

```typescript
const logger = new Logger({
    defaultLevel: LogLevel.Info,
    moduleOverrides: {
        "compiler": LogLevel.Debug,
        "downloader": LogLevel.Trace,
    },
});
```

**Acceptance Criteria**:

- [ ] LoggerConfig interface with moduleOverrides
- [ ] Logger respects module-specific levels
- [ ] Configuration via environment variables
- [ ] Tests added
- [ ] Documentation updated

---

### BUG-004: Fix silent error swallowing in FilterService

**Title**: FilterService should not silently swallow download errors

**Labels**: `bug`, `error-handling`, `priority:medium`

**Description**:
FilterService.downloadSource() catches errors and returns empty string, making it impossible for callers to know if download failed.

**Location**: `src/services/FilterService.ts:44`

**Current Code**:

```typescript
try {
    const content = await this.downloader.download(source);
    return content;
} catch (error) {
    this.logger.error(`Failed to download source: ${source}`, error);
    return ''; // Silent failure
}
```

**Proposed Solutions**:

Option 1: Let error propagate

```typescript
throw ErrorUtils.wrap(error, `Failed to download source: ${source}`);
```

Option 2: Return Result type

```typescript
return { success: false, error: ErrorUtils.getMessage(error) };
```

**Acceptance Criteria**:

- [ ] Choose and implement solution
- [ ] Update callers to handle errors
- [ ] Tests added for error cases
- [ ] Documentation updated

---

## Summary Statistics

**Total Items**: 22 (12 bugs + 10 features shown as examples)

**By Priority**:

- Critical: 12 items
- High: 7 items
- Medium: 10 items
- Low: 5 items

**By Category**:

- Security: 5 items
- Observability: 8 items
- Validation: 4 items
- Error Handling: 4 items
- Testing: 3 items
- Operations: 3 items

**Estimated Effort**: 8-12 weeks for all items

---

## Creating Issues

To create issues from these templates:

1. Copy the relevant template above
2. Create new issue in GitHub
3. Paste template content
4. Add appropriate labels
5. Assign to milestone if applicable
6. Link related issues

## Bulk Creation Script

For bulk issue creation, consider using GitHub CLI:

```bash
# Example for BUG-002
gh issue create \
  --title "Add request body size limits to prevent DoS attacks" \
  --body-file issue-templates/BUG-002.md \
  --label "bug,security,priority:critical"
```

---

See `BUGS_AND_FEATURES.md` for quick reference list and `PRODUCTION_READINESS.md` for detailed analysis.
