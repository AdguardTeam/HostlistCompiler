# Programmatic API Reference

← [Back to API docs](README.md)

This document covers the advanced programmatic API surface exported from `@jk-com/adblock-compiler`.
All of the features below are available when the package is used as a library; they are separate from the CLI.
Import them directly from `@jk-com/adblock-compiler` in any Deno or Node.js project.

> For CLI usage, see [CLI.md](../usage/CLI.md). For configuration file options, see [CONFIGURATION.md](../usage/CONFIGURATION.md).

---

## Output Formatters

Convert compiled rule arrays into different output formats.

### Functions

#### `createFormatter(format, options?)`

```typescript
import { createFormatter, OutputFormat } from '@jk-com/adblock-compiler';

const formatter = createFormatter(OutputFormat.Hosts);
const result = formatter.format(rules);
console.log(result.content);
```

#### `formatOutput(rules, format, options?)`

Convenience wrapper that creates a formatter and formats in one call.

```typescript
import { formatOutput, OutputFormat } from '@jk-com/adblock-compiler';

const result = formatOutput(rules, OutputFormat.Dnsmasq);
console.log(result.content);
```

### Available Formats

| `OutputFormat` value | Formatter class | Description |
|---|---|---|
| `adblock` | `AdblockFormatter` | AdGuard / uBlock Origin adblock syntax |
| `hosts` | `HostsFormatter` | `/etc/hosts`-style format |
| `dnsmasq` | `DnsmasqFormatter` | dnsmasq `address=` directives |
| `doh` | `DoHFormatter` | DNS-over-HTTPS blocklist format |
| `json` | `JsonFormatter` | JSON array of rule strings |
| `pihole` | `PiHoleFormatter` | Pi-hole compatible blocklist |
| `unbound` | `UnboundFormatter` | Unbound DNS resolver `local-zone` format |

---

## Diff Reports

Compare two compiled filter lists and generate a human-readable diff report.

### Functions

#### `generateDiff(oldRules, newRules, options?)`

```typescript
import { generateDiff } from '@jk-com/adblock-compiler';

const report = generateDiff(previousRules, currentRules);
console.log(`Added: ${report.added.length}, Removed: ${report.removed.length}`);
```

#### `generateDiffMarkdown(report)`

Renders a `DiffReport` as a Markdown string suitable for PR comments or changelogs.

```typescript
import { generateDiff, generateDiffMarkdown } from '@jk-com/adblock-compiler';

const report = generateDiff(oldRules, newRules);
const markdown = generateDiffMarkdown(report);
```

### `DiffGenerator` class

For more control, use the `DiffGenerator` class directly:

```typescript
import { DiffGenerator } from '@jk-com/adblock-compiler';

const generator = new DiffGenerator();
const report = generator.generate(oldRules, newRules, { includeUnchanged: false });
```

---

## Plugin System

Extend the compiler with custom transformations and downloaders via the plugin API.

### Core API

| Export | Description |
|---|---|
| `PluginRegistry` | Registry class that manages loaded plugins |
| `globalRegistry` | Singleton `PluginRegistry` instance |
| `loadPlugin(plugin)` | Load a plugin into the global registry |
| `createSimplePlugin(name, fn)` | Create a lightweight plugin from a transformation function |
| `PluginTransformationWrapper` | Wraps a plugin into a `Transformation`-compatible object |

### Interfaces

| Interface | Description |
|---|---|
| `Plugin` | Base plugin interface (name, version, description) |
| `TransformationPlugin` | Plugin that provides a custom transformation |
| `DownloaderPlugin` | Plugin that provides a custom content fetcher |

### Example

```typescript
import { createSimplePlugin, loadPlugin } from '@jk-com/adblock-compiler';

const myPlugin = createSimplePlugin('strip-trackers', (rules) =>
    rules.filter((r) => !r.includes('tracker'))
);

loadPlugin(myPlugin);
```

---

## Incremental Compilation

Compile only changed sources by caching previous results, dramatically reducing build time for large lists.

### `IncrementalCompiler`

```typescript
import { IncrementalCompiler, MemoryCacheStorage } from '@jk-com/adblock-compiler';

const cache = new MemoryCacheStorage();
const compiler = new IncrementalCompiler({ cache });

// First run — compiles everything
const result1 = await compiler.compile(config);

// Subsequent runs — only recompiles changed sources
const result2 = await compiler.compile(config);
```

### `IncrementalCompilerOptions`

| Option | Type | Description |
|---|---|---|
| `cache` | `ICacheStorage` | Cache storage implementation (required) |
| `logger` | `ILogger` | Optional logger |

