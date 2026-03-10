# NextDNS API Integration Ideas

Integration ideas for the [NextDNS API](https://nextdns.github.io/api/) and `adblock-compiler`.

> **Base URL:** `https://api.nextdns.io`
> **Docs:** [https://nextdns.github.io/api/](https://nextdns.github.io/api/)

---

## API Quick Reference

### Authentication

```
Authorization: <API_KEY>
```

Obtain your API key from your NextDNS account settings at https://my.nextdns.io/.

### Core Endpoint Groups

| Resource | Base Path | Description |
|---|---|---|
| Profiles | /profiles | Configuration containers |
| Denylist | /profiles/{id}/denylist | Blocked domains |
| Allowlist | /profiles/{id}/allowlist | Always-allowed domains |
| Blocklists | /profiles/{id}/blocklists | 3rd-party blocklist subscriptions |
| Parental Control | /profiles/{id}/parentalcontrol | Category/service blocks |
| Settings | /profiles/{id}/settings | Profile-level config |
| Logs | /profiles/{id}/logs | DNS query history |
| Analytics | /profiles/{id}/analytics | Aggregated usage stats |

### Key Endpoints

```
GET    /profiles
POST   /profiles
GET    /profiles/{profileId}
PATCH  /profiles/{profileId}
DELETE /profiles/{profileId}

GET    /profiles/{profileId}/denylist
POST   /profiles/{profileId}/denylist          body: { "id": "example.com", "active": true }
DELETE /profiles/{profileId}/denylist/{domain}

GET    /profiles/{profileId}/allowlist
POST   /profiles/{profileId}/allowlist         body: { "id": "example.com", "active": true }
DELETE /profiles/{profileId}/allowlist/{domain}

GET    /profiles/{profileId}/blocklists
POST   /profiles/{profileId}/blocklists        body: { "id": "oisd" }
DELETE /profiles/{profileId}/blocklists/{id}

GET    /profiles/{profileId}/logs?limit=100&from=<ts>&to=<ts>
GET    /profiles/{profileId}/analytics
```

---

## 1. Secure API Key Storage via Cloudflare Secrets

Store the NextDNS API key as a Cloudflare Worker secret:

```
wrangler secret put NEXTDNS_API_KEY
wrangler secret put NEXTDNS_PROFILE_ID
```

Validate at startup with Zod (ZOD_VALIDATION.md):

```typescript
const nextDnsConfigSchema = z.object({
    apiKey: z.string().min(1, 'NextDNS API key is required'),
    baseUrl: z.string().url().default('https://api.nextdns.io'),
    profileId: z.string().min(1, 'NextDNS profile ID is required'),
});
```

---

## 2. Sync Compiled Denylist Rules to NextDNS

After POST /compile, extract domain-only rules and push them to the NextDNS denylist:

```typescript
const { rules } = compilationResult;

const domains = rules
    .filter((r) => /^\|\|[^/]+\^$/.test(r))
    .map((r) => r.replace(/^\|\|/, '').replace(/\^$/, ''));

await Promise.all(
    domains.map((domain) =>
        fetch(`https://api.nextdns.io/profiles/${profileId}/denylist`, {
            method: 'POST',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: domain, active: true }),
        })
    )
);

emitEvent('dns:sync', {
    target: 'nextdns',
    list: 'denylist',
    count: domains.length,
    profileId,
});
```

---

## 3. Sync InvertAllow Output to NextDNS Allowlist

Push InvertAllow transformation output directly to the NextDNS allowlist:

```typescript
const allowlistRules = compilationResult.rules
    .filter((r) => r.startsWith('@@||'))
    .map((r) => r.replace(/^@@\|\|/, '').replace(/\^.*$/, ''));

await Promise.all(
    allowlistRules.map((domain) =>
        fetch(`https://api.nextdns.io/profiles/${profileId}/allowlist`, {
            method: 'POST',
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: domain, active: true }),
        })
    )
);
```

---

## 4. Push Compiled Output as a Hosted Blocklist Subscription

Host your compiled filter list as a public URL and subscribe NextDNS to it — one subscription update instead of per-domain POSTs:

```typescript
const compiledUrl = `https://adblock-compiler.jayson-knight.workers.dev/lists/${listId}`;

