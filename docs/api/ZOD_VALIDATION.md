# Zod Validation Integration

This document describes the Zod schema validation system integrated into the adblock-compiler project.

## Overview

The adblock-compiler uses [Zod](https://zod.dev/) for runtime validation of configuration objects, API requests, and internal data structures. Zod provides:

- **Type-safe validation**: Runtime validation with automatic TypeScript type inference
- **Composable schemas**: Build complex schemas from simple building blocks
- **Detailed error messages**: User-friendly validation error reporting
- **Zero dependencies**: Lightweight and fast validation

## Available Schemas

### Configuration Schemas

#### `SourceSchema`

Validates individual source configurations in a filter list compilation.

```typescript
import { SourceSchema } from '@jk-com/adblock-compiler';

const source = {
    source: 'https://example.com/filters.txt',
    name: 'Example Filters',
    type: 'adblock',
    exclusions: ['*ads*'],
    transformations: ['RemoveComments', 'Deduplicate'],
};

const result = SourceSchema.safeParse(source);
if (result.success) {
    console.log('Valid source:', result.data);
} else {
    console.error('Validation errors:', result.error);
}
```

**Schema Definition:**
- `source` (string, required): URL (e.g. `https://example.com/list.txt`) or file path (`/absolute/path` or `./relative/path`) to the filter list source. Plain strings that are neither a valid URL nor a recognized path are rejected.
- `name` (string, optional): Human-readable name for the source
- `type` (enum, optional): Source type - `'adblock'` or `'hosts'`
- `exclusions` (string[], optional): List of rules or wildcards to exclude
- `exclusions_sources` (string[], optional): List of files containing exclusions
- `inclusions` (string[], optional): List of wildcards to include
- `inclusions_sources` (string[], optional): List of files containing inclusions
- `transformations` (TransformationType[], optional): List of transformations to apply

**Normalization (`.transform()`):**

`SourceSchema` automatically normalizes the parsed data:
- `source`: leading and trailing whitespace is trimmed (whitespace-only values are rejected during validation)
- `name`: leading and trailing whitespace is trimmed (if provided)

**Transformation Ordering Refinement:**

`SourceSchema` validates that if `Compress` is included in `transformations`, `Deduplicate` must also be present and must appear before `Compress`. This enforces correct ordering to prevent data loss.

```typescript
// Valid: Deduplicate before Compress
{ transformations: ['Deduplicate', 'Compress'] }

// Invalid: Compress without Deduplicate
{ transformations: ['Compress'] }
// Error: "Deduplicate transformation is recommended before Compress. Add Deduplicate before Compress in transformations."

// Invalid: Compress before Deduplicate (wrong ordering)
{ transformations: ['Compress', 'Deduplicate'] }
// Error: "Deduplicate transformation is recommended before Compress. Add Deduplicate before Compress in transformations."
```

#### `ConfigurationSchema`

Validates the main compilation configuration object.

```typescript
import { ConfigurationSchema } from '@jk-com/adblock-compiler';

const config = {
    name: 'My Custom Filter List',
    description: 'Blocks ads and trackers',
    homepage: 'https://example.com',
    license: 'AGPL-3.0',
    version: '1.0.0',
    sources: [
        {
            source: 'https://example.com/filters.txt',
            name: 'Example Filters',
        },
    ],
    transformations: ['RemoveComments', 'Deduplicate', 'Compress'],
};

const result = ConfigurationSchema.safeParse(config);
if (result.success) {
    console.log('Valid configuration');
} else {
    console.error('Validation failed:', result.error.format());
}
```

**Schema Definition:**
- `name` (string, required): Filter list name
- `description` (string, optional): Filter list description
- `homepage` (string, optional): Filter list homepage URL — **validated as a URL** (must start with `http://` or `https://`)
- `license` (string, optional): License identifier (e.g., 'AGPL-3.0', 'MIT')
- `version` (string, optional): Version string — **must follow semver format** (e.g. `1.0.0` or `1.0`)
- `sources` (ISource[], required): Array of source configurations (must not be empty)
- Plus all fields from `SourceSchema` (exclusions, inclusions, transformations)

**Transformation Ordering Refinement:**

Same as `SourceSchema` — if `Compress` is in `transformations`, `Deduplicate` must also be present and must appear before `Compress`.

### Worker Request Schemas

#### `CompileRequestSchema`

Validates compilation requests to the worker API.

```typescript
import { CompileRequestSchema } from '@jk-com/adblock-compiler';

const request = {
    configuration: {
        name: 'My Filter List',
        sources: [{ source: 'https://example.com/filters.txt' }],
    },
    preFetchedContent: {
        'https://example.com/filters.txt': '||ads.example.com^\n||tracker.com^',
    },
    benchmark: true,
    priority: 'high',
    turnstileToken: 'token-xyz',
};

const result = CompileRequestSchema.safeParse(request);
```

**Schema Definition:**
- `configuration` (IConfiguration, required): Configuration object (validated by ConfigurationSchema)
- `preFetchedContent` (Record<string, string>, optional): Pre-fetched content map (source identifier → content). Keys may be URLs or arbitrary source identifiers.
- `benchmark` (boolean, optional): Whether to collect benchmark metrics
- `priority` (enum, optional): Request priority - `'standard'` or `'high'`
- `turnstileToken` (string, optional): Cloudflare Turnstile verification token

#### `BatchRequestSchema`

Base schema for batch compilation requests.

```typescript
import { BatchRequestSchema } from '@jk-com/adblock-compiler';

const batchRequest = {
    requests: [
        {
            id: 'request-1',
            configuration: { name: 'List 1', sources: [{ source: 'https://example.com/list1.txt' }] },
        },
        {
            id: 'request-2',
            configuration: { name: 'List 2', sources: [{ source: 'https://example.com/list2.txt' }] },
        },
    ],
    priority: 'standard',
};

const result = BatchRequestSchema.safeParse(batchRequest);
```

**Schema Definition:**
- `requests` (array, required): Array of batch request items (must not be empty)
  - Each item contains:
    - `id` (string, required): Unique identifier for the request
    - `configuration` (IConfiguration, required): Configuration object
    - `preFetchedContent` (Record<string, string>, optional): Pre-fetched content
    - `benchmark` (boolean, optional): Whether to benchmark this request
- `priority` (enum, optional): Batch priority - `'standard'` or `'high'`

**Custom Refinement:**
- Validates that all request IDs are unique
- Error message: "Duplicate request IDs are not allowed"

#### `BatchRequestSyncSchema`

Validates synchronous batch requests (limited to 10 items).

```typescript
import { BatchRequestSyncSchema } from '@jk-com/adblock-compiler';

// Valid: 10 or fewer requests
const syncBatch = {
    requests: Array(10).fill(null).map((_, i) => ({
        id: `req-${i}`,
        configuration: { name: `List ${i}`, sources: [{ source: `https://example.com/list${i}.txt` }] },
    })),
};

