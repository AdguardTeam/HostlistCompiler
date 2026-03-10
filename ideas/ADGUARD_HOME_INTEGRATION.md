# AdGuard Home — Integration Ideas

> Generated: 2026-03-10
> Context: Analysis of [`AdguardTeam/AdGuardHome`](https://github.com/AdguardTeam/AdGuardHome) and its relevance to `jaypatrick/adblock-compiler`

---

## Summary

**AdGuard Home is a primary consumer of `adblock-compiler`'s output.** It is a self-hosted, network-wide DNS sinkhole that pulls its vetted filter lists directly from `HostlistsRegistry` — the same registry that `adblock-compiler` is designed to compile from. The integration angle is bidirectional: `adblock-compiler` can both **read from** and **push compiled lists to** a running AdGuard Home instance via its REST API.

---

## What Is AdGuard Home?

[`AdguardTeam/AdGuardHome`](https://github.com/AdguardTeam/AdGuardHome) is a free, open-source, network-wide DNS sinkhole — the same category as Pi-hole, which `adblock-compiler` already explicitly targets as a compatible platform.

Key facts relevant to `adblock-compiler`:

- Exposes a full **[REST API](https://github.com/AdguardTeam/AdGuardHome/tree/master/openapi)** (OpenAPI spec) with Basic Auth
- Its **vetted filter list** is pulled directly from `HostlistsRegistry/assets/filters.json`
- Its **blocked services list** is pulled directly from `HostlistsRegistry/assets/services.json`
- Both of those indexes are exactly the ones identified as integration targets in [`HOSTLISTS_REGISTRY_INTEGRATION.md`](./HOSTLISTS_REGISTRY_INTEGRATION.md)

This closes the loop: **AGH pulls from HostlistsRegistry → `adblock-compiler` compiles from HostlistsRegistry-compatible sources → AGH consumes the compiled output.**

---

## The Relationship

```
[HostlistsRegistry]
        ↓  (vetted-filters script)
[AdGuard Home] ←──────────────────────────── [adblock-compiler]
        ↑                                            ↓
  reads filter                              compiles + pushes
  subscriptions                             via REST API
```

`adblock-compiler` sits upstream of AdGuard Home in the filter pipeline and can also manage it downstream via the REST API.

---

## AdGuard Home REST API — Filter Management Surface

AGH exposes a clean filter subscription management API (Basic Auth):

| Endpoint | Method | Description |
|---|---|---|
| `/control/filtering/status` | `GET` | List all subscriptions + enabled/disabled state |
| `/control/filtering/add_url` | `POST` | Subscribe to a filter by URL |
| `/control/filtering/set_url` | `POST` | Enable/disable/update a subscription |
| `/control/filtering/set_rules` | `POST` | Set custom user rules directly |
| `/control/filtering/refresh` | `POST` | Force refresh all subscriptions |
| `/control/stats` | `GET` | Query current blocking statistics |

Authentication:

```http
Authorization: Basic BASE64(username:password)
```

---

## Integration Ideas

### 1. 🚀 Post-Compile Push Hook — `POST /control/filtering/set_rules`

The most immediately actionable idea: after `adblock-compiler` finishes compiling, push the result directly to a running AGH instance as custom user rules.

```typescript
import { compile } from '@jk-com/adblock-compiler';

const compiled = await compile(config);

// Push compiled rules to AdGuard Home
await fetch('http://adguardhome:3000/control/filtering/set_rules', {
    method: 'POST',
    headers: {
        'Authorization': `Basic ${btoa('admin:password')}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rules: compiled }),
});
```

This closes the CI/CD loop: compile a blocklist and deploy it to a live AGH instance in one step.

**Effort:** Low | **Value:** High

---

### 2. 🔌 `AdGuardHomeFetcher` — Read User Rules as a Source

Implement a custom `IContentFetcher` that reads the current user rules from a running AGH instance as a compilation source. This enables round-trip workflows: read existing rules, augment with additional sources, recompile, push back.

```typescript
import { type IContentFetcher } from '@jk-com/adblock-compiler';

interface AdGuardHomeOptions {
    host: string;       // e.g. 'adguardhome:3000'
    username: string;
    password: string;
}

class AdGuardHomeFetcher implements IContentFetcher {
    constructor(private options: AdGuardHomeOptions) {}

    canHandle(source: string): boolean {
        return source.startsWith('adguard-home://');
    }

    async fetch(source: string): Promise<string> {
        const { host, username, password } = this.options;
        const res = await fetch(`http://${host}/control/filtering/status`, {
            headers: {
                'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
            },
        });
        const data = await res.json();
        // Return user-defined custom rules
        return (data.user_rules ?? []).join('\n');
    }
}

// Usage in a CompositeFetcher chain
import { CompositeFetcher, HttpFetcher, WorkerCompiler } from '@jk-com/adblock-compiler';

const compiler = new WorkerCompiler({
    customFetcher: new CompositeFetcher([
        new AdGuardHomeFetcher({ host: 'adguardhome:3000', username: 'admin', password: 'secret' }),
        new HttpFetcher(),
    ]),
});

const config = {
    name: 'Augmented AGH Rules',
    sources: [
        { source: 'adguard-home://user_rules' },           // existing AGH rules
        { source: 'https://example.com/extra-rules.txt' }, // additional sources
    ],
    transformations: ['Deduplicate', 'RemoveEmptyLines'],
};