### `MemoryCacheStorage`

In-memory implementation of `ICacheStorage`. Suitable for single-process use or testing. For persistent caching across restarts, implement your own `ICacheStorage`.

---

## Diagnostics & OpenTelemetry Tracing

Collect and export fine-grained performance and diagnostic data.

### `DiagnosticsCollector`

```typescript
import { DiagnosticsCollector } from '@jk-com/adblock-compiler';

const collector = new DiagnosticsCollector();
// Pass to FilterCompiler options to automatically collect metrics
```

### `OpenTelemetryExporter`

Exports collected spans in OpenTelemetry-compatible format.

```typescript
import { DiagnosticsCollector, OpenTelemetryExporter } from '@jk-com/adblock-compiler';

const collector = new DiagnosticsCollector();
const exporter = new OpenTelemetryExporter(collector);
await exporter.export();
```

### Tracing helpers

| Export | Description |
|---|---|
| `traceAsync(ctx, name, fn)` | Wrap an async function in a named trace span |
| `traceSync(ctx, name, fn)` | Wrap a sync function in a named trace span |
| `createTracingContext(name)` | Create a root tracing context |
| `createChildContext(parent, name)` | Create a child span context |
| `TraceCategory` | Enum of built-in span categories |
| `TraceSeverity` | Enum of span severity levels |

---

## Transformation Hooks

Attach before/after/error hooks to any transformation in the pipeline for logging, metrics, or side-effects.

### `TransformationHookManager`

```typescript
import {
    TransformationHookManager,
    createLoggingHook,
    TransformationType,
} from '@jk-com/adblock-compiler';

const hookManager = new TransformationHookManager();
hookManager.addBeforeHook(TransformationType.Deduplicate, createLoggingHook());
```

### Built-in hook factories

| Factory | Description |
|---|---|
| `createLoggingHook()` | Logs transformation start/end/error events |
| `createMetricsHook()` | Collects rule-count metrics for each transformation |
| `createEventBridgeHook(emitter)` | Bridges hook events into the compiler event emitter |

### Hook interfaces

| Interface | Description |
|---|---|
| `BeforeTransformHook` | Called before a transformation runs |
| `AfterTransformHook` | Called after a transformation completes successfully |
| `TransformErrorHook` | Called when a transformation throws an error |

---

## Conflict Detection

Detect and optionally auto-resolve conflicting block/allow rules for the same domain.

### `detectConflicts(rules, options?)`

```typescript
import { detectConflicts } from '@jk-com/adblock-compiler';

const result = detectConflicts(rules, { autoResolve: true });
console.log(result.conflicts);
console.log(result.resolvedRules);
```

### `ConflictDetectionTransformation`

Use as part of a custom pipeline via `--transformation ConflictDetection` or programmatically:

```typescript
import {
    ConflictDetectionTransformation,
    TransformationPipeline,
} from '@jk-com/adblock-compiler';

const transformation = new ConflictDetectionTransformation(logger, { autoResolve: true });
const pipeline = new TransformationPipeline([transformation]);
const result = pipeline.execute(rules);
```

### `ConflictDetectionOptions`

| Option | Type | Description |
|---|---|---|
| `autoResolve` | `boolean` | Automatically remove conflicting rules (default: `false`) |
| `preferAllow` | `boolean` | When resolving, prefer allow rules over block rules (default: `false`) |

---

## Rule Optimizer

Optimize rules for smaller file size and better matching performance.

### `optimizeRules(rules, options?)`

```typescript
import { optimizeRules } from '@jk-com/adblock-compiler';

const { rules: optimized, stats } = optimizeRules(inputRules);
console.log(`Optimized ${stats.rulesOptimized} rules, removed ${stats.redundantRemoved} redundant entries`);
```

### `RuleOptimizerTransformation`

Use as part of a custom pipeline via `--transformation RuleOptimizer` or programmatically:

```typescript
import {
    RuleOptimizerTransformation,
    TransformationPipeline,
} from '@jk-com/adblock-compiler';

const transformation = new RuleOptimizerTransformation(logger);
const pipeline = new TransformationPipeline([transformation]);
const result = pipeline.execute(rules);
```

### `OptimizationStats`

| Field | Type | Description |
|---|---|---|
| `rulesOptimized` | `number` | Number of rules that were modified |
| `redundantRemoved` | `number` | Number of redundant rules removed |
| `rulesMerged` | `number` | Number of rules merged into combined patterns |
| `modifiersSimplified` | `number` | Number of rules with simplified modifiers |
| `originalCount` | `number` | Rule count before optimization |