const result = BatchRequestSyncSchema.safeParse(syncBatch);
// result.success === true
```

**Limit:** Maximum 10 requests
**Error Message:** "Batch request limited to 10 requests maximum"

#### `BatchRequestAsyncSchema`

Validates asynchronous batch requests (limited to 100 items).

```typescript
import { BatchRequestAsyncSchema } from '@jk-com/adblock-compiler';

// Valid: 100 or fewer requests
const asyncBatch = {
    requests: Array(50).fill(null).map((_, i) => ({
        id: `req-${i}`,
        configuration: { name: `List ${i}`, sources: [{ source: `https://example.com/list${i}.txt` }] },
    })),
};

const result = BatchRequestAsyncSchema.safeParse(asyncBatch);
// result.success === true
```

**Limit:** Maximum 100 requests
**Error Message:** "Batch request limited to 100 requests maximum"

#### `PrioritySchema`

Validates the priority level for compilation requests. This schema is exported from `@jk-com/adblock-compiler` and re-used in `worker/schemas.ts` to avoid duplication.

```typescript
import { PrioritySchema } from '@jk-com/adblock-compiler';

PrioritySchema.safeParse('standard'); // { success: true, data: 'standard' }
PrioritySchema.safeParse('high');     // { success: true, data: 'high' }
PrioritySchema.safeParse('low');      // { success: false }
```

**Enum values:** `'standard'` | `'high'`

The exported `Priority` type is inferred directly from this schema:

```typescript
import type { Priority } from '@jk-com/adblock-compiler';
// type Priority = 'standard' | 'high'
```

### Compilation Output Schemas

#### `CompilationResultSchema`

Validates the output of a compilation operation.

```typescript
import { CompilationResultSchema } from '@jk-com/adblock-compiler';

