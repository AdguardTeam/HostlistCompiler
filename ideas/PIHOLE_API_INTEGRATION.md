# Pi-hole API Integration Ideas

Integration ideas for the Pi-hole v6 API (https://docs.pi-hole.net/api/) and adblock-compiler.

Base URL: http://<your-pihole>/api (self-hosted)
Interactive Docs: http://pi.hole/api/docs (on your own installation)

---

## API Quick Reference

### Authentication

Pi-hole v6 uses session-based authentication - no static API keys.

POST /api/auth
body: { "password": "your-password" }

Response:
{
    "session": {
        "valid": true,
        "sid": "abc123...",
        "csrf": "xyz789...",
        "validity": 300
    }
}

Use the SID in subsequent requests via header:
X-FTL-SID: abc123...

Or via URL param: ?sid=abc123...

Sessions expire after 300 seconds. Re-authenticate proactively.

### Core Endpoint Groups

| Resource | Base Path | Description |
|---|---|---|
| Auth | /api/auth | Session management |
| Blocking | /api/dns/blocking | Toggle DNS blocking |
| Domains | /api/domains | Allow/deny/regex domain lists |
| Lists | /api/lists | Adlist subscriptions |
| Groups | /api/groups | Group management |
| Clients | /api/clients | Client management |
| Query Log | /api/queries | DNS query history |
| Statistics | /api/stats | Usage statistics |

### Key Endpoints

POST   /api/auth
DELETE /api/auth

GET    /api/dns/blocking
POST   /api/dns/blocking                  body: { "blocking": true, "timer": 3600 }

GET    /api/domains
POST   /api/domains/deny                  body: { "domain": "example.com", "comment": "..." }
POST   /api/domains/allow                 body: { "domain": "example.com" }
POST   /api/domains/regex-deny
POST   /api/domains/regex-allow
DELETE /api/domains/{type}/{domain}

GET    /api/lists
POST   /api/lists                         body: { "address": "https://..", "enabled": true }
DELETE /api/lists/{id}

GET    /api/groups
POST   /api/groups

GET    /api/stats/summary
GET    /api/queries?limit=100

### Domain List Priority (highest to lowest)

1. Exact allow
2. Regex allow
3. Exact deny
4. Subscribed allow
5. Subscribed deny
6. Regex deny

---

## 1. Session Management with Auto-Refresh

class PiholeSession {
    private sid = null;
    private expiresAt = 0;

    constructor(private baseUrl, private password) {}

    async getSid() {
        if (this.sid && Date.now() < this.expiresAt - 10_000) return this.sid;
        return this.authenticate();
    }

    private async authenticate() {
        const res = await fetch(`${this.baseUrl}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: this.password }),
        });
        const { session } = await res.json();
        this.sid = session.sid;
        this.expiresAt = Date.now() + session.validity * 1000;
        return this.sid;
    }
}

Store credentials as Cloudflare Worker secrets:
wrangler secret put PIHOLE_PASSWORD
wrangler secret put PIHOLE_BASE_URL

Validate at startup with Zod:
const piholeConfigSchema = z.object({
    baseUrl: z.string().url(),
    password: z.string().min(1),
});

---

## 2. Sync Compiled Deny Rules to Pi-hole

const sid = await piholeSession.getSid();

const domains = rules
    .filter((r) => /^\|\|[^/]+\^$/.test(r))
    .map((r) => r.replace(/^\|\|/, '').replace(/\^$/, ''));

await Promise.all(
    domains.map((domain) =>
        fetch(`${piholeBaseUrl}/api/domains/deny`, {
            method: 'POST',
            headers: { 'X-FTL-SID': sid, 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, comment: 'adblock-compiler' }),
        })
    )
);

emitEvent('dns:sync', { target: 'pihole', list: 'deny', count: domains.length });

---

## 3. Sync InvertAllow Output to Pi-hole Allowlist

const allowDomains = compilationResult.rules
    .filter((r) => r.startsWith('@@||'))
    .map((r) => r.replace(/^@@\|\|/, '').replace(/\^.*$/, ''));

await Promise.all(
    allowDomains.map((domain) =>
        fetch(`${piholeBaseUrl}/api/domains/allow`, {
            method: 'POST',
            headers: { 'X-FTL-SID': sid, 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain }),
        })
    )
);

---

## 4. Push Regex Rules to Pi-hole Regex Deny/Allow

const regexRules = compilationResult.rules
    .filter((r) => r.startsWith('/') && r.endsWith('/'));

await Promise.all(
    regexRules.map((rule) =>
        fetch(`${piholeBaseUrl}/api/domains/regex-deny`, {
            method: 'POST',
            headers: { 'X-FTL-SID': sid, 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: rule.slice(1, -1) }),
        })
    )
);

---

## 5. Subscribe Pi-hole to a Hosted Compiled List (Adlist)

Host compiled output as a public URL and add it as a Pi-hole adlist subscription:

const compiledUrl = `https://adblock-compiler.jayson-knight.workers.dev/lists/${listId}`;

await fetch(`${piholeBaseUrl}/api/lists`, {
    method: 'POST',
    headers: { 'X-FTL-SID': sid, 'Content-Type': 'application/json' },
    body: JSON.stringify({
        address: compiledUrl,
        enabled: true,
        comment: 'adblock-compiler managed list',
    }),
});

Pi-hole polls the URL automatically on its refresh schedule.

---

## 6. Group-Based Rule Assignment

Map per-platform compilation output to Pi-hole groups:

const groups = [
    { name: 'Adults', listId: 'strict-filter' },
    { name: 'Kids', listId: 'family-filter' },
    { name: 'IoT', listId: 'iot-filter' },
];

await Promise.all(
    groups.map((group) =>
        fetch(`${piholeBaseUrl}/api/groups`, {
            method: 'POST',
            headers: { 'X-FTL-SID': sid, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: group.name, enabled: true }),
        })
    )
);

---

## 7. Toggle Blocking Around Maintenance Windows

// Disable for 60 seconds during sync
await fetch(`${piholeBaseUrl}/api/dns/blocking`, {
    method: 'POST',
    headers: { 'X-FTL-SID': sid, 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocking: false, timer: 60 }),
});

// ... perform sync ...

// Re-enable
await fetch(`${piholeBaseUrl}/api/dns/blocking`, {
    method: 'POST',
    headers: { 'X-FTL-SID': sid, 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocking: true }),
});

---

## 8. DNS Provider Adapter Pattern

Abstract multiple DNS providers behind a common interface:

interface DnsProviderAdapter {
    syncDenylist(domains: string[]): Promise<void>;
    syncAllowlist(domains: string[]): Promise<void>;
    subscribeBlocklist(url: string): Promise<void>;
    getQueryLog(): Promise<DnsQuery[]>;
}

class PiholeAdapter implements DnsProviderAdapter { ... }
class NextDnsAdapter implements DnsProviderAdapter { ... }
class AdguardDnsAdapter implements DnsProviderAdapter { ... }

const adapter = getDnsAdapter(env);
await adapter.syncDenylist(compiledDomains);

This lets you compile once and sync to any supported DNS provider.

---

## 9. Full Pipeline

adblock-compiler POST /compile
    FiltersDownloader: resolve !#if / !#include
    AGTree: parse to AST
    Transformations: Deduplicate, Validate, RemoveComments, InvertAllow
        |
Pi-hole API (self-hosted)
    POST /api/auth               get session SID
    POST /api/domains/deny       push block rules
    POST /api/domains/allow      push allow rules
    POST /api/domains/regex-deny push regex rules
    POST /api/lists              subscribe to hosted compiled list
    POST /api/groups             per-device/client group assignment
        |
Monitoring
    GET /api/queries             query log feedback loop
    GET /api/stats/summary       usage metrics
    Emit SSE/WebSocket: dns:sync, metric, diagnostic

---

## References

- Pi-hole API Documentation: https://docs.pi-hole.net/api/
- Pi-hole Authentication: https://docs.pi-hole.net/api/auth/
- Pi-hole Domain Database: https://docs.pi-hole.net/database/domain-database/
- Pi-hole Group Management: https://docs.pi-hole.net/group_management/example/
- adblock-compiler API README: ../docs/api/README.md
- adblock-compiler Streaming API: ../docs/api/STREAMING_API.md
- adblock-compiler Batch API Guide: ../docs/api/BATCH_API_GUIDE.md
- adblock-compiler Zod Validation: ../docs/api/ZOD_VALIDATION.md
- AdGuard DNS API Integration: ./ADGUARD_DNS_API_INTEGRATION.md
- NextDNS API Integration: ./NEXTDNS_API_INTEGRATION.md