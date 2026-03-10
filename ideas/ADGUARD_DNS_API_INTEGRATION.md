# AdGuard DNS Private API Integration Ideas

Integration ideas for the [AdGuard DNS Private API](https://adguard-dns.io/kb/private-dns/api/overview/) and `adblock-compiler`.

> **Base URL:** `https://api.adguard-dns.io`
> **OpenAPI Spec:** [`https://api.adguard-dns.io/swagger/openapi.json`](https://api.adguard-dns.io/swagger/openapi.json)
> **API Version:** v1.11+

---

## API Quick Reference

### Authentication

Two supported methods. API keys are recommended as of v2.17:

```http
# API Key (recommended)
Authorization: ApiKey {api_key}

# Bearer token (legacy, still supported)
Authorization: Bearer {access_token}
```

Generate a Bearer token:
```http
POST /oapi/v1/oauth_token
Content-Type: application/json

{
    "username": "user@example.com",
    "password": "...",
    "totp_token": "123456"
}
```

Refresh / revoke:
```http
POST   /oapi/v1/oauth_token/refresh   # Refresh token
DELETE /oapi/v1/oauth_token           # Revoke token
```

### Core Endpoint Groups

| Group | Base Path | Description |
|---|---|---|
| Account | `/oapi/v1/account` | Limits, plan info |
| Authentication | `/oapi/v1/oauth_token` | Token management |
| Devices | `/oapi/v1/devices` | Device CRUD |
| DNS Servers | `/oapi/v1/dns_servers` | Server configuration |
| Filtering Rules | `/oapi/v1/filtering_rules` | Custom rule management |
| Dedicated IPs | `/oapi/v1/dedicated_addresses` | IPv4 allocation |
| Query Log | `/oapi/v1/query_log` | DNS query history |
| Statistics | `/oapi/v1/stats` | Usage statistics |

### Plan Limits (from `/oapi/v1/account/limits`)

| Plan | Devices | Custom Rules |
|---|---|---|
| Personal | Limited | 1,000 |
| Team | More | 5,000 |
| Enterprise | Unlimited | 100,000 |

---

## 1. 🔐 Secure API Key Management via Cloudflare Secrets

Store the AdGuard DNS API key as a **Cloudflare Worker secret** rather than an environment variable, and expose it to your compilation pipeline:

```bash
wrangler secret put ADGUARD_DNS_API_KEY
```

Access in your Worker:

```typescript
// src/worker.ts
const apiKey = env.ADGUARD_DNS_API_KEY;

const response = await fetch('https://api.adguard-dns.io/oapi/v1/account/limits', {
    headers: {
        'Authorization': `ApiKey ${apiKey}`,
        'Content-Type': 'application/json',
    },
});
```

Validate the key shape at startup using your Zod layer ([`ZOD_VALIDATION.md`](../docs/api/ZOD_VALIDATION.md)):

```typescript
const adguardDnsConfigSchema = z.object({
    apiKey: z.string().min(32, 'AdGuard DNS API key must be at least 32 characters'),
    baseUrl: z.string().url().default('https://api.adguard-dns.io'),
});
```

---

## 2. 📋 Sync Compiled Filter Rules to AdGuard DNS Filtering Rules

After `POST /compile` completes, automatically push the compiled rules to your AdGuard DNS account's custom filtering rules. This closes the loop from **compilation → enforcement**:

```typescript
// After compilation completes
const { rules } = compilationResult;

// Push rules to AdGuard DNS
await fetch('https://api.adguard-dns.io/oapi/v1/filtering_rules', {
    method: 'POST',
    headers: {
        'Authorization': `ApiKey ${apiKey}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rules }),
});
```

Emit a streaming event when sync completes ([`STREAMING_API.md`](../docs/api/STREAMING_API.md)):

```typescript
emitEvent('dns:sync', {
    ruleCount: rules.length,
    target: 'adguard-dns',
    status: 'success',
    timestamp: new Date().toISOString(),
});
```

---

## 3. 📡 OpenAPI Endpoints for DNS Rule Sync

Extend your existing OpenAPI surface ([`OPENAPI_SUPPORT.md`](../docs/api/OPENAPI_SUPPORT.md)) with DNS sync endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `POST /dns/sync` | `POST` | Compile and push rules to AdGuard DNS |
| `GET /dns/rules` | `GET` | Fetch current rules from AdGuard DNS |
| `DELETE /dns/rules` | `DELETE` | Clear all custom rules from AdGuard DNS |
| `GET /dns/account` | `GET` | Fetch account limits and plan info |
| `GET /dns/devices` | `GET` | List devices registered on AdGuard DNS |

Example request for `POST /dns/sync`:

```json
{
    "configuration": {
        "name": "My DNS Filter",
        "sources": [
            { "source": "https://example.org/filters.txt" }
        ],
        "transformations": ["Deduplicate", "Validate", "RemoveComments"]
    },
    "dnsSync": {
        "enabled": true,
        "deviceIds": ["device-abc-123"],
        "replaceExisting": true
    }
}
```

---

## 4. 🖥️ Per-Device Rule Compilation and Sync

AdGuard DNS supports per-device filtering configurations. Map your batch compilation pipeline ([`BATCH_API_GUIDE.md`](../docs/api/BATCH_API_GUIDE.md)) to **per-device rule sets**:

1. `GET /oapi/v1/devices` — fetch all registered devices
2. For each device, run a targeted `POST /compile/batch` with device-specific platform conditions
3. `POST` the compiled rules to the device's filtering configuration

```typescript
// Step 1: Fetch devices
const devicesRes = await fetch('https://api.adguard-dns.io/oapi/v1/devices', {
    headers: { 'Authorization': `ApiKey ${apiKey}` },
});
const { devices } = await devicesRes.json();

