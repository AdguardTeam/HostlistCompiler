# AdGuard HostlistsRegistry — Integration Ideas

> Generated: 2026-03-10
> Context: Analysis of [`AdguardTeam/HostlistsRegistry`](https://github.com/AdguardTeam/HostlistsRegistry) and its relevance to `jaypatrick/adblock-compiler`

---

## Summary

**`HostlistsRegistry` is the most directly relevant AdGuard ecosystem repository to `adblock-compiler`.** It is the canonical registry of DNS-level hostslist blocklists for AdGuard DNS, AdGuard Home, and related products — and `adblock-compiler` is explicitly described as a rewrite of `@adguard/hostlist-compiler`, the exact tool HostlistsRegistry uses internally to build its filters.

---

## What Is HostlistsRegistry?

[`AdguardTeam/HostlistsRegistry`](https://github.com/AdguardTeam/HostlistsRegistry) is the canonical registry of **DNS-level hostslist blocklists** made available to users of AdGuard DNS, AdGuard Home, and related products.

> *"Some of these blocklists are automatically [converted](https://github.com/AdguardTeam/HostlistCompiler) to the rules format that AdGuard products understand better."*

It is the DNS counterpart to [`FiltersRegistry`](https://github.com/AdguardTeam/FiltersRegistry) (which covers browser content blockers).

### HostlistsRegistry vs. FiltersRegistry

| | **HostlistsRegistry** | **FiltersRegistry** |
|---|---|---|
| **Target** | DNS blockers (AdGuard Home, Pi-hole) | Browser content blockers (extensions) |
| **Rule formats** | Hosts, adblock-style DNS rules, `$dnsrewrite` | Full adblock syntax, scriptlets, CSS injection |
| **Build tool** | `@adguard/hostlist-compiler` | `@adguard/filters-compiler` |
| **`adblock-compiler` relevance** | ✅ **Direct** — same domain, same tool lineage | ✅ Conceptual alignment |

---

## Pipeline Position

`adblock-compiler` sits squarely in the middle of this ecosystem:

```
[HostlistsRegistry sources] ─┐
[FiltersRegistry sources]    ├──→ [adblock-compiler] ──→ compiled .txt ──→ [AdGuard Home / Pi-hole / AdGuard DNS]
[Third-party sources]        ─┘
```

---

## Machine-Readable Indexes (Key Integration Point)

HostlistsRegistry publishes two living JSON indexes:

- **[`filters.json`](https://adguardteam.github.io/HostlistsRegistry/assets/filters.json)** — all blocklists with metadata + `downloadURL`
- **[`services.json`](https://adguardteam.github.io/HostlistsRegistry/assets/services.json)** — blockable web services with per-service adblock-syntax domain rules

These are the most actionable integration point. A `HostlistRegistryFetcher` could resolve sources like:

```json
{ "source": "hostlist-registry://adguard_dns_filter" }
```

...by fetching `filters.json`, looking up the `filterKey`, and resolving to the `downloadURL` at compile time. This fits perfectly into `adblock-compiler`'s existing pluggable `IContentFetcher` architecture.

---

## Ideas & Opportunities

### 1. 🔑 Add `trusted` Boolean to `ISource` — `$dnsrewrite` Safety Gate

HostlistsRegistry defines a `trusted` flag on `metadata.json`:

> *"a flag that allows using `$dnsrewrite` rules for this filter. If the filter is not trusted, `$dnsrewrite` rules will be removed from the compiled filter."*

This maps directly onto `adblock-compiler`'s `ValidateTransformation`. Adding `trusted: boolean` to `ISource` would gate whether `$dnsrewrite` rules survive compilation — critical for DNS safety when aggregating third-party sources.

```typescript
// Proposed addition to ISource
interface ISource {
    source: string;
    trusted?: boolean; // If false, strip $dnsrewrite rules (default: false)
    // ... existing fields
}
```

**Effort:** Low | **Value:** High

---

### 2. 🌐 Add `environment: "dev" | "prod"` to `ISource` or `IConfiguration`

HostlistsRegistry uses an `environment` field to control which lists are available in production vs. dev:

```json
{ "environment": "prod" }
```

`adblock-compiler` has no equivalent concept today. This would be a lightweight but useful addition for users managing staging vs. production filter pipelines, e.g. to skip dev-only sources during a production build.

**Effort:** Low | **Value:** Medium

---

### 3. 🏷️ Add `filterKey` (Human-Readable Slug) to `IConfiguration`

HostlistsRegistry uses **both** a slug-style `filterKey` (e.g. `"adguard_dns_filter"`) and a numeric `filterId`. `adblock-compiler`'s `IConfiguration` only has `name`. Adding a `filterKey` concept would:

- Enable stable, human-readable identifiers for compiled lists
- Power the `HostlistRegistryFetcher` idea (resolve by slug)
- Improve diff and changelog tooling

```typescript
// Proposed addition to IConfiguration
interface IConfiguration {
    name: string;
    filterKey?: string; // e.g. "my_dns_blocklist"
    // ... existing fields
}
```

**Effort:** Low | **Value:** Medium

---

### 4. 📦 `HostlistRegistryFetcher` — Resolve Sources by `filterKey`

Implement a custom `IContentFetcher` that resolves `hostlist-registry://` URIs:

```typescript
import { CompositeFetcher, HttpFetcher, type IContentFetcher, WorkerCompiler } from '@jk-com/adblock-compiler';

class HostlistRegistryFetcher implements IContentFetcher {
    private index: Map<string, string> | null = null;

    canHandle(source: string): boolean {
        return source.startsWith('hostlist-registry://');
    }

    async fetch(source: string): Promise<string> {
        if (!this.index) {
            const res = await fetch('https://adguardteam.github.io/HostlistsRegistry/assets/filters.json');
            const data = await res.json();
            this.index = new Map(data.filters.map((f: any) => [f.filterKey, f.downloadUrl]));
        }

        const key = source.replace('hostlist-registry://', '');
        const url = this.index.get(key);
        if (!url) throw new Error(`Unknown hostlist registry key: ${key}`);

        return fetch(url).then(r => r.text());
    }
}

// Usage
const compiler = new WorkerCompiler({
    customFetcher: new CompositeFetcher([
        new HostlistRegistryFetcher(),
        new HttpFetcher(),
    ]),
});
```

Then in configuration:

```json
{
    "name": "My DNS Blocklist",
    "sources": [
        { "source": "hostlist-registry://adguard_dns_filter", "trusted": true },
        { "source": "hostlist-registry://adaway",             "trusted": false }
    ]
}
```

**Effort:** Medium | **Value:** High — significant DX improvement

---

### 5. 🛡️ Document Safe Search Filter URLs as Example Sources

HostlistsRegistry publishes dedicated safe search filters:

- `https://adguardteam.github.io/HostlistsRegistry/assets/engines_safe_search.txt` — enforces Safe Search on Bing, DuckDuckGo, Google, Pixabay, Yandex
- `https://adguardteam.github.io/HostlistsRegistry/assets/youtube_safe_search.txt` — enforces Safe Search and hides comments on YouTube

These are well-maintained, reliable source URLs that should be documented in `adblock-compiler`'s example configurations.

**Effort:** ✅ Trivial | **Value:** Medium

---

### 6. 🌍 `services.json` — "Block by Service Name" Syntax (Future/Aspirational)

HostlistsRegistry's `services.json` maps named services (e.g. `wechat`, `youtube`, `facebook`) to their adblock-syntax blocking rules:

```json
{
    "id": "wechat",
    "name": "WeChat",
    "rules": ["||wechat.com^", "||weixin.qq.com^", "||wx.qq.com^"],
    "group": "social_network"
}
```

A future `ServicesFetcher` could enable:

```json
{ "source": "hostlist-service://social_network" }
```

...to pull all rules for a service group at compile time. This is aspirational but architecturally natural given the pluggable fetcher model.

**Effort:** High | **Value:** Future

---

## Prioritized Roadmap

| # | Idea | Effort | Value | Notes |
|---|------|--------|-------|-------|
| 1 | Document `filters.json` + safe search URLs in examples | ✅ Trivial | High | Zero code changes |
| 2 | Add `trusted` boolean to `ISource` | Low | High | DNS safety gate |
| 3 | `HostlistRegistryFetcher` (resolve by `filterKey`) | Medium | High | Best DX win |
| 4 | Add `filterKey` to `IConfiguration` | Low | Medium | Enables #3 |
| 5 | Add `environment: "dev" \| "prod"` to `ISource` | Low | Medium | Pipeline management |
| 6 | `services.json`-based "block by service" syntax | High | Future | Aspirational |

---

## Related Ideas

- [`FILTERS_REGISTRY_INTEGRATION.md`](./FILTERS_REGISTRY_INTEGRATION.md) — browser content filter registry (same concepts, different target)
- Both registries publish `filters.json` indexes — a unified `AdGuardRegistryFetcher` could handle both via a single protocol prefix (e.g. `adguard-registry://` vs `adguard-hostlist://`)