const result = await compiler.compile(config);
```

**Effort:** Low | **Value:** Medium

---

### 3. 📋 Subscription Management — `add_url` / `set_url`

Instead of pushing rules directly, manage AGH's filter *subscriptions* by URL. This is the preferred AGH pattern for long-lived filter lists that AGH should poll and refresh itself.

```typescript
// Add a new filter subscription to AdGuard Home
async function addFilterSubscription(host: string, auth: string, url: string, name: string) {
    await fetch(`http://${host}/control/filtering/add_url`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, name, whitelist: false }),
    });
}

// Then force a refresh
async function refreshFilters(host: string, auth: string) {
    await fetch(`http://${host}/control/filtering/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}` },
        body: JSON.stringify({ whitelist: false }),
    });
}
```

Combined with `adblock-compiler`'s Cloudflare Worker (`POST /compile`), this enables a fully automated workflow:

1. `adblock-compiler` compiles a blocklist and stores it (e.g. Cloudflare KV, R2, or a static URL)
2. AGH is pointed at that URL as a subscription
3. AGH polls and refreshes on its own schedule, or is triggered via `/control/filtering/refresh`

**Effort:** Low | **Value:** High

---

### 4. 📊 Stats-Enriched Diff Reports

AGH's `GET /control/stats` returns query counts per domain. This data could enrich `adblock-compiler`'s existing `DiffGenerator` — showing not just what rules were added/removed, but how many DNS queries each changed rule was blocking (or would block).

```typescript
// Hypothetical enriched diff
const stats = await fetch('http://adguardhome:3000/control/stats', {
    headers: { 'Authorization': `Basic ${auth}` },
}).then(r => r.json());

const diff = await diffGenerator.generate(oldList, newList);
// Annotate diff with AGH query counts
const enrichedDiff = diff.map(entry => ({
    ...entry,
    queryCount: stats.top_blocked_domains[entry.domain] ?? 0,
}));
```

**Effort:** Medium | **Value:** Medium — useful for list maintenance and pruning low-impact rules

---

### 5. 🔁 CI/CD Pipeline — Full Loop

The tightest integration is using `adblock-compiler` as a GitHub Actions step that compiles and deploys to AGH automatically:

```yaml
# .github/workflows/deploy-blocklist.yml
name: Compile and Deploy Blocklist

on:
  push:
    paths: ['config/blocklist.json']
  schedule:
    - cron: '0 2 * * *'  # daily at 2am

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Compile blocklist
        run: |
          deno run --allow-read --allow-write --allow-net \
            jsr:@jk-com/adblock-compiler/cli \
            -c config/blocklist.json \
            -o dist/blocklist.txt

      - name: Push to AdGuard Home
        run: |
          RULES=$(cat dist/blocklist.txt | jq -Rs 'split("\n")')
          curl -s -X POST http://$AGH_HOST/control/filtering/set_rules \
            -H "Authorization: Basic $AGH_AUTH" \
            -H "Content-Type: application/json" \
            -d "{\"rules\": $RULES}"
        env:
          AGH_HOST: ${{ secrets.AGH_HOST }}
          AGH_AUTH: ${{ secrets.AGH_AUTH }}
```

**Effort:** Low | **Value:** High — this is a complete, production-ready use case

---

### 6. 🌐 `adguard-home://` Source Protocol

Register `adguard-home://` as a first-class URI scheme in `adblock-compiler`'s source resolution, handled by `AdGuardHomeFetcher`. Possible sub-paths:

| URI | Resolves to |
|---|---|
| `adguard-home://user_rules` | Current custom user rules from AGH |
| `adguard-home://filter/{id}` | Content of a specific AGH filter subscription |
| `adguard-home://blocked_services` | All blocked service rules from AGH |

**Effort:** Low-Medium | **Value:** Medium

---

## Prioritized Roadmap

| # | Idea | Effort | Value | Notes |
|---|------|--------|-------|-------|
| 1 | Post-compile push hook (`set_rules`) | Low | High | Zero new abstractions needed |
| 2 | Document AGH as primary deployment target | ✅ Trivial | High | Update `PLATFORM_SUPPORT.md` |
| 3 | Subscription management (`add_url`, `refresh`) | Low | High | Better long-term pattern than `set_rules` |
| 4 | CI/CD GitHub Actions example | Low | High | Natural extension of existing workflows |
| 5 | `AdGuardHomeFetcher` + `adguard-home://` protocol | Low | Medium | Enables round-trip workflows |
| 6 | Stats-enriched diff reports | Medium | Medium | Powerful for list maintenance |

---

## Relationship to Other Integration Ideas

- [`HOSTLISTS_REGISTRY_INTEGRATION.md`](./HOSTLISTS_REGISTRY_INTEGRATION.md) — AGH pulls its vetted filters from HostlistsRegistry; `adblock-compiler` compiles from the same registry
- `FILTERS_REGISTRY_INTEGRATION.md` *(future)* — browser-side counterpart
- `docs/api/PLATFORM_SUPPORT.md` — the `WorkerCompiler` + `IContentFetcher` architecture that makes `AdGuardHomeFetcher` a natural fit