// Step 2: Batch compile per device
const batchRequest = {
    requests: devices.map((device) => ({
        id: device.id,
        configuration: {
            name: `${device.name} Filter`,
            sources: [{ source: 'https://example.org/filters.txt' }],
            transformations: ['Deduplicate', 'Validate'],
        },
    })),
};

const compiled = await fetch('https://adblock-compiler.jayson-knight.workers.dev/compile/batch', {
    method: 'POST',
    body: JSON.stringify(batchRequest),
});

// Step 3: Push per-device rules to AdGuard DNS
// ...
```

---

## 5. 🔄 Scheduled Recompile + Sync via Cloudflare Cron Triggers

Use a **Cloudflare Cron Trigger** to automatically recompile filter lists and push updated rules to AdGuard DNS on a schedule:

```toml
# wrangler.toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

```typescript
// src/worker.ts
export default {
    async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
        // 1. Compile
        const compiled = await compileFilters(env);

        // 2. Sync to AdGuard DNS
        await fetch('https://api.adguard-dns.io/oapi/v1/filtering_rules', {
            method: 'POST',
            headers: { 'Authorization': `ApiKey ${env.ADGUARD_DNS_API_KEY}` },
            body: JSON.stringify({ rules: compiled.rules }),
        });

        // 3. Emit metric
        emitEvent('metric', {
            metric: 'scheduled_sync',
            value: compiled.ruleCount,
            unit: 'count',
        });
    },
};
```

---

## 6. 📊 Pull Query Log Stats for Compilation Feedback

Use `/oapi/v1/query_log` and `/oapi/v1/stats` to **inform future compilations** — blocked domains appearing in query logs that aren't yet in your filter lists are candidates for new rules:

```typescript
// Fetch recent query log
const logRes = await fetch('https://api.adguard-dns.io/oapi/v1/query_log', {
    headers: { 'Authorization': `ApiKey ${apiKey}` },
});
const { queries } = await logRes.json();

// Find blocked domains not currently in compiled rules
const uncoveredDomains = queries
    .filter((q) => q.blocked && !compiledRules.includes(`||${q.domain}^`))
    .map((q) => q.domain);

// Surface as suggestions via your streaming diagnostic events
emitEvent('diagnostic', {
    category: 'dns-feedback',
    severity: 'info',
    message: `${uncoveredDomains.length} blocked domains not in current filter list`,
    data: { domains: uncoveredDomains.slice(0, 20) },
});
```

---

## 7. ✅ Account Limit Guard via Zod

Before syncing compiled rules, check account limits from `/oapi/v1/account/limits` and validate against your Zod schema to prevent silent failures:

```typescript
const accountLimitsSchema = z.object({
    devices: z.number(),
    filtering_rules: z.number(),
    dedicated_addresses: z.number(),
});

const limitsRes = await fetch('https://api.adguard-dns.io/oapi/v1/account/limits', {
    headers: { 'Authorization': `ApiKey ${apiKey}` },
});

const limits = accountLimitsSchema.parse(await limitsRes.json());

if (compiled.ruleCount > limits.filtering_rules) {
    throw new Error(
        `Compiled rule count (${compiled.ruleCount}) exceeds AdGuard DNS plan limit (${limits.filtering_rules}). ` +
        `Consider upgrading your plan or applying stricter Deduplicate/Validate transformations.`
    );
}
```

---

## 8. 🔗 Full Pipeline: Compile → Validate → Sync → Monitor

```
adblock-compiler POST /compile
    └─ FiltersDownloader: fetch + resolve !#if / !#include
    └─ AGTree: parse → AST
    └─ Transformations: Deduplicate, Validate, RemoveComments
    └─ DiffBuilder: generate patch vs previous output
        ↓
AdGuard DNS Private API
    └─ GET /oapi/v1/account/limits → guard rule count
    └─ POST /oapi/v1/filtering_rules → push compiled rules
    └─ GET /oapi/v1/devices → per-device sync
        ↓
Monitoring
    └─ GET /oapi/v1/query_log → feedback loop
    └─ GET /oapi/v1/stats → usage metrics
    └─ Emit SSE/WebSocket events: dns:sync, metric, diagnostic
```

---

## References

- [AdGuard DNS Private API Overview](https://adguard-dns.io/kb/private-dns/api/overview/)
- [AdGuard DNS Private API Changelog](https://adguard-dns.io/kb/private-dns/api/changelog/)
- [AdGuard DNS API Swagger](https://api.adguard-dns.io/swagger/openapi.json)
- [DNS Filtering Rule Syntax](https://adguard-dns.io/kb/general/dns-filtering-syntax/)
- [AdGuard DNS Blocklists](https://adguard-dns.io/kb/private-dns/setting-up-filtering/blocklists/)
- [AdGuard DNS Access Settings](https://adguard-dns.io/kb/private-dns/server-and-settings/access/)
- [adblock-compiler API README](../docs/api/README.md)
- [adblock-compiler OpenAPI Support](../docs/api/OPENAPI_SUPPORT.md)
- [adblock-compiler Streaming API](../docs/api/STREAMING_API.md)
- [adblock-compiler Batch API Guide](../docs/api/BATCH_API_GUIDE.md)
- [adblock-compiler Zod Validation](../docs/api/ZOD_VALIDATION.md)
- [DiffBuilder Integration Ideas](./DIFF_BUILDER_INTEGRATION.md)
- [FiltersDownloader Integration Ideas](./FILTERS_DOWNLOADER_INTEGRATION.md)