await fetch(`https://api.nextdns.io/profiles/${profileId}/blocklists`, {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: compiledUrl }),
});
```

This is the most efficient approach — NextDNS polls the URL and picks up updates automatically.

---

## 5. Per-Profile Batch Compilation

Map your batch compilation pipeline (BATCH_API_GUIDE.md) to per-NextDNS-profile rule sets:

```typescript
const profilesRes = await fetch('https://api.nextdns.io/profiles', {
    headers: { 'Authorization': apiKey },
});
const { data: profiles } = await profilesRes.json();

const batchRequest = {
    requests: profiles.map((profile) => ({
        id: profile.id,
        configuration: {
            name: `${profile.name} Filter`,
            sources: [{ source: 'https://example.org/filters.txt' }],
            transformations: ['Deduplicate', 'Validate', 'RemoveComments'],
        },
    })),
};

const compiled = await fetch(
    'https://adblock-compiler.jayson-knight.workers.dev/compile/batch',
    { method: 'POST', body: JSON.stringify(batchRequest) }
);
```

---

## 6. Query Log Feedback Loop

Pull /profiles/{id}/logs to surface domains being blocked that are not in your compiled rules:

```typescript
const logsRes = await fetch(
    `https://api.nextdns.io/profiles/${profileId}/logs?limit=1000`,
    { headers: { 'Authorization': apiKey } }
);
const { data: queries } = await logsRes.json();

const uncovered = queries
    .filter((q) => q.blocked && !compiledRulesSet.has(`||${q.name}^`))
    .map((q) => q.name);

emitEvent('diagnostic', {
    category: 'dns-feedback',
    severity: 'info',
    message: `${uncovered.length} blocked domains not in current compiled rules`,
    data: { domains: uncovered.slice(0, 20) },
});
```

---

## 7. Analytics-Driven Rule Optimization

Use /profiles/{id}/analytics to identify zero-hit rules as candidates for pruning:

```typescript
const analyticsRes = await fetch(
    `https://api.nextdns.io/profiles/${profileId}/analytics`,
    { headers: { 'Authorization': apiKey } }
);
const { data: analytics } = await analyticsRes.json();

emitEvent('diagnostic', {
    category: 'optimization',
    severity: 'warn',
    message: 'Rules with zero DNS hits are candidates for removal',
    data: { analytics },
});
```

---

## 8. Scheduled Cloudflare Cron Compile and Sync

```toml
# wrangler.toml
[triggers]
crons = ["0 */6 * * *"]
```

```typescript
export default {
    async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
        const compiled = await compileFilters(env);

        await env.KV.put(`list:${env.NEXTDNS_LIST_ID}`, compiled.rules.join('\n'));

        emitEvent('metric', {
            metric: 'scheduled_sync',
            target: 'nextdns',
            value: compiled.ruleCount,
            unit: 'count',
        });
    },
};
```

---

## 9. Full Pipeline: Compile to NextDNS Sync

```
adblock-compiler POST /compile
    FiltersDownloader: fetch + resolve !#if / !#include
    AGTree: parse to AST
    Transformations: Deduplicate, Validate, RemoveComments, InvertAllow
        |
NextDNS API
    POST /profiles/{id}/denylist    push block rules
    POST /profiles/{id}/allowlist   push allow rules
    POST /profiles/{id}/blocklists  subscribe to hosted compiled list URL
        |
Monitoring
    GET /profiles/{id}/logs         feedback loop
    GET /profiles/{id}/analytics    rule effectiveness
    Emit SSE/WebSocket: dns:sync, metric, diagnostic
```

---

## References

- [NextDNS API Documentation](https://nextdns.github.io/api/)
- [NextDNS Dashboard](https://my.nextdns.io/)
- [adblock-compiler API README](../docs/api/README.md)
- [adblock-compiler OpenAPI Support](../docs/api/OPENAPI_SUPPORT.md)
- [adblock-compiler Streaming API](../docs/api/STREAMING_API.md)
- [adblock-compiler Batch API Guide](../docs/api/BATCH_API_GUIDE.md)
- [adblock-compiler Zod Validation](../docs/api/ZOD_VALIDATION.md)
- [AdGuard DNS API Integration](./ADGUARD_DNS_API_INTEGRATION.md)
- [Pi-hole API Integration](./PIHOLE_API_INTEGRATION.md)