const result = CompilationResultSchema.safeParse({
    rules: ['||ads.example.com^', '||tracker.com^'],
    ruleCount: 2,
});
```

**Schema Definition:**
- `rules` (string[], required): Array of compiled filter rules
- `ruleCount` (number, required): Non-negative integer count of rules

#### `BenchmarkMetricsSchema`

Validates compilation performance metrics returned when `benchmark: true`. Matches the `CompilationMetrics` interface from the compiler.

```typescript
import { BenchmarkMetricsSchema } from '@jk-com/adblock-compiler';
```

**Schema Definition:**
- `totalDurationMs` (number, required): Total compilation duration in milliseconds (non-negative)
- `stages` (array, required): Per-stage benchmark results, each containing:
  - `name` (string, required): Stage name (e.g., `'fetch'`, `'transform'`)
  - `durationMs` (number, required): Stage duration in milliseconds (non-negative)
  - `itemCount` (number, optional): Number of items processed in this stage
  - `itemsPerSecond` (number, optional): Throughput: items processed per second
- `sourceCount` (number, required): Number of sources processed (non-negative integer)
- `ruleCount` (number, required): Total input rule count before transformations (non-negative integer)
- `outputRuleCount` (number, required): Final output rule count after all transformations (non-negative integer)

#### `WorkerCompilationResultSchema`

Extends `CompilationResultSchema` with optional compilation metrics for worker responses. Matches the actual HTTP response shape returned by the Worker `/compile` endpoint.

```typescript
import { WorkerCompilationResultSchema } from '@jk-com/adblock-compiler';

const result = WorkerCompilationResultSchema.safeParse({
    rules: ['||ads.example.com^'],
    ruleCount: 1,
    metrics: {
        totalDurationMs: 250,
        stages: [{ name: 'fetch', durationMs: 100 }, { name: 'transform', durationMs: 50 }],
        sourceCount: 1,
        ruleCount: 5,
        outputRuleCount: 1,
    },
});
```

**Schema Definition:**
- All fields from `CompilationResultSchema`
- `metrics` (BenchmarkMetrics, optional): Compilation performance metrics (present when `benchmark: true`)

### CLI Schemas

#### `CliArgumentsSchema`

Validates parsed CLI arguments. Integrates with `ArgumentParser.validate()`.

```typescript
import { CliArgumentsSchema } from '@jk-com/adblock-compiler';

