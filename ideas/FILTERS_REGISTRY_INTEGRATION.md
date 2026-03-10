# AdGuard FiltersRegistry — Integration Ideas

> Generated: 2026-03-10
> Context: Analysis of [`AdguardTeam/FiltersRegistry`](https://github.com/AdguardTeam/FiltersRegistry) and its relevance to `jaypatrick/adblock-compiler`

---

## Summary

**FiltersRegistry is the browser content-blocker counterpart to HostlistsRegistry**, and contains some concepts that are more advanced than its DNS sibling — notably a three-tier `trustLevel` system (`low` / `high` / `full`), per-platform compilation targeting, `exclude.txt` exclusion patterns, and an optimization pipeline based on real-world usage statistics. Several of these are directly actionable additions to `adblock-compiler`.

---

## What Is FiltersRegistry?

[`AdguardTeam/FiltersRegistry`](https://github.com/AdguardTeam/FiltersRegistry) is the canonical registry of **browser content-blocker filter subscriptions** available to AdGuard users. Filters are re-hosted on `filters.adtidy.org` and may be modified for better compatibility with AdGuard products.

### FiltersRegistry vs. HostlistsRegistry

| | **FiltersRegistry** | **HostlistsRegistry** |
|---|---|---|
| **Target** | Browser content blockers (extensions, apps) | DNS blockers (AdGuard Home, Pi-hole) |
| **Rule formats** | Full adblock syntax, scriptlets, CSS injection, `$replace` | Hosts, adblock-style DNS rules, `$dnsrewrite` |
| **Trust levels** | `low` / `high` / `full` (3-tier) | `trusted: boolean` (2-tier) |
| **Platform targeting** | `platformsIncluded` / `platformsExcluded` per-filter | `environment: dev \| prod` |
| **Build tool** | `@adguard/filters-compiler` | `@adguard/hostlist-compiler` |
| **`adblock-compiler` relevance** | ✅ Conceptual alignment + richer metadata model | ✅ **Direct** — same tool lineage |

---

## Key Concepts Unique to FiltersRegistry

### 1. Three-Tier `trustLevel`: `low` / `high` / `full`

FiltersRegistry defines a richer trust model than HostlistsRegistry's boolean `trusted` flag:

- **`low`** — only low-risk rule types allowed; the **default** if not configured
- **`high`** — trusted third-party lists; some higher-risk rules permitted
- **`full`** — all rule types allowed; only AdGuard's own filters have this level

This maps directly onto `adblock-compiler`'s existing `ValidateTransformation` and is more expressive than the binary `trusted: boolean` identified in the HostlistsRegistry analysis.

### 2. Per-Platform Compilation: `platformsIncluded` / `platformsExcluded`

Each filter can declare which platforms it should be compiled for:

```json
{
    "platformsIncluded": ["windows", "mac", "android", "ext_ublock"],
    "platformsExcluded": ["ios", "ext_safari"]
}
```

This is a significant gap in `adblock-compiler` today — there is no concept of platform-targeted output.

### 3. `exclude.txt` — Regex-Based Rule Exclusions per Source

Each filter in FiltersRegistry has an `exclude.txt` — a list of regular expressions. Rules matching any of these are stripped from the compiled output. This is more powerful than `adblock-compiler`'s current `exclusions` (which are domain/pattern-based), as it operates at the rule level via regex.

### 4. Optimization Pipeline — Usage-Frequency-Based Rule Pruning

FiltersRegistry compiles two versions of every filter: **full** and **optimized**. The optimized version strips rules that are never or rarely matched, based on real-world usage statistics collected from opted-in AdGuard users.

`adblock-compiler`'s existing `RuleOptimizerTransformation` is conceptually aligned but lacks the data-driven frequency signal.

### 5. `diff.txt` + `trusted-rules.txt` Build Artifacts

FiltersRegistry generates two additional build artifacts beyond `filter.txt`:
- **`diff.txt`** — build log of excluded and converted rules with explanations
- **`trusted-rules.txt`** — rules removed due to `trustLevel` constraints

`adblock-compiler`'s `DiffGenerator` covers the first partially, but there is no equivalent for trust-level exclusion logging.

### 6. `groupId` — Filter Groups

Every filter belongs to a group (e.g. "Ads", "Privacy", "Social Media"). `adblock-compiler` has no grouping concept.

---

## Integration Ideas

### 1. 🔒 Upgrade `trusted` to Three-Tier `trustLevel: "low" | "high" | "full"

The most directly actionable idea. Replace the `trusted: boolean` proposal from `HOSTLISTS_REGISTRY_INTEGRATION.md` with the richer FiltersRegistry model:

```typescript
// Proposed addition to ISource
type TrustLevel = 'low' | 'high' | 'full';

interface ISource {
    source: string;
    trustLevel?: TrustLevel; // default: 'low'
    // ... existing fields
}
```

Rule types gated by trust level (following FiltersRegistry's model):

| Rule Type | `low` | `high` | `full` |
|---|---|---|---|
| Basic blocking/allowing | ✅ | ✅ | ✅ |
| `$dnsrewrite` | ❌ | ✅ | ✅ |
| `$redirect` | ❌ | ✅ | ✅ |
| Scriptlets (`#%#//scriptlet`) | ❌ | ❌ | ✅ |
| `$replace` | ❌ | ❌ | ✅ |
| Extended CSS / cosmetic injection | ❌ | ✅ | ✅ |

**Effort:** Low | **Value:** High — unifies the trust model across both registries

---

### 2. 🖥️ Add `platforms` to `ISource` / `IConfiguration`

Add platform-aware compilation so a single configuration file can produce multiple platform-specific outputs:

```typescript
// Proposed
type Platform = 'windows' | 'mac' | 'android' | 'ios' | 'ext_chromium' | 'ext_firefox' | 'ext_ublock' | 'ext_safari' | string;

interface ISource {
    source: string;
    platformsIncluded?: Platform[];
    platformsExcluded?: Platform[];
    // ... existing fields
}

interface IConfiguration {
    name: string;
    targetPlatform?: Platform; // active platform for this compilation run
    // ... existing fields
}
```

Sources with `platformsExcluded` containing the active `targetPlatform` would be skipped. This would enable a single `config.json` to drive per-platform CI/CD outputs.

**Effort:** Medium | **Value:** High — especially for users targeting both AGH/Pi-hole (DNS) and browser extensions

---

### 3. 📋 `FiltersRegistryFetcher` — Resolve Sources by `filterId`

Analogous to `HostlistRegistryFetcher`, but resolving from `filters.adtidy.org`:

```typescript
import { type IContentFetcher } from '@jk-com/adblock-compiler';

class FiltersRegistryFetcher implements IContentFetcher {
    private index: Map<number, string> | null = null;

    canHandle(source: string): boolean {
        return source.startsWith('filters-registry://');
    }

    async fetch(source: string): Promise<string> {
        if (!this.index) {
            const res = await fetch('https://filters.adtidy.org/extension/chromium/filters.json');
            const data = await res.json();
            this.index = new Map(data.filters.map((f: any) => [f.filterId, f.downloadUrl]));
        }

        const id = parseInt(source.replace('filters-registry://', ''), 10);
        const url = this.index.get(id);
        if (!url) throw new Error(`Unknown filters registry ID: ${id}`);

        return fetch(url).then(r => r.text());
    }
}
```

Usage:

```json
{
    "name": "My Browser Blocklist",
    "sources": [
        { "source": "filters-registry://2",  "trustLevel": "full" },
        { "source": "filters-registry://14", "trustLevel": "high" }
    ]
}
```

**Effort:** Medium | **Value:** High

---

### 4. 🔍 Regex-Based Rule Exclusions (`exclude.txt` equivalent)

Currently, `adblock-compiler`'s `exclusions` work at the domain/pattern level. A `regexExclusions` field on `ISource` would enable FiltersRegistry-style rule-level stripping:

```typescript
interface ISource {
    source: string;
    exclusions?: string[];        // existing: domain/pattern-based
    regexExclusions?: string[];   // new: regex patterns matched against raw rule text
    // ... existing fields
}
```

Example — strip all `$app` and `$replace` rules from a low-trust source:

```json
{
    "source": "https://example.com/third-party-filter.txt",
    "trustLevel": "low",
    "regexExclusions": [
        "\$(.*,)?app",
        "\$(.*,)?replace="
    ]
}
```

**Effort:** Low-Medium | **Value:** High — powerful for trust-level enforcement

---

### 5. 📊 Trust-Level Exclusion Log (`trusted-rules.txt` equivalent)

Extend `adblock-compiler`'s `DiffGenerator` / compilation output to include a separate log of rules that were excluded due to `trustLevel` constraints. This mirrors FiltersRegistry's `trusted-rules.txt`.

```typescript
interface CompilationResult {
    rules: string[];
    trustExcluded?: string[];  // rules stripped due to trustLevel
    diffReport?: DiffReport;
    // ... existing fields
}
```

**Effort:** Low | **Value:** Medium — useful for debugging and auditing third-party sources

---

### 6. 🏷️ `group` — Filter Grouping

Add an optional `group` field to `IConfiguration` for organizational purposes, mirroring FiltersRegistry's `groupId`. Useful when `adblock-compiler` is used as a registry-style pipeline managing many filter lists.

```typescript
interface IConfiguration {
    name: string;
    group?: string; // e.g. "ads", "privacy", "social", "security"
    // ... existing fields
}
```

**Effort:** ✅ Trivial | **Value:** Low-Medium — organizational only

---

### 7. 📦 Unified `AdGuardFetcher` for Both Registries

Both FiltersRegistry and HostlistsRegistry follow the same pattern — publish a `filters.json` index with `filterId`/`filterKey` → `downloadUrl` mapping. A single unified fetcher could handle both:

```typescript
class AdGuardFetcher implements IContentFetcher {
    canHandle(source: string): boolean {
        return source.startsWith('adguard://') || source.startsWith('adguard-hostlist://');
    }

    async fetch(source: string): Promise<string> {
        if (source.startsWith('adguard-hostlist://')) {
            return this.fetchFromHostlistsRegistry(source);
        }
        return this.fetchFromFiltersRegistry(source);
    }

    // adguard://2 → filters.adtidy.org/extension/chromium/filters/2.txt
    // adguard-hostlist://adguard_dns_filter → HostlistsRegistry downloadUrl
}
```

**Effort:** Medium | **Value:** High — single fetcher covers both registries

---

## Prioritized Roadmap

| # | Idea | Effort | Value | Notes |
|---|------|--------|-------|-------|
| 1 | Upgrade `trusted` → `trustLevel: "low"|"high"|"full"` | Low | High | Supersedes HostlistsRegistry `trusted` boolean |
| 2 | Regex-based `regexExclusions` on `ISource` | Low-Medium | High | FiltersRegistry `exclude.txt` equivalent |
| 3 | `FiltersRegistryFetcher` (resolve by `filterId`) | Medium | High | Mirrors `HostlistRegistryFetcher` |
| 4 | Unified `AdGuardFetcher` for both registries | Medium | High | Best long-term DX |
| 5 | Trust-level exclusion log in `CompilationResult` | Low | Medium | Debugging/auditing aid |
| 6 | Platform targeting (`platformsIncluded`/`platformsExcluded`) | Medium | High | Multi-platform CI/CD |
| 7 | `group` field on `IConfiguration` | ✅ Trivial | Low-Medium | Organizational |

---

## Relationship to Other Integration Ideas

- [`HOSTLISTS_REGISTRY_INTEGRATION.md`](./HOSTLISTS_REGISTRY_INTEGRATION.md) — DNS-side counterpart; `trustLevel` here supersedes the `trusted: boolean` proposed there
- [`ADGUARD_HOME_INTEGRATION.md`](./ADGUARD_HOME_INTEGRATION.md) — AGH consumes HostlistsRegistry (DNS); browser extensions consume FiltersRegistry
- `docs/api/PLATFORM_SUPPORT.md` — `platformsIncluded`/`platformsExcluded` would extend the platform abstraction layer
- Both registries share the same `filters.json` index pattern — a unified `AdGuardFetcher` handles both