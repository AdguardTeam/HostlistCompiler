# AdGuard Diff Builder Integration Ideas

Integration ideas for [``AdguardTeam/DiffBuilder``](https://github.com/AdguardTeam/DiffBuilder) and ``adblock-compiler``.

---

## 1. 📦 Emit Diff Patches as a Compilation Output

After compiling a filter list, use ``DiffBuilder.buildDiff()`` to automatically **generate a patch** between the previous compiled output and the new one. Your compiler becomes a full filter publishing pipeline:

- Store the previous compiled output as ``oldFilterPath``
- Write the new compiled output as ``newFilterPath``
- Call ``buildDiff()`` to produce a patch consumable by any ``DiffUpdater``-capable client

```typescript
import { DiffBuilder } from '@adguard/diff-builder/es';

await DiffBuilder.buildDiff({
    oldFilterPath: cache.getPreviousOutput(filterId),
    newFilterPath: newOutputPath,
    patchesPath: './patches',
    name: filterId,
    time: 24,        // expires in 24 hours
    resolution: 'h',
    verbose: false,
});
```

---

## 2. 🔁 Replace Full Re-downloads with `DiffUpdater.applyPatch()`

Your caching layer currently stores compiled filter content. Integrate ``DiffUpdater.applyPatch()`` to **apply incremental patches** instead of full re-downloads — complementing the ``FiltersDownloader.downloadWithRaw()`` patch approach at a lower level:

```typescript
import { DiffUpdater } from '@adguard/diff-builder/diff-updater/es';

const updatedFilter = await DiffUpdater.applyPatch({
    filterUrl,
    filterContent: await cache.get(filterUrl),
    verbose: false,
});

await cache.set(filterUrl, updatedFilter);
```

This pairs naturally with the ``isPatchUpdateFailed`` fallback pattern from ``FiltersDownloader.downloadWithRaw()`` — if ``applyPatch()`` fails, fall back to a full recompile.

---

## 3. 🌊 Stream Patch Events via the Streaming Pipeline

Emit diff-related events through your SSE/WebSocket pipeline ([``STREAMING_API.md``](../docs/api/STREAMING_API.md)):

| Event | Payload |
|---|---|
| ``patch:generated`` | `{ filterId, patchName, lines, checksum }` |
| ``patch:applied`` | `{ filterUrl, linesChanged }` |
| ``patch:skipped`` | `{ filterId, reason: 'no-changes' }` |
| ``metric`` | `{ metric: 'patch_size', value, unit: 'bytes' }` |

```typescript
emitEvent('patch:generated', {
    filterId,
    patchName,
    lines: patchLineCount,
    checksum: sha1Checksum,
});

emitEvent('metric', {
    metric: 'patch_size',
    value: patchSizeBytes,
    unit: 'bytes',
    dimensions: { filterId },
});
```

---

## 4. 📋 OpenAPI Endpoints for Diff/Patch Operations

Expose DiffBuilder capabilities via your existing OpenAPI surface ([``OPENAPI_SUPPORT.md``](../docs/api/OPENAPI_SUPPORT.md)):

| Endpoint | DiffBuilder API Used | Description |
|---|---|---|
| ``POST /filters/{id}/diff`` | ``DiffBuilder.buildDiff()`` | Generate a diff patch for a compiled filter |
| ``POST /filters/{id}/apply-patch`` | ``DiffUpdater.applyPatch()`` | Apply a patch to existing filter content |
| ``GET /filters/{id}/patches`` | — | List available patches with TTL and checksum info |
| ``DELETE /filters/{id}/patches`` | — | Trigger cleanup of expired patches |

---

## 5. ✅ Checksum Validation in Your Zod Pipeline

DiffBuilder supports optional SHA1 checksums on patches (via ``--checksum``). Wire checksum validation into your Zod schema layer ([``ZOD_VALIDATION.md``](../docs/api/ZOD_VALIDATION.md)) as a **post-patch integrity check**:

- Parse the ``checksum`` field from the patch header (``diff name:[name] checksum:[checksum] lines:[lines]``)
- After applying the patch, compute the SHA1 of the resulting filter content
- Reject any patched output whose checksum doesn't match

```typescript
const patchResultSchema = z.object({
    filterContent: z.string(),
    checksum: z.string().length(40), // SHA1 hex
}).refine(
    ({ filterContent, checksum }) => sha1(filterContent) === checksum,
    { message: 'Patch checksum validation failed' },
);
```

---

## 6. 🗂️ TTL-Based Patch Cleanup in Cloudflare KV / Cache

DiffBuilder's ``--delete-older-than-sec`` option (default: 7 days / 604800s) cleans up stale patches from the patch directory. Mirror this pattern in your Cloudflare KV cache:

- Store patches with a KV TTL matching the ``expirationPeriod`` passed to ``buildDiff()``
- Let KV auto-expire patches rather than manually managing cleanup
- Track patch expiry via ``cache`` events in your streaming pipeline

```typescript
// Store patch with TTL matching DiffBuilder expirationPeriod
await kv.put(patchKey, patchContent, {
    expirationTtl: expirationPeriodSeconds,
});

emitEvent('cache', {
    operation: 'write',
    key: patchKey,
    size: patchContent.length,
});
```

---

## 7. 🔗 Full Pipeline: Compile → Diff → Serve

Extend the full AdGuard tool chain with DiffBuilder as the **final publishing stage**:

```
FiltersCompiler
    └─ Resolves @include + platform config
        ↓
FiltersDownloader
    └─ Resolves !#if / !#include preprocessor directives
        ↓
adblock-compiler
    └─ AGTree parse → validate → deduplicate → transform
        ↓
DiffBuilder
    └─ buildDiff() → generate RCS patch
    └─ Patch stored in KV with TTL
    └─ Clients call applyPatch() for incremental updates
    └─ Full recompile on patch failure
```

```typescript
// After compilation completes:
const previousOutput = await kv.get(`filter:${filterId}:previous`);
const newOutput = compilationResult.rules.join('\n');

await DiffBuilder.buildDiff({
    oldFilterPath: writeTempFile(previousOutput),
    newFilterPath: writeTempFile(newOutput),
    patchesPath: patchDir,
    name: filterId,
    time: 24,
    resolution: 'h',
    checksum: true,
    verbose: false,
});

await kv.put(`filter:${filterId}:previous`, newOutput);
```

---

## References

- [``AdguardTeam/DiffBuilder`` README](https://github.com/AdguardTeam/DiffBuilder/blob/master/README.md)
- [``@adguard/diff-builder`` on npm](https://www.npmjs.com/package/@adguard/diff-builder)
- [adblock-compiler Streaming API](../docs/api/STREAMING_API.md)
- [adblock-compiler OpenAPI Support](../docs/api/OPENAPI_SUPPORT.md)
- [adblock-compiler Zod Validation](../docs/api/ZOD_VALIDATION.md)
- [adblock-compiler Batch API Guide](../docs/api/BATCH_API_GUIDE.md)
- [FiltersDownloader Integration Ideas](./FILTERS_DOWNLOADER_INTEGRATION.md)
- [FiltersCompiler Integration Ideas](./FILTERS_COMPILER_INTEGRATION.md)
- [Scriptlets Integration Ideas](./SCRIPTLETS_INTEGRATION.md)