const args = CliArgumentsSchema.safeParse({
    config: 'myconfig.json',
    output: 'output.txt',
    verbose: true,
    noDeduplicate: true,
    exclude: ['*.cdn.example.com'],
    timeout: 10000,
});
```

**General fields:**
- `config` (string, optional): Path to configuration file
- `input` (string[], optional): Input source URLs or file paths
- `inputType` (enum, optional): Input format — `'adblock'` or `'hosts'`
- `output` (string, optional): Output file path
- `verbose` (boolean, optional): Enable verbose logging
- `benchmark` (boolean, optional): Enable benchmark reporting
- `useQueue` (boolean, optional): Use async queue-based compilation
- `priority` (enum, optional): Queue priority — `'standard'` or `'high'`
- `help` (boolean, optional): Show help message
- `version` (boolean, optional): Show version information

**Output fields:**
- `stdout` (boolean, optional): Write output to stdout instead of a file
- `append` (boolean, optional): Append to the output file instead of overwriting
- `format` (string, optional): Output format
- `name` (string, optional): Path to an existing file to compare output against
- `maxRules` (number, optional, positive integer): Truncate output to at most this many rules

**Transformation control fields:**
- `noDeduplicate` (boolean, optional): Skip the `Deduplicate` transformation
- `noValidate` (boolean, optional): Skip the `Validate` transformation
- `noCompress` (boolean, optional): Skip the `Compress` transformation
- `noComments` (boolean, optional): Skip the `RemoveComments` transformation
- `invertAllow` (boolean, optional): Apply the `InvertAllow` transformation
- `removeModifiers` (boolean, optional): Apply the `RemoveModifiers` transformation
- `allowIp` (boolean, optional): Replace `Validate` with `ValidateAllowIp`
- `convertToAscii` (boolean, optional): Apply the `ConvertToAscii` transformation
- `transformation` (TransformationType[], optional): Explicit transformation pipeline (overrides all other transformation flags). Values must be valid `TransformationType` enum members — invalid names are caught by Zod validation.

**Filtering fields:**
- `exclude` (string[], optional): Exclusion rules or wildcard patterns
- `excludeFrom` (string[], optional): Files containing exclusion rules
- `include` (string[], optional): Inclusion rules or wildcard patterns
- `includeFrom` (string[], optional): Files containing inclusion rules

**Networking fields:**
- `timeout` (number, optional, positive integer): HTTP request timeout in milliseconds
- `retries` (number, optional, non-negative integer): Number of HTTP retry attempts
- `userAgent` (string, optional): Custom HTTP `User-Agent` header

**Refinements:**
1. Either `--input` or `--config` must be specified (unless `--help` or `--version`)
2. `--output` is required (unless `--help`, `--version`, or `--stdout`)
3. Cannot specify both `--config` and `--input` simultaneously
4. Cannot specify both `--stdout` and `--output` simultaneously

### Environment Schema

#### `EnvironmentSchema`

Validates Cloudflare Worker environment bindings and runtime variables.

```typescript
import { EnvironmentSchema } from '@jk-com/adblock-compiler';

const env = EnvironmentSchema.safeParse(workerEnv);
```

**Schema Definition (all fields optional):**
- `TURNSTILE_SECRET_KEY` (string): Cloudflare Turnstile secret key
- `RATE_LIMIT_MAX_REQUESTS` (number): Maximum requests per window (coerced from string)
- `RATE_LIMIT_WINDOW_MS` (number): Rate limit window duration in milliseconds (coerced from string)
- `CACHE_TTL` (number): Cache TTL in seconds (coerced from string)
- `LOG_LEVEL` (enum): Log level — `'trace'` | `'debug'` | `'info'` | `'warn'` | `'error'`

Additional worker bindings are allowed via `.passthrough()`.

### Filter Rule Schemas

#### `AdblockRuleSchema`

Validates the structure of a parsed adblock-syntax rule.

```typescript
import { AdblockRuleSchema } from '@jk-com/adblock-compiler';

const rule = AdblockRuleSchema.safeParse({
    ruleText: '||ads.example.com^$important',
    pattern: 'ads.example.com',
    whitelist: false,
    options: [{ name: 'important', value: null }],
    hostname: 'ads.example.com',
});
```

**Schema Definition:**
- `ruleText` (string, required, min 1): The raw rule text
- `pattern` (string, required): The rule pattern
- `whitelist` (boolean, required): Whether the rule is an allowlist rule
- `options` (array | null, required): Array of `{ name: string, value: string | null }` objects, or null
- `hostname` (string | null, required): The target hostname, or null

#### `EtcHostsRuleSchema`

Validates the structure of a parsed `/etc/hosts`-syntax rule.

```typescript
import { EtcHostsRuleSchema } from '@jk-com/adblock-compiler';

