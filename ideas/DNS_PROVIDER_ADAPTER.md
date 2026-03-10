# DNS Provider Adapter Pattern

A unified abstraction layer for syncing compiled filter rules from adblock-compiler to any supported DNS provider.

Supported Providers: AdGuard DNS, NextDNS, Pi-hole  
Pattern: Compile once, sync anywhere  
Runtime: Cloudflare Workers (via WorkerCompiler and CompositeFetcher)

---

## Overview

adblock-compiler targets three DNS providers, each with different APIs, auth mechanisms, and rule formats:

| Provider | Type | Auth | Rule Format |
|---|---|---|---|
| AdGuard DNS | Cloud | ApiKey header | Full adblock syntax |
| NextDNS | Cloud | Authorization header | Domain-level entries |
| Pi-hole | Self-hosted | Session SID (POST /api/auth) | Domains + regex + adlists |

The adapter pattern lets you compile once and dispatch to any provider — or all three simultaneously — without changing compilation logic.

---

## 1. Core Interface

export interface DnsQuery {
    domain: string;
    blocked: boolean;
    timestamp: string;
}

export interface DnsSyncResult {
    provider: string;
    success: boolean;
    ruleCount: number;
    durationMs: number;
    error?: string;
}

export interface DnsProviderAdapter {
    readonly name: string;
    syncDenylist(domains: string[]): Promise<DnsSyncResult>;
    syncAllowlist(domains: string[]): Promise<DnsSyncResult>;
    subscribeBlocklist(url: string, label?: string): Promise<DnsSyncResult>;
    getQueryLog(limit?: number): Promise<DnsQuery[]>;
    ping(): Promise<boolean>;
}

---

## 2. AdGuard DNS Adapter

export class AdguardDnsAdapter implements DnsProviderAdapter {
    readonly name = 'adguard-dns';

    constructor(
        private readonly apiKey: string,
        private readonly baseUrl = 'https://api.adguard-dns.io',
    ) {}

    async syncDenylist(domains: string[]): Promise<DnsSyncResult> {
        const start = Date.now();
        const rules = domains.map((d) => `||${d}^`);
        const res = await fetch(`${this.baseUrl}/oapi/v1/filtering_rules`, {
            method: 'POST',
            headers: { 'Authorization': `ApiKey ${this.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules }),
        });
        return { provider: this.name, success: res.ok, ruleCount: rules.length, durationMs: Date.now() - start };
    }

    async syncAllowlist(domains: string[]): Promise<DnsSyncResult> {
        const start = Date.now();
        const rules = domains.map((d) => `@@||${d}^`);
        const res = await fetch(`${this.baseUrl}/oapi/v1/filtering_rules`, {
            method: 'POST',
            headers: { 'Authorization': `ApiKey ${this.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules }),
        });
        return { provider: this.name, success: res.ok, ruleCount: rules.length, durationMs: Date.now() - start };
    }

    async subscribeBlocklist(_url: string): Promise<DnsSyncResult> {
        return { provider: this.name, success: true, ruleCount: 0, durationMs: 0 };
    }

    async getQueryLog(limit = 100): Promise<DnsQuery[]> {
        const res = await fetch(`${this.baseUrl}/oapi/v1/query_log?limit=${limit}`, {
            headers: { 'Authorization': `ApiKey ${this.apiKey}` },
        });
        const { queries } = await res.json();
        return queries.map((q: any) => ({ domain: q.domain, blocked: q.blocked, timestamp: q.time }));
    }

    async ping(): Promise<boolean> {
        const res = await fetch(`${this.baseUrl}/oapi/v1/account/limits`, {
            headers: { 'Authorization': `ApiKey ${this.apiKey}` },
        });
        return res.ok;
    }
}

---

## 3. NextDNS Adapter

export class NextDnsAdapter implements DnsProviderAdapter {
    readonly name = 'nextdns';

