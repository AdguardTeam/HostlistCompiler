# AdGuard Filters Compiler Integration Ideas

Integration ideas for [`AdguardTeam/FiltersCompiler`](https://github.com/AdguardTeam/FiltersCompiler) and `adblock-compiler`.

---

## 1. 🏗️ Use FiltersCompiler as an Upstream Compilation Stage

FiltersCompiler already solves the **filter registry → platform output** problem at scale. Rather than reinventing this, `adblock-compiler` could position itself as a **higher-level orchestration layer** on top of it:

- Call `compiler.compile(filtersDir, logPath, reportPath, platformsPath, whitelist, blacklist, customPlatformsConfig)` as a pre-processing step
- Feed the compiled per-platform output into your transformation pipeline for further processing (dedup, validation, streaming, etc.)

```javascript
const compiler = require('adguard-filters-compiler');

compiler.compile(
    filtersDir,
    logPath,
    reportPath,
    platformsPath,
    whitelist,
    blacklist,
    customPlatformsConfig,
);

// Then pipe compiled output into adblock-compiler transformations
```

---

## 2. 🎛️ Mirror the Custom Platform Config Model

FiltersCompiler's `customPlatformsConfig` pattern — with `defines`, `removeRulePatterns`, and `replacements` — maps well to your existing platform support ([`PLATFORM_SUPPORT.md`](../docs/api/PLATFORM_SUPPORT.md)):

- Adopt the same `defines` object shape for your own platform condition constants (already used by `FiltersDownloader`)
- Expose `removeRulePatterns` and `replacements` as configurable transformation options in your Zod schemas ([`ZOD_VALIDATION.md`](../docs/api/ZOD_VALIDATION.md))
- This creates a **unified platform config model** across all three AdGuard tools

```typescript
const customPlatformsConfig = {
    CHROMIUM_MV3: {
        platform: 'chromium',
        path: 'chromium_mv3',
        configuration: {
            ignoreRuleHints: false,
            removeRulePatterns: [
                '^\/.*', // remove regex rules
            ],
            replacements: [
                { from: 'old-pattern', to: 'new-pattern' },
            ],
        },
        defines: {
            adguard: true,
            adguard_ext_chromium: true,
        },
    },
};
```

---

## 3. 🧩 `@include` Directive Options as Transformation Pipeline Stages

FiltersCompiler's `@include` options map directly to discrete transformation stages in your batch pipeline ([`BATCH_API_GUIDE.md`](../docs/api/BATCH_API_GUIDE.md)):

| FiltersCompiler Option | `adblock-compiler` Transformation |
|---|---|
| `/stripComments` | `RemoveComments` transformation |
| `/notOptimized` | Hint injection transformation |
| `/exclude="..."` | Exclusion list transformation |
| `/addModifiers="..."` | Modifier injection transformation |
| `/optimizeDomainBlockingRules` | Domain deduplication transformation |

Model these as named, chainable transformation steps in your configuration schema:

```typescript
const sourceConfig = {
    source: 'https://example.org/filters.txt',
    transformations: [
        'RemoveComments',
        { type: 'AddModifiers', modifiers: 'script' },
        { type: 'Exclude', exclusionsUrl: '../exclusions.txt' },
        'NotOptimized',
        'OptimizeDomainBlockingRules',
    ],
};
```

---

## 4. ✅ `validateJSONSchema()` for Compiled Output Validation

FiltersCompiler provides `validateJSONSchema(platformsPath, FILTERS_REQUIRED_AMOUNT)` to validate compiled filter metadata against JSON schemas. Integrate this as a **post-compilation validation step**:

- Run schema validation after compilation completes
- Surface failures as structured errors via your Zod layer ([`ZOD_VALIDATION.md`](../docs/api/ZOD_VALIDATION.md))
- Expose as an OpenAPI endpoint: `POST /validate/schema` ([`OPENAPI_SUPPORT.md`](../docs/api/OPENAPI_SUPPORT.md))

```typescript
import { compiler } from 'adguard-filters-compiler';

const validationResult = compiler.validateJSONSchema(
    platformsPath,
    FILTERS_REQUIRED_AMOUNT,
);

if (!validationResult.valid) {
    throw new CompilationValidationError(validationResult.errors);
}
```

---

## 5. 📋 Whitelist/Blacklist as First-Class API Concepts

FiltersCompiler uses explicit `whitelist` and `blacklist` filter ID arrays to control which filters are compiled. Expose these as first-class concepts in your OpenAPI spec and Zod schemas:

```typescript
const compilationConfigSchema = z.object({
    name: z.string(),
    sources: z.array(sourceSchema),
    whitelist: z.array(z.number()).optional(),
    blacklist: z.array(z.number()).optional(),
    transformations: z.array(transformationSchema).optional(),
    platforms: z.array(platformConfigSchema).optional(),
});
```

Expose via OpenAPI:

| Endpoint | Description |
|---|---|
| `POST /compile` | Pass `whitelist`/`blacklist` in request body |
| `GET /filters` | List available filter IDs |
| `POST /validate/schema` | Validate compiled output against JSON schema |

---

## 6. 📊 Stream Compiler Logs via Diagnostic Events

FiltersCompiler supports `INFO`, `WARN`, and `ERROR` log levels written to a log file. Bridge these into your streaming pipeline ([`STREAMING_API.md`](../docs/api/STREAMING_API.md)) by intercepting log output and emitting them as `diagnostic` SSE/WebSocket events with matching severity levels:

```typescript
// Intercept FiltersCompiler log output
const logInterceptor = new LogInterceptor(logPath);

logInterceptor.on('line', (line) => {
    const { level, message } = parsLogLine(line);
    emitEvent('diagnostic', {
        category: 'compilation',
        severity: level.toLowerCase(), // 'info' | 'warn' | 'error'
        message,
        timestamp: new Date().toISOString(),
    });
});
```

---

## 7. 🔗 Full AdGuard Tool Chain Pipeline

Combine all three AdGuard tools into one end-to-end pipeline:

```
FiltersCompiler
    └─ Resolves @include directives with options (stripComments, addModifiers, exclude, etc.)
    └─ Applies platform config (defines, removeRulePatterns, replacements)
    └─ Outputs per-platform compiled rule sets
        ↓
FiltersDownloader
    └─ Resolves !#if / !#else / !#endif preprocessor conditionals
    └─ Resolves !#include sub-files
    └─ Applies patch-based incremental updates (downloadWithRaw)
        ↓
adblock-compiler
    └─ AGTree parse → AST
    └─ Validate (Zod + AGTree modifier validation)
    └─ Deduplicate
    └─ Stream via SSE / WebSocket
    └─ Emit per-platform compiled output
```

```typescript
// Step 1: FiltersCompiler — resolve @include + platform config
compiler.compile(filtersDir, logPath, reportPath, platformsPath, whitelist, blacklist, config);

// Step 2: FiltersDownloader — resolve !#if + !#include
const resolved = await FiltersDownloader.download(sourceUrl, platformDefines);

// Step 3: adblock-compiler — parse, validate, transform, emit
const filterList = AGTreeParser.parseFilterList(resolved.join('\n'));
// ... transformations, streaming, output
```

---

## References

- [`AdguardTeam/FiltersCompiler` README](https://github.com/AdguardTeam/FiltersCompiler/blob/master/README.md)
- [`AdguardTeam/FiltersRegistry`](https://github.com/AdguardTeam/FiltersRegistry)
- [adblock-compiler AGTree Integration](../docs/api/AGTREE_INTEGRATION.md)
- [adblock-compiler Batch API Guide](../docs/api/BATCH_API_GUIDE.md)
- [adblock-compiler Streaming API](../docs/api/STREAMING_API.md)
- [adblock-compiler Platform Support](../docs/api/PLATFORM_SUPPORT.md)
- [adblock-compiler OpenAPI Support](../docs/api/OPENAPI_SUPPORT.md)
- [adblock-compiler Zod Validation](../docs/api/ZOD_VALIDATION.md)
- [FiltersDownloader Integration Ideas](./FILTERS_DOWNLOADER_INTEGRATION.md)
- [Scriptlets Integration Ideas](./SCRIPTLETS_INTEGRATION.md)