const rule = EtcHostsRuleSchema.safeParse({
    ruleText: '0.0.0.0 ads.example.com tracker.example.com',
    hostnames: ['ads.example.com', 'tracker.example.com'],
});
```

**Schema Definition:**
- `ruleText` (string, required, min 1): The raw rule text
- `hostnames` (string[], required, non-empty): Array of blocked hostnames

## Using ConfigurationValidator

The `ConfigurationValidator` class provides a backward-compatible wrapper around Zod schemas.

```typescript
import { ConfigurationValidator } from '@jk-com/adblock-compiler';

const validator = new ConfigurationValidator();

// Validate and get result
const result = validator.validate(configObject);
if (!result.valid) {
    console.error('Validation failed:', result.errorsText);
}

// Validate and throw on error
// Returns the Zod-parsed (and transformed) configuration object,
// e.g. with leading/trailing whitespace trimmed from string fields.
try {
    const validConfig = validator.validateAndGet(configObject);
    // Use validConfig safely — strings have been trimmed by SourceSchema's transform
} catch (error) {
    console.error('Invalid configuration:', error.message);
}
```

## Type Inference

Zod schemas automatically infer TypeScript types:

```typescript
import { z } from 'zod';
import { ConfigurationSchema } from '@jk-com/adblock-compiler';

// Infer the TypeScript type from the schema
type Configuration = z.infer<typeof ConfigurationSchema>;

// This type is equivalent to IConfiguration
const config: Configuration = {
    name: 'My List',
    sources: [{ source: 'https://example.com/list.txt' }],
};
```

## Error Handling

### Using `safeParse()`

The `safeParse()` method returns a result object that never throws:

```typescript
const result = ConfigurationSchema.safeParse(data);

if (result.success) {
    // result.data contains the validated and typed data
    console.log('Valid configuration:', result.data);
} else {
    // result.error contains detailed validation errors
    console.error('Validation failed');
    
    // Get formatted errors
    const formatted = result.error.format();
    console.log('Formatted errors:', formatted);
    
    // Get flat list of errors
    const issues = result.error.issues;
    for (const issue of issues) {
        console.log(`Path: ${issue.path.join('.')}`);
        console.log(`Message: ${issue.message}`);
    }
}
```

### Using `parse()`

The `parse()` method throws a `ZodError` if validation fails:

```typescript
try {
    const validData = ConfigurationSchema.parse(data);
    // Use validData safely
} catch (error) {
    if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.issues);
    }
}
```

### Error Message Format

Validation errors include:
- **Path**: Path to the invalid field (e.g., `sources.0.source`)
- **Message**: Human-readable error description
- **Code**: Error type code (e.g., `invalid_type`, `too_small`, `custom`)

Example error output:
```
sources.0.source: source is required and must be a non-empty string
sources: sources is required and must be a non-empty array
name: name is required and must be a non-empty string
transformations.2: Invalid enum value. Expected 'RemoveComments' | 'Compress' | ..., received 'InvalidTransformation'
```

## Schema Composition

Zod schemas are composable, allowing you to build complex validation logic:

```typescript
import { z } from 'zod';
import { ConfigurationSchema } from '@jk-com/adblock-compiler';