    constructor(
        private readonly apiKey: string,
        private readonly profileId: string,
        private readonly baseUrl = 'https://api.nextdns.io',
    ) {}

    private get headers() {
        return { 'Authorization': this.apiKey, 'Content-Type': 'application/json' };
    }

    async syncDenylist(domains: string[]): Promise<DnsSyncResult> {
        const start = Date.now();
        await Promise.all(
            domains.map((domain) =>
                fetch(`${this.baseUrl}/profiles/${this.profileId}/denylist`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({ id: domain, active: true }),
                })
            )
        );
        return { provider: this.name, success: true, ruleCount: domains.length, durationMs: Date.now() - start };
    }

    async syncAllowlist(domains: string[]): Promise<DnsSyncResult> {
        const start = Date.now();
        await Promise.all(
            domains.map((domain) =>
                fetch(`${this.baseUrl}/profiles/${this.profileId}/allowlist`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({ id: domain, active: true }),
                })
            )
        );
        return { provider: this.name, success: true, ruleCount: domains.length, durationMs: Date.now() - start };
    }

    async subscribeBlocklist(url: string): Promise<DnsSyncResult> {
        const start = Date.now();
        const res = await fetch(`${this.baseUrl}/profiles/${this.profileId}/blocklists`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ id: url }),
        });
        return { provider: this.name, success: res.ok, ruleCount: 1, durationMs: Date.now() - start };
    }

    async getQueryLog(limit = 100): Promise<DnsQuery[]> {
        const res = await fetch(`${this.baseUrl}/profiles/${this.profileId}/logs?limit=${limit}`, {
            headers: this.headers,
        });
        const { data } = await res.json();
        return (data ?? []).map((q: any) => ({ domain: q.name, blocked: q.blocked, timestamp: q.timestamp }));
    }

    async ping(): Promise<boolean> {
        const res = await fetch(`${this.baseUrl}/profiles/${this.profileId}`, { headers: this.headers });
        return res.ok;
    }
}

---

## 4. Pi-hole Adapter

export class PiholeAdapter implements DnsProviderAdapter {
    readonly name = 'pihole';
    private sid: string | null = null;
    private expiresAt = 0;

    constructor(private readonly baseUrl: string, private readonly password: string) {}

