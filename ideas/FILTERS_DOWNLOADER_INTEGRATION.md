# AdGuard Filters Downloader Integration Ideas

Integration ideas for [`AdguardTeam/FiltersDownloader`](https://github.com/AdguardTeam/FiltersDownloader) and `adblock-compiler`.

---

## 1. 📥 Replace or Augment Custom Filter Fetching with `FiltersDownloader.download()`

Your compiler currently fetches filter sources directly. Swapping in (or wrapping) `@adguard/filters-downloader` gives you **preprocessor directive resolution for free**:

- `!#if` / `!#else` / `!#endif` conditionals are resolved based on your platform constants before rules ever hit your pipeline
- `!#include` directives are recursively resolved, eliminating the need to manually handle nested filter composition
- Works seamlessly with your existing AGTree integration — the resolved output is clean rule text ready to be parsed into an AST

```typescript
import { FiltersDownloader } from '@adguard/filters-downloader';

const conditions = {
    adguard: true,
    adguard_ext_chromium: true,
    adguard_ext_safari: false,
    adguard_ext_android_cb: false,
};

const compiledRules = await FiltersDownloader.download(
    'https://example.org/filters.txt',
    conditions,
);
// compiledRules is a string[] of resolved rules, ready for AGTreeParser
```

---

## 2. 🎛️ Platform-Aware Conditional Compilation

`FiltersDownloader` uses **condition constants** (e.g. `adguard`, `adguard_ext_safari`) to branch filter content at download time. This maps directly to your existing platform support model ([`PLATFORM_SUPPORT.md`](../docs/api/PLATFORM_SUPPORT.md)):

- Define a `FilterCompilerConditionsConstants` object per target platform in your compiler config
- Pass the appropriate constants when downloading each source, producing a platform-specific rule set
- This replaces any manual `!#if` stripping or platform-branching logic you may have today

```typescript
const platformConditions: Record<string, Record<string, boolean>> = {
    chromium: { adguard: true, adguard_ext_chromium: true },
    safari:   { adguard: true, adguard_ext_safari: true },
    android:  { adguard: true, adguard_ext_android_cb: true },
};

for (const [platform, conditions] of Object.entries(platformConditions)) {
    const rules = await FiltersDownloader.download(sourceUrl, conditions);
    // Emit platform-specific compiled output
}
```

---

## 3. 🌊 Streaming Integration: Download + Resolve in the Pipeline

Your streaming compilation pipeline ([`STREAMING_API.md`](../docs/api/STREAMING_API.md)) can stream `source:start` / `source:complete` events as FiltersDownloader resolves each source:

- Wrap `FiltersDownloader.download()` calls in your `source:start` / `source:complete` SSE/WebSocket event flow
- Emit `network` events for each HTTP request FiltersDownloader makes (including `!#include` sub-requests)
- Emit `metric` events for download speed and response size per source

```typescript
emitEvent('source:start', { sourceName, sourceUrl });

const rules = await FiltersDownloader.download(sourceUrl, conditions);

emitEvent('source:complete', { sourceName, ruleCount: rules.length });
emitEvent('metric', { metric: 'rule_count', value: rules.length, unit: 'count' });
```

---

## 4. 🔁 Incremental Updates via `downloadWithRaw()`

`FiltersDownloader.downloadWithRaw()` supports **patch-based incremental updates** — it applies diffs to a previously downloaded raw filter rather than re-downloading everything. This is a major optimization for your caching layer:

- Store `rawFilter` (the previous raw text) in your cache alongside the compiled output
- On subsequent compilations, pass `rawFilter` back to `downloadWithRaw()` to get only the diff applied
- Use `isPatchUpdateFailed` to fall back to a full re-download when patching fails
- Emit `cache` events to signal whether a patch update or full download was used

```typescript
const cached = await cache.get(cacheKey);

const { filter, rawFilter, isPatchUpdateFailed } = await FiltersDownloader.downloadWithRaw(
    sourceUrl,
    {
        force: false,
        rawFilter: cached?.rawFilter,
    },
);

emitEvent('cache', {
    operation: isPatchUpdateFailed ? 'miss' : 'hit',
    key: cacheKey,
});

await cache.set(cacheKey, { compiled: filter, rawFilter });
```

---

## 5. 🧩 `compile()` for Inline Rule Arrays

Your batch processing pipeline ([`BATCH_API_GUIDE.md`](../docs/api/BATCH_API_GUIDE.md)) may already hold rules as arrays in memory. Use `FiltersDownloader.compile()` to resolve preprocessor directives **inline** without a network round-trip:

- Useful for rules loaded from local files, databases, or your own Cloudflare KV cache
- Resolves any `!#include` relative paths against a provided `baseUrl`
- Conditions constants still apply for `!#if` branching

```typescript
const inlineRules = await loadRulesFromCache(); // string[]

const resolved = await FiltersDownloader.compile(
    inlineRules,
    'https://example.org/filters/',
    conditions,
);
```

---

## 6. 📋 OpenAPI Endpoint: Source Download & Preprocessing

Expose FiltersDownloader capabilities through your existing OpenAPI surface ([`OPENAPI_SUPPORT.md`](../docs/api/OPENAPI_SUPPORT.md)):

| Endpoint | FiltersDownloader API Used |
|---|---|
| `POST /sources/download` | `FiltersDownloader.download()` |
| `POST /sources/compile` | `FiltersDownloader.compile()` |
| `POST /sources/download-with-raw` | `FiltersDownloader.downloadWithRaw()` |

Request body for `POST /sources/download`:
```json
{
    "url": "https://example.org/filters.txt",
    "conditions": {
        "adguard": true,
        "adguard_ext_chromium": true
    },
    "options": {
        "allowEmptyResponse": false
    }
}
```

---

## 7. 🔗 AGTree Pipeline: Download → Resolve → Parse

Combine FiltersDownloader and your existing AGTree integration ([`AGTREE_INTEGRATION.md`](../docs/api/AGTREE_INTEGRATION.md)) into a clean end-to-end pipeline:

1. **FiltersDownloader** fetches and resolves preprocessor directives (`!#if`, `!#include`)
2. **AGTreeParser** parses the resolved rules into an AST
3. **Transformations** (validate, deduplicate, etc.) operate on the AST
4. **Compiler** emits platform-specific output

```typescript
// Step 1: Resolve directives
const resolvedRules = await FiltersDownloader.download(sourceUrl, conditions);

// Step 2: Parse to AST
const filterList = AGTreeParser.parseFilterList(resolvedRules.join('\n'));

// Step 3: Transform
for (const rule of filterList.children) {
    if (AGTreeParser.isNetworkRule(rule)) {
        // validate, deduplicate, etc.
    }
}
```

---

## References

- [`AdguardTeam/FiltersDownloader` README](https://github.com/AdguardTeam/FiltersDownloader/blob/master/README.md)
- [`@adguard/filters-downloader` on npm](https://www.npmjs.com/package/@adguard/filters-downloader)
- [adblock-compiler AGTree Integration](../docs/api/AGTREE_INTEGRATION.md)
- [adblock-compiler Batch API Guide](../docs/api/BATCH_API_GUIDE.md)
- [adblock-compiler Streaming API](../docs/api/STREAMING_API.md)
- [adblock-compiler Platform Support](../docs/api/PLATFORM_SUPPORT.md)
- [adblock-compiler OpenAPI Support](../docs/api/OPENAPI_SUPPORT.md)