// Extend existing schema
const ExtendedConfigSchema = ConfigurationSchema.extend({
    customField: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

// Partial schema (all fields optional)
const PartialConfigSchema = ConfigurationSchema.partial();

// Pick specific fields
const ConfigNameOnlySchema = ConfigurationSchema.pick({ name: true });

// Omit specific fields
const ConfigWithoutSourcesSchema = ConfigurationSchema.omit({ sources: true });
```

## Best Practices

### 1. Always Use `safeParse()` for User Input

```typescript
// Good: Handle validation errors gracefully
const result = ConfigurationSchema.safeParse(userInput);
if (!result.success) {
    return { error: result.error.format() };
}
return { data: result.data };

// Avoid: parse() throws and may crash your application
const data = ConfigurationSchema.parse(userInput); // Don't do this for user input
```

### 2. Validate Early

Validate data at system boundaries (API endpoints, file inputs):

```typescript
// Validate immediately when receiving API request
app.post('/api/compile', async (req, res) => {
    const result = CompileRequestSchema.safeParse(req.body);
    
    if (!result.success) {
        return res.status(400).json({
            error: 'Invalid request',
            details: result.error.format(),
        });
    }
    
    // Now safely use result.data with full type safety
    const compiledOutput = await compiler.compile(result.data.configuration);
    res.json(compiledOutput);
});
```

### 3. Use Type Inference

Let Zod infer types instead of manually defining them:

```typescript
import { z } from 'zod';
import { SourceSchema } from '@jk-com/adblock-compiler';

// Good: Type is automatically inferred and kept in sync
type Source = z.infer<typeof SourceSchema>;

// Avoid: Manual types can become out of sync with schema
interface Source {
    source: string;
    name?: string;
    // ... may forget to update when schema changes
}
```

### 4. Provide Custom Error Messages

Override default error messages for better UX:

```typescript
const CustomSourceSchema = z.object({
    source: z.string()
        .min(1, 'Please provide a source URL')
        .url('Source must be a valid URL'),
    name: z.string()
        .min(1, 'Name cannot be empty')
        .max(100, 'Name must be 100 characters or less')
        .optional(),
});
```

### 5. Use `.describe()` for OpenAPI and Documentation

All exported schemas include `.describe()` annotations on their fields. These descriptions serve as machine-readable documentation and can be consumed by tools like `zod-to-openapi` to auto-generate OpenAPI specs:

```typescript
import { SourceSchema } from '@jk-com/adblock-compiler';

// Access the description of the schema itself
// (available via the schema's internal _def.description or compatible OpenAPI tools)

// Example: integrate with zod-to-openapi
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

// Descriptions from .describe() annotations are automatically picked up
// when generating OpenAPI documentation from the schemas.
```

To add a description to your own derived schemas:

```typescript
const CustomRequestSchema = z.object({
    source: z.string().url().describe('URL of the filter list to compile'),
    priority: PrioritySchema.optional().describe('Processing priority'),
});
```

### 6. Document Your Schemas

Add JSDoc comments to explain validation rules:

```typescript
/**
 * Schema for custom filter configuration.
 * 
 * @example
 * ```typescript
 * const config = {
 *   source: 'https://example.com/list.txt',
 *   maxSize: 1000000, // 1MB max
 * };
 * 
 * const result = CustomSchema.safeParse(config);
 * ```
 */
export const CustomSchema = z.object({
    source: z.string().url(),
    maxSize: z.number().int().positive().max(10_000_000),
});
```

## Integration Examples

### Express/Hono API Validation

```typescript
import { Hono } from 'hono';
import { CompileRequestSchema } from '@jk-com/adblock-compiler';

const app = new Hono();

app.post('/compile', async (c) => {
    const body = await c.req.json();
    const result = CompileRequestSchema.safeParse(body);
    
    if (!result.success) {
        return c.json({
            error: 'Validation failed',
            issues: result.error.issues,
        }, 400);
    }
    
    // Process validated request
    const compiled = await processCompilation(result.data);
    return c.json(compiled);
});
```

### CLI Argument Validation

```typescript
import { ConfigurationSchema } from '@jk-com/adblock-compiler';
import { readFileSync } from 'fs';

const configFile = process.argv[2];
const configJson = readFileSync(configFile, 'utf-8');
const configData = JSON.parse(configJson);

const result = ConfigurationSchema.safeParse(configData);
if (!result.success) {
    console.error('Invalid configuration file:');
    for (const issue of result.error.issues) {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
}

console.log('Configuration is valid!');
```

### File Upload Validation

```typescript
import { SourceSchema } from '@jk-com/adblock-compiler';

async function validateUploadedSources(files: File[]) {
    const sources = [];
    
    for (const file of files) {
        const content = await file.text();
        const data = JSON.parse(content);
        
        const result = SourceSchema.safeParse(data);
        if (!result.success) {
            throw new Error(`Invalid source in ${file.name}: ${result.error.message}`);
        }
        
        sources.push(result.data);
    }
    
    return sources;
}
```

## Advanced Usage

### Custom Refinements

Add custom validation logic beyond basic type checking:

```typescript
import { z } from 'zod';
import { ConfigurationSchema } from '@jk-com/adblock-compiler';

const StrictConfigSchema = ConfigurationSchema.refine(
    (config) => {
        // Ensure at least one source has a name
        return config.sources.some((s) => s.name);
    },
    {
        message: 'At least one source must have a name',
        path: ['sources'],
    },
);
```

### Transform Data During Validation

Use `.transform()` to normalize or clean data:

```typescript
const NormalizedSourceSchema = SourceSchema.transform((data) => ({
    ...data,
    source: data.source.trim(),
    name: data.name?.trim() || 'Unnamed Source',
}));
```

### Union Types

Validate against multiple possible schemas:

```typescript
const RequestSchema = z.union([
    CompileRequestSchema,
    z.object({ type: z.literal('batch'), batch: BatchRequestSchema }),
]);
```

## Migration Guide

### From Manual Validation to Zod

**Before:**
```typescript
function validateConfig(config: unknown): IConfiguration {
    if (!config || typeof config !== 'object') {
        throw new Error('Configuration must be an object');
    }
    
    const cfg = config as any;
    
    if (!cfg.name || typeof cfg.name !== 'string') {
        throw new Error('name is required');
    }
    
    if (!Array.isArray(cfg.sources) || cfg.sources.length === 0) {
        throw new Error('sources is required and must be a non-empty array');
    }
    
    // ... many more checks
    
    return cfg as IConfiguration;
}
```

**After:**
```typescript
import { ConfigurationSchema } from '@jk-com/adblock-compiler';

function validateConfig(config: unknown): IConfiguration {
    const result = ConfigurationSchema.safeParse(config);
    
    if (!result.success) {
        throw new Error(`Configuration validation failed:\n${result.error.message}`);
    }
    
    return result.data;
}
```

## Performance Considerations

Zod validation is fast, but consider these optimizations for high-throughput scenarios:

1. **Reuse schema instances**: Don't recreate schemas on every validation
2. **Use `.parse()` carefully**: Only in trusted contexts where you want to throw on error
3. **Consider lazy validation**: Use `z.lazy()` for recursive schemas
4. **Profile your validation**: Use benchmarks to identify bottlenecks

```typescript
// Good: Reuse schema
const schema = ConfigurationSchema;
for (const config of configs) {
    schema.safeParse(config);
}

// Avoid: Recreating schema each time
for (const config of configs) {
    z.object({ /* ... */ }).safeParse(config); // Don't do this
}
```

## Testing Schemas

Always test your schemas with both valid and invalid data:

```typescript
import { assertEquals } from '@std/assert';
import { ConfigurationSchema } from '@jk-com/adblock-compiler';

Deno.test('ConfigurationSchema validates correct data', () => {
    const validConfig = {
        name: 'Test List',
        sources: [{ source: 'https://example.com/list.txt' }],
    };
    
    const result = ConfigurationSchema.safeParse(validConfig);
    assertEquals(result.success, true);
});

Deno.test('ConfigurationSchema rejects missing name', () => {
    const invalidConfig = {
        sources: [{ source: 'https://example.com/list.txt' }],
    };
    
    const result = ConfigurationSchema.safeParse(invalidConfig);
    assertEquals(result.success, false);
    if (!result.success) {
        assertEquals(result.error.issues.some((i) => i.path.includes('name')), true);
    }
});
```

## Related Documentation

- [Configuration Validation](../../README.md#configuration)
- [Worker API Documentation](./api/README.md)
- [Batch Processing Guide](./BATCH_API_GUIDE.md)
- [Error Handling](./VALIDATION_ERRORS.md)

## Resources

- [Zod Official Documentation](https://zod.dev/)
- [Zod GitHub Repository](https://github.com/colinhacks/zod)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
