# API Reference

The full TypeScript API reference is automatically generated from the JSDoc annotations
embedded in the [`src/`](https://github.com/jaypatrick/adblock-compiler/tree/main/src)
source files using [`deno doc --html`](https://docs.deno.com/runtime/reference/cli/documentation_generator/).

## Browsing the reference

> **Tip:** The API reference is a separate static site generated alongside this book.
> Click the button below (or the sidebar link) to open it.

<div style="margin: 1.5rem 0;">
  <a href="./api-reference/index.html"
     style="display:inline-block;padding:0.6rem 1.4rem;background:#b45309;color:#fff;
            border-radius:4px;text-decoration:none;font-weight:600;font-family:sans-serif;">
    Open API Reference →
  </a>
</div>

> **Note:** The `api-reference/index.html` link above is only available after running
> `deno task docs:build` locally or in a deployed mdBook site. It is not present in
> the repository source tree.

## What is documented

Every symbol exported from the library's main entry point (`src/index.ts`) is covered,
including:

| Category | Key exports |
|----------|-------------|
| **Compiler** | `FilterCompiler`, `SourceCompiler`, `IncrementalCompiler`, `compile()` |
| **Transformations** | `RemoveCommentsTransformation`, `DeduplicateTransformation`, `CompressTransformation`, `ValidateTransformation`, … |
| **Platform** | `WorkerCompiler`, `HttpFetcher`, `CompositeFetcher`, `PlatformDownloader` |
| **Formatters** | `AdblockFormatter`, `HostsFormatter`, `DnsmasqFormatter`, `JsonFormatter`, … |
| **Services** | `FilterService`, `ASTViewerService`, `AnalyticsService` |
| **Diagnostics** | `DiagnosticsCollector`, `createTracingContext`, `traceAsync`, `traceSync` |
| **Utils** | `RuleUtils`, `Logger`, `CircuitBreaker`, `CompilerEventEmitter`, … |
| **Configuration** | `ConfigurationSchema`, `ConfigurationValidator`, all Zod schemas |
| **Types** | All public interfaces (`IConfiguration`, `ILogger`, `ICompilerEvents`, …) |
| **Diff** | `DiffGenerator`, `generateDiff` |
| **Plugins** | `PluginRegistry`, `PluginTransformationWrapper` |

## Regenerating locally

```bash
# Generate the HTML API reference into book/api-reference/
deno task docs:api

# Build the full mdBook site + API reference in one step
deno task docs:build

# Live-preview the mdBook (does not include API reference)
deno task docs:serve
```

## JSDoc conventions

All public classes, interfaces, methods, and enum values are documented with JSDoc
comments following the project's conventions:

```typescript
/**
 * Brief one-line description.
 *
 * Longer explanation of behaviour, constraints, or design decisions.
 *
 * @param inputRules - The raw rule strings to process.
 * @returns The transformed rule strings.
 * @example
 * ```ts
 * const result = new DeduplicateTransformation().executeSync(rules);
 * ```
 */
```

See [`docs/development/CODE_REVIEW.md`](development/CODE_REVIEW.md) for the full
documentation style guide.