    private async getSid(): Promise<string> {
        if (this.sid && Date.now() < this.expiresAt - 10_000) return this.sid;
        const res = await fetch(`${this.baseUrl}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: this.password }),
        });
        const { session } = await res.json();
        this.sid = session.sid;
        this.expiresAt = Date.now() + session.validity * 1000;
        return this.sid!;
    }

    private async getHeaders(): Promise<Record<string, string>> {
        return { 'X-FTL-SID': await this.getSid(), 'Content-Type': 'application/json' };
    }

    async syncDenylist(domains: string[]): Promise<DnsSyncResult> {
        const start = Date.now();
        const h = await this.getHeaders();
        await Promise.all(
            domains.map((domain) =>
                fetch(`${this.baseUrl}/api/domains/deny`, {
                    method: 'POST', headers: h,
                    body: JSON.stringify({ domain, comment: 'adblock-compiler' }),
                })
            )
        );
        return { provider: this.name, success: true, ruleCount: domains.length, durationMs: Date.now() - start };
    }

    async syncAllowlist(domains: string[]): Promise<DnsSyncResult> {
        const start = Date.now();
        const h = await this.getHeaders();
        await Promise.all(
            domains.map((domain) =>
                fetch(`${this.baseUrl}/api/domains/allow`, { method: 'POST', headers: h, body: JSON.stringify({ domain }) })
            )
        );
        return { provider: this.name, success: true, ruleCount: domains.length, durationMs: Date.now() - start };
    }

    async subscribeBlocklist(url: string, label = 'adblock-compiler managed list'): Promise<DnsSyncResult> {
        const start = Date.now();
        const h = await this.getHeaders();
        const res = await fetch(`${this.baseUrl}/api/lists`, {
            method: 'POST', headers: h,
            body: JSON.stringify({ address: url, enabled: true, comment: label }),
        });
        return { provider: this.name, success: res.ok, ruleCount: 1, durationMs: Date.now() - start };
    }

    async getQueryLog(limit = 100): Promise<DnsQuery[]> {
        const h = await this.getHeaders();
        const res = await fetch(`${this.baseUrl}/api/queries?limit=${limit}`, { headers: h });
        const { data } = await res.json();
        return (data ?? []).map((q: any) => ({ domain: q.domain, blocked: q.status === 'BLOCKED', timestamp: q.time }));
    }

    async ping(): Promise<boolean> {
        const h = await this.getHeaders();
        const res = await fetch(`${this.baseUrl}/api/stats/summary`, { headers: h });
        return res.ok;
    }
}

---

## 5. Factory: Pick Adapter from Environment

export type DnsProviderName = 'adguard-dns' | 'nextdns' | 'pihole';

export function getDnsAdapter(env: DnsAdapterEnv): DnsProviderAdapter {
    const provider = env.DNS_PROVIDER ?? 'adguard-dns';

    switch (provider) {
        case 'adguard-dns':
            if (!env.ADGUARD_DNS_API_KEY) throw new Error('ADGUARD_DNS_API_KEY is required');
            return new AdguardDnsAdapter(env.ADGUARD_DNS_API_KEY);

        case 'nextdns':
            if (!env.NEXTDNS_API_KEY || !env.NEXTDNS_PROFILE_ID) throw new Error('NEXTDNS_API_KEY and NEXTDNS_PROFILE_ID are required');
            return new NextDnsAdapter(env.NEXTDNS_API_KEY, env.NEXTDNS_PROFILE_ID);

        case 'pihole':
            if (!env.PIHOLE_BASE_URL || !env.PIHOLE_PASSWORD) throw new Error('PIHOLE_BASE_URL and PIHOLE_PASSWORD are required');
            return new PiholeAdapter(env.PIHOLE_BASE_URL, env.PIHOLE_PASSWORD);

        default:
            throw new Error(`Unknown DNS provider: ${provider}`);
    }
}

Cloudflare Worker secrets needed per provider:

AdGuard DNS:   wrangler secret put ADGUARD_DNS_API_KEY
NextDNS:       wrangler secret put NEXTDNS_API_KEY
               wrangler secret put NEXTDNS_PROFILE_ID
Pi-hole:       wrangler secret put PIHOLE_BASE_URL
               wrangler secret put PIHOLE_PASSWORD

---

## 6. Multi-Provider Broadcast Adapter

Sync to all providers simultaneously:

export class BroadcastDnsAdapter implements DnsProviderAdapter {
    readonly name = 'broadcast';

    constructor(private readonly adapters: DnsProviderAdapter[]) {}

    async syncDenylist(domains: string[]): Promise<DnsSyncResult> {
        const start = Date.now();
        const results = await Promise.allSettled(this.adapters.map((a) => a.syncDenylist(domains)));
        const failed = results.filter((r) => r.status === 'rejected');
        return {
            provider: this.name,
            success: failed.length === 0,
            ruleCount: domains.length,
            durationMs: Date.now() - start,
            error: failed.length > 0 ? `${failed.length} provider(s) failed` : undefined,
        };
    }

    async syncAllowlist(domains: string[]): Promise<DnsSyncResult> {
        const start = Date.now();
        await Promise.allSettled(this.adapters.map((a) => a.syncAllowlist(domains)));
        return { provider: this.name, success: true, ruleCount: domains.length, durationMs: Date.now() - start };
    }

    async subscribeBlocklist(url: string, label?: string): Promise<DnsSyncResult> {
        const start = Date.now();
        await Promise.allSettled(this.adapters.map((a) => a.subscribeBlocklist(url, label)));
        return { provider: this.name, success: true, ruleCount: 1, durationMs: Date.now() - start };
    }

    async getQueryLog(limit = 100): Promise<DnsQuery[]> {
        const results = await Promise.allSettled(this.adapters.map((a) => a.getQueryLog(limit)));
        return results
            .filter((r): r is PromiseFulfilledResult<DnsQuery[]> => r.status === 'fulfilled')
            .flatMap((r) => r.value);
    }

    async ping(): Promise<boolean> {
        const results = await Promise.allSettled(this.adapters.map((a) => a.ping()));
        return results.every((r) => r.status === 'fulfilled' && r.value);
    }
}

---

## 7. Zod Validation for Adapter Config

const adguardDnsEnvSchema = z.object({
    DNS_PROVIDER: z.literal('adguard-dns'),
    ADGUARD_DNS_API_KEY: z.string().min(32),
});

const nextDnsEnvSchema = z.object({
    DNS_PROVIDER: z.literal('nextdns'),
    NEXTDNS_API_KEY: z.string().min(1),
    NEXTDNS_PROFILE_ID: z.string().min(1),
});

const piholeEnvSchema = z.object({
    DNS_PROVIDER: z.literal('pihole'),
    PIHOLE_BASE_URL: z.string().url(),
    PIHOLE_PASSWORD: z.string().min(1),
});

export const dnsAdapterEnvSchema = z.discriminatedUnion('DNS_PROVIDER', [
    adguardDnsEnvSchema,
    nextDnsEnvSchema,
    piholeEnvSchema,
]);

---

## 8. Usage in the Worker Pipeline

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const dnsEnv = dnsAdapterEnvSchema.parse(env);
        const adapter = getDnsAdapter(dnsEnv);
        const compiled = await compileFilters(env, request);

        const denyDomains = compiled.rules
            .filter((r) => /^\|\|[^/]+\^$/.test(r))
            .map((r) => r.replace(/^\|\|/, '').replace(/\^$/, ''));

        const allowDomains = compiled.rules
            .filter((r) => r.startsWith('@@||'))
            .map((r) => r.replace(/^@@\|\|/, '').replace(/\^.*$/, ''));

        const [denyResult, allowResult] = await Promise.all([
            adapter.syncDenylist(denyDomains),
            adapter.syncAllowlist(allowDomains),
        ]);

        emitEvent('dns:sync', { deny: denyResult, allow: allowResult });

        return Response.json({ compiled, denyResult, allowResult });
    },
};

---

## 9. Full Architecture

adblock-compiler POST /compile
    FiltersDownloader   resolve !#if / !#include
    AGTree              parse to AST
    Transformations     Deduplicate, Validate, RemoveComments, InvertAllow
        |
DnsProviderAdapter (factory)
    AdguardDnsAdapter   POST /oapi/v1/filtering_rules
    NextDnsAdapter      POST /profiles/{id}/denylist + allowlist
    PiholeAdapter       POST /api/domains/deny + allow + /api/lists
    BroadcastAdapter    all of the above in parallel
        |
Monitoring
    getQueryLog()       feedback loop across all providers
    ping()              health check on startup / cron
    Emit SSE/WebSocket  dns:sync, metric, diagnostic

---

## References

- AdGuard DNS API Integration: ./ADGUARD_DNS_API_INTEGRATION.md
- NextDNS API Integration: ./NEXTDNS_API_INTEGRATION.md
- Pi-hole API Integration: ./PIHOLE_API_INTEGRATION.md
- adblock-compiler Platform Support: ../docs/api/PLATFORM_SUPPORT.md
- adblock-compiler Zod Validation: ../docs/api/ZOD_VALIDATION.md
- adblock-compiler Streaming API: ../docs/api/STREAMING_API.md
- adblock-compiler Batch API Guide: ../docs/api/BATCH_API_GUIDE.md
- adblock-compiler OpenAPI Support: ../docs/api/OPENAPI_SUPPORT.md