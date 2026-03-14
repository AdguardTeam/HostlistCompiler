# Real-Time Threat Intelligence Ingestion & MCP Server
## Living Design Document

> **Status:** In Progress — Draft
> **Related Issue:** #1021
> **Last Updated:** 2026-03-14
> **Owner:** @jaypatrick

---

## Table of Contents

1. [Vision and Goals](#1-vision-and-goals)
2. [Architecture Overview](#2-architecture-overview)
3. [Signal Sources](#3-signal-sources)
4. [Ingestion Layer — Detailed Design](#4-ingestion-layer--detailed-design)
5. [MCP Server — Interface Design](#5-mcp-server--interface-design)
6. [Rule Generation Pipeline](#6-rule-generation-pipeline)
7. [Distribution Layer](#7-distribution-layer)
8. [Prisma Schema Changes](#8-prisma-schema-changes)
9. [Implementation Phases](#9-implementation-phases)
10. [Open Questions and Decisions](#10-open-questions-and-decisions)
11. [Changelog](#11-changelog)

---

## 1. Vision and Goals

Build a **real-time threat/nuisance/ad domain intelligence platform** on top of the existing adblock-compiler infrastructure, exposed via an MCP (Model Context Protocol) server so that:

1. **AI agents and tools** can query live threat/tracker/ad domain data via structured MCP tools.
2. **DNS blocking providers** (AdGuard, NextDNS, Pi-hole, ControlD, etc.) can subscribe to or pull real-time lists in their native formats.
3. **End-users and enterprises** can access curated, always-current blocklists without maintaining them manually.

### Non-Goals (for now)

- Full ML/LLM-based rule synthesis — comes after the AST corpus matures.
- Replacing existing curated lists (EasyList, OISD, hagezi) — we supplement them with real-time signals.
- Building a Certificate Transparency log ingestion pipeline in Phase 1.

---

## 2. Architecture Overview

```
Signal Sources (Cloudflare Radar, CT Logs future, blocklist diffs)
    |
    | Cron Worker every 15 min
    v
Ingestion Worker (worker/handlers/threat-intel.ts)
    CloudflareRadarFetcher -> normalize -> score -> dedup -> D1 + Queue
    |
    | THREAT_INTEL_QUEUE messages
    v
Rule Generation Worker (existing AGTree pipeline)
    High-confidence domains -> AGTree AST -> all formats -> R2 + D1
    |
    +---> MCP Server (/mcp/*)
    |
    +---> Distribution Layer (R2 hosted URLs, provider push APIs, webhooks)
```

**Existing infrastructure this builds on:**

| What | Where in codebase |
|------|-------------------|
| Worker router / handler pattern | worker/router.ts, worker/handlers/ |
| MCP agent routing | worker/mcp-agent.ts, worker/agent-routing.ts |
| Cloudflare bindings (D1, R2, KV, Queues) | worker/types.ts, wrangler.toml |
| AGTree AST pipeline | src/downloader/, src/compiler/, src/transformations/ |
| IContentFetcher abstraction | src/platform/types.ts |
| Clerk auth + tier gating | worker/middleware/clerk-jwt.ts, worker/middleware/auth.ts |
| AnalyticsService | src/services/AnalyticsService.ts |

---

## 3. Signal Sources

### Phase 1 (ship first)

| Source | API / Method | Signal Quality | Notes |
|--------|-------------|---------------|-------|
| Cloudflare Radar — Security Categories | /radar/entities domain categorisation endpoints | High (Malware, Phishing, C2, Botnet, DGA, DNS Tunneling, Scam) | Powered by Cloudforce One + ML |
| Cloudflare Radar — Domain Rankings | GET /radar/ranking/domain?limit=1000 | Medium (trending, not threat-specific) | Useful for ad-network detection |
| Cloudflare Radar — DNS Top | /radar/dns/top/ases + /radar/dns/top/locations | Medium | |
| Existing blocklist diffs | Re-use FilterDownloader + ast_rules table | High (community-curated) | Self-hosted |

**Cloudflare Radar security categories available as of 2025 (Cloudforce One + ML pipeline):**

- Anonymizer — sites enabling anonymous browsing
- Brand Embedding — fake/lookalike brand sites
- Command and Control and Botnet — C2 / botnet infrastructure
- Compromised Domain — hijacked legitimate domains
- Cryptomining — browser-based mining
- DGA Domains — algorithmically generated domains (malware)
- DNS Tunneling — data exfiltration via DNS
- Malware — active malware hosting
- Phishing — credential-stealing sites
- Potentially Unwanted Software — adware / grayware
- Scam — fraudulent sites

### Phase 2 (future)

| Source | Notes |
|--------|-------|
| Certificate Transparency logs (crt.sh API) | Newly-registered domains, subdomain explosion patterns |
| URLhaus / PhishTank feeds | Public malware/phishing URL feeds |
| Community submission endpoint POST /api/threat-intel/report | Crowdsourced signals |
| DNS passive telemetry | Requires partnership or own resolver — long-term |

---

## 4. Ingestion Layer — Detailed Design

### 4.1 CloudflareRadarFetcher

A new IContentFetcher implementation that polls the Cloudflare Radar API. Follows the patterns from src/platform/HttpFetcher.ts and src/platform/types.ts. Handles the radar:// URL scheme for use in CompositeFetcher chains.

**File:** src/platform/CloudflareRadarFetcher.ts

```typescript
import type { IContentFetcher } from './types.ts';
import type { ILogger } from '../types/index.ts';
import { silentLogger } from '../utils/logger.ts';

export interface IRadarDomainSignal {
    readonly domain: string;
    readonly categories: readonly string[];
    readonly rankPosition: number | null;
    readonly firstSeen: string; // ISO-8601
    readonly signalSource: 'radar_ranking' | 'radar_security' | 'radar_dns_top';
    readonly confidenceScore: number; // 0.0 to 1.0
}

export interface ICloudflareRadarFetcherOptions {
    readonly apiToken: string;
    readonly timeout?: number;
    readonly includeCategories?: readonly string[];
    readonly maxDomainsPerFetch?: number;
}

const RADAR_BASE_URL = 'https://api.cloudflare.com/client/v4/radar';

const DEFAULT_SECURITY_CATEGORIES: readonly string[] = [
    'Advertising',
    'Tracking & Telemetry',
    'Malware',
    'Phishing',
    'Botnet',
    'Command and Control & Botnet',
    'Compromised Domain',
    'Cryptomining',
    'DGA Domains',
    'DNS Tunneling',
    'Scam',
    'Potentially Unwanted Software',
];

/**
 * IContentFetcher implementation for the Cloudflare Radar API.
 * Handles the radar:// URL scheme for use in CompositeFetcher chains.
 *
 * @example
 * const fetcher = new CloudflareRadarFetcher({ apiToken: env.CF_RADAR_API_TOKEN }, logger);
 * const signals = await fetcher.fetchSignals();
 */
export class CloudflareRadarFetcher implements IContentFetcher {
    private readonly options: Required<ICloudflareRadarFetcherOptions>;
    private readonly logger: ILogger;

    constructor(options: ICloudflareRadarFetcherOptions, logger?: ILogger) {
        this.options = {
            timeout: 30_000,
            includeCategories: DEFAULT_SECURITY_CATEGORIES,
            maxDomainsPerFetch: 500,
            ...options,
        };
        this.logger = logger ?? silentLogger;
    }

    public canHandle(source: string): boolean {
        return source.startsWith('radar://');
    }

    public async fetch(source: string): Promise<string> {
        const signals = await this.fetchSignals();
        this.logger.debug(`CloudflareRadarFetcher: resolved ${signals.length} signals for source: ${source}`);
        return signals.map((s) => s.domain).join('\n');
    }

    public async fetchSignals(): Promise<readonly IRadarDomainSignal[]> {
        const [rankingResult, securityResult] = await Promise.allSettled([
            this.fetchRankingDomains(),
            this.fetchSecurityDomains(),
        ]);
        const all: IRadarDomainSignal[] = [];
        if (rankingResult.status === 'fulfilled') {
            all.push(...rankingResult.value);
        } else {
            this.logger.warn(`Radar ranking fetch failed: ${rankingResult.reason}`);
        }
        if (securityResult.status === 'fulfilled') {
            all.push(...securityResult.value);
        } else {
            this.logger.warn(`Radar security fetch failed: ${securityResult.reason}`);
        }
        return this.deduplicateByHighestConfidence(all);
    }

    private async fetchRankingDomains(): Promise<IRadarDomainSignal[]> {
        // TODO(@jaypatrick): Validate actual response shape against live Radar API
        const url = `${RADAR_BASE_URL}/ranking/domain?limit=${this.options.maxDomainsPerFetch}&format=json`;
        const data = await this.callRadarApi(url) as { result?: { top?: Array<{ domain: string; rank: number }> } };
        return (data?.result?.top ?? []).map((entry) => ({
            domain: entry.domain,
            categories: [],
            rankPosition: entry.rank,
            firstSeen: new Date().toISOString(),
            signalSource: 'radar_ranking' as const,
            confidenceScore: 0.4,
        }));
    }

    private async fetchSecurityDomains(): Promise<IRadarDomainSignal[]> {
        // TODO(@jaypatrick): Confirm correct Radar endpoint for domain-category lookup
        const url = `${RADAR_BASE_URL}/datasets?datasetType=DOMAIN_CATEGORIES&format=json`;
        const data = await this.callRadarApi(url) as { result?: { datasets?: Array<{ domain: string; category: string }> } };
        return (data?.result?.datasets ?? [])
            .filter((d) => this.options.includeCategories.includes(d.category))
            .map((d) => ({
                domain: d.domain,
                categories: [d.category],
                rankPosition: null,
                firstSeen: new Date().toISOString(),
                signalSource: 'radar_security' as const,
                confidenceScore: this.resolveConfidence(d.category),
            }));
    }

    private resolveConfidence(category: string): number {
        const HIGH = new Set(['Malware', 'Phishing', 'Command and Control & Botnet', 'Botnet', 'Compromised Domain', 'DGA Domains', 'DNS Tunneling']);
        const MEDIUM = new Set(['Scam', 'Cryptomining', 'Potentially Unwanted Software', 'Tracking & Telemetry']);
        if (HIGH.has(category)) { return 0.90; }
        if (MEDIUM.has(category)) { return 0.60; }
        return 0.40;
    }

    private async callRadarApi(url: string): Promise<unknown> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${this.options.apiToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error(`Radar API responded with ${response.status} ${response.statusText}`);
            }
            return await response.json() as unknown;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private deduplicateByHighestConfidence(signals: IRadarDomainSignal[]): IRadarDomainSignal[] {
        const seen = new Map<string, IRadarDomainSignal>();
        for (const signal of signals) {
            const existing = seen.get(signal.domain);
            if (!existing || signal.confidenceScore > existing.confidenceScore) {
                seen.set(signal.domain, signal);
            }
        }
        return Array.from(seen.values());
    }
}
```

### 4.2 Ingestion Cron Worker

**File:** worker/handlers/threat-intel.ts

```typescript
import type { Env } from '../types.ts';
import type { ILogger } from '../../src/types/index.ts';
import { CloudflareRadarFetcher } from '../../src/platform/CloudflareRadarFetcher.ts';
import { JsonResponse } from '../utils/response.ts';
import { AnalyticsService } from '../../src/services/AnalyticsService.ts';

/**
 * Scheduled handler — poll Cloudflare Radar and ingest domain signals.
 * Cron: "*/15 * * * *"
 */
export async function handleThreatIntelIngestion(env: Env, logger: ILogger): Promise<void> {
    const analytics = new AnalyticsService(env.ANALYTICS_ENGINE, logger);
    const fetcher = new CloudflareRadarFetcher({ apiToken: env.CF_RADAR_API_TOKEN }, logger);

    const signals = await fetcher.fetchSignals();
    logger.info(`Fetched ${signals.length} domain signals from Cloudflare Radar`);

    let inserted = 0;
    let queuedForRuleGen = 0;

    for (const signal of signals) {
        await env.DB.prepare(
            `INSERT INTO threat_signals (domain, categories, rank_position, first_seen, signal_source, confidence_score, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, unixepoch())
             ON CONFLICT(domain) DO UPDATE SET
               categories        = excluded.categories,
               confidence_score  = MAX(confidence_score, excluded.confidence_score),
               updated_at        = unixepoch()`,
        ).bind(
            signal.domain,
            JSON.stringify(signal.categories),
            signal.rankPosition,
            signal.firstSeen,
            signal.signalSource,
            signal.confidenceScore,
        ).run();
        inserted++;

        if (signal.confidenceScore >= 0.80 && env.THREAT_INTEL_QUEUE) {
            await env.THREAT_INTEL_QUEUE.send({
                type: 'generate_rule',
                domain: signal.domain,
                categories: signal.categories,
                confidenceScore: signal.confidenceScore,
                timestamp: Date.now(),
            });
            queuedForRuleGen++;
        }
    }

    await analytics.trackEvent('threat_intel_ingestion', {
        signalCount: signals.length,
        insertedCount: inserted,
        queuedForRuleGen,
    });

    logger.info(`Ingestion complete: ${inserted} upserted, ${queuedForRuleGen} queued for rule generation`);
}

/**
 * POST /api/threat-intel/ingest — manual trigger, requires admin auth.
 */
export async function handleManualIngest(_request: Request, env: Env, logger: ILogger): Promise<Response> {
    await handleThreatIntelIngestion(env, logger);
    return JsonResponse.success({ message: 'Ingestion triggered successfully' });
}

/**
 * GET /api/threat-intel/signals — paginated signal query, requires Clerk auth.
 */
export async function handleGetSignals(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') ?? '0');
    const minConfidence = parseFloat(url.searchParams.get('minConfidence') ?? '0.5');
    const category = url.searchParams.get('category');

    const bindings: unknown[] = [minConfidence];
    let query = `SELECT domain, categories, rank_position, confidence_score, signal_source, first_seen, updated_at
                 FROM threat_signals WHERE confidence_score >= ?1`;

    if (category) {
        query += ` AND categories LIKE ?${bindings.length + 1}`;
        bindings.push(`%${category}%`);
    }

    query += ` ORDER BY confidence_score DESC, updated_at DESC LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`;
    bindings.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...bindings).all();
    return JsonResponse.success({ signals: result.results, limit, offset });
}
```

### 4.3 Signal Scoring Pipeline

Confidence scores are deterministic — no ML required in Phase 1.

| Signal Origin | Base Score | Modifiers |
|--------------|-----------|-----------|
| Radar: Malware / Phishing / C2+Botnet / Compromised / DGA / DNS Tunneling | 0.90 | +0.05 if also in a blocklist diff |
| Radar: Scam / Cryptomining / PUP / Tracking and Telemetry | 0.60 | +0.10 if newly registered (Phase 2 CT log) |
| Radar: Advertising | 0.40 | +0.15 if matches known ad-network TLD/subdomain patterns |
| Radar: Trending only (ranking, no security category) | 0.30 | No modifier |
| Blocklist diff — new addition to 3+ major lists | 0.85 | — |
| Blocklist diff — new addition to 1-2 lists | 0.65 | — |
| Community report (Phase 2) | 0.50 | Scales with corroboration count |

**Threshold actions:**

| Score Range | Action |
|-------------|--------|
| >= 0.80 | Queued immediately to THREAT_INTEL_QUEUE for rule generation |
| 0.50 – 0.79 | Stored in D1; included in next scheduled batch rule generation |
| < 0.50 | Stored in D1 for analytics only; excluded from generated lists |

### 4.4 D1 Schema

New migration file: prisma/migrations/0010_threat_intel.sql

```sql
CREATE TABLE IF NOT EXISTS threat_signals (
    id               TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    domain           TEXT    NOT NULL UNIQUE,
    categories       TEXT    NOT NULL DEFAULT '[]',
    rank_position    INTEGER,
    first_seen       TEXT    NOT NULL,
    signal_source    TEXT    NOT NULL,
    confidence_score REAL    NOT NULL DEFAULT 0.0,
    rule_generated   INTEGER NOT NULL DEFAULT 0,
    rule_id          TEXT,
    updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_ts_confidence ON threat_signals(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_ts_updated    ON threat_signals(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ts_source     ON threat_signals(signal_source);
CREATE INDEX IF NOT EXISTS idx_ts_rule_gen   ON threat_signals(rule_generated);

CREATE TABLE IF NOT EXISTS generated_rules (
    id               TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    domain           TEXT    NOT NULL,
    rule_adguard     TEXT,
    rule_ublock      TEXT,
    rule_hosts       TEXT,
    rule_rpz         TEXT,
    confidence_score REAL    NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'pending',
    reviewed_by      TEXT,
    reviewed_at      INTEGER,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_gr_status ON generated_rules(status);
CREATE INDEX IF NOT EXISTS idx_gr_domain ON generated_rules(domain);
```

### 4.5 Queue Message Flow

```
CloudflareRadarFetcher (cron every 15 min OR manual POST)
    |
    v
handleThreatIntelIngestion()
    | -- upsert all signals to D1 threat_signals
    |
    | [confidenceScore >= 0.80]
    v
THREAT_INTEL_QUEUE.send(IThreatIntelQueueMessage)
    |
    v
handleThreatIntelQueue()  <-- Cloudflare Queue consumer
    |
    +-- Build AGTree AST block-rule node for domain
    +-- Emit: AdGuard, uBlock, hosts, RPZ formats via TranslatorPlugin chain
    +-- Write to generated_rules (status='approved' if score >= 0.95, else 'pending')
    +-- Flush approved rules to R2 as compiled list fragments
```

New type to add in worker/types.ts:

```typescript
export interface IThreatIntelQueueMessage {
    readonly type: 'generate_rule';
    readonly domain: string;
    readonly categories: readonly string[];
    readonly confidenceScore: number;
    readonly timestamp: number;
}
```

### 4.6 wrangler.toml Additions

```toml
[[queues.producers]]
binding = "THREAT_INTEL_QUEUE"
queue   = "adblock-compiler-threat-intel"

[[queues.consumers]]
queue             = "adblock-compiler-threat-intel"
max_batch_size    = 50
max_batch_timeout = 60
```

Add to [triggers] crons array: "*/15 * * * *"

Add CF_RADAR_API_TOKEN to .env.example and set via: wrangler secret put CF_RADAR_API_TOKEN
NEVER add it to wrangler.toml [vars].

---

## 5. MCP Server — Interface Design

All new agent-addressable capabilities are registered through the existing routeAgentRequest / PlaywrightMcpAgent layer in worker/worker.ts. Per copilot instructions, never bypass or duplicate this layer.

### 5.1 MCP Tool Definitions

#### Tool: query_threat_domains

Query the real-time threat/ad/tracker domain database.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| categories | string[] | No | Filter by Radar security category (e.g. ["Malware","Phishing"]) |
| minConfidence | number | No | Minimum confidence score 0.0-1.0. Default: 0.5 |
| limit | number | No | Max results to return. Default: 100, max: 500 |
| offset | number | No | Pagination offset |
| since | string | No | ISO-8601 — only return signals updated after this time |

Returns: Array of IRadarDomainSignal with domain, categories, confidenceScore, signalSource, firstSeen.

---

#### Tool: get_generated_rules

Retrieve generated blocklist rules for one or more domains in a specific format.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| domains | string[] | No | Specific domains to look up |
| format | string | Yes | One of: adguard, ublock, hosts, rpz |
| status | string | No | One of: pending, approved, rejected. Default: approved |
| limit | number | No | Default: 100, max: 1000 |

Returns: Array of rules in requested format, with domain and confidence score.

---

#### Tool: get_list_snapshot

Get a full compiled snapshot of the current real-time threat intelligence list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | Yes | One of: adguard, ublock, hosts, rpz |
| minConfidence | number | No | Default: 0.8 (only high-confidence rules in snapshots) |

Returns: Presigned R2 URL to the compiled list file, plus metadata (rule count, generated_at, format).

---

#### Tool: report_domain

Submit a domain for threat intelligence review (Phase 2 community signal).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| domain | string | Yes | Domain to report |
| reason | string | Yes | Human-readable reason for report |
| category | string | No | Suggested category from the Radar taxonomy |

Returns: Confirmation with assigned signal ID and initial confidence score.

---

#### Tool: get_ingestion_status

Get the current status of the threat intelligence ingestion pipeline.

Returns: Last run timestamp, signal counts by source and category, queue depth, next scheduled run.

### 5.2 Worker Routes

New routes to add in worker/router.ts:

| Method | Pattern | Handler | Middleware |
|--------|---------|---------|------------|
| GET | /api/threat-intel/signals | handleGetSignals | rateLimit, requireAuth |
| POST | /api/threat-intel/ingest | handleManualIngest | requireAuth (admin) |
| GET | /api/threat-intel/rules | handleGetGeneratedRules | rateLimit, requireAuth |
| GET | /api/threat-intel/snapshot/:format | handleGetListSnapshot | rateLimit, requireAuth |
| GET | /api/threat-intel/status | handleIngestionStatus | requireAuth |
| POST | /api/threat-intel/report | handleReportDomain | rateLimit, requireAuth, turnstile |

### 5.3 Handler Sketches

```typescript
// worker/handlers/threat-intel.ts (additions)

/**
 * GET /api/threat-intel/rules
 */
export async function handleGetGeneratedRules(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') ?? 'adguard';
    const status = url.searchParams.get('status') ?? 'approved';
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 1000);
    const offset = parseInt(url.searchParams.get('offset') ?? '0');

    const validFormats = ['adguard', 'ublock', 'hosts', 'rpz'] as const;
    type RuleFormat = typeof validFormats[number];
    if (!validFormats.includes(format as RuleFormat)) {
        return JsonResponse.error('Invalid format. Must be one of: adguard, ublock, hosts, rpz', 400);
    }

    const col = `rule_${format}` as `rule_${RuleFormat}`;
    const result = await env.DB.prepare(
        `SELECT domain, ${col} AS rule, confidence_score, status, created_at
         FROM generated_rules
         WHERE status = ?1 AND ${col} IS NOT NULL
         ORDER BY confidence_score DESC
         LIMIT ?2 OFFSET ?3`,
    ).bind(status, limit, offset).all();

    return JsonResponse.success({ rules: result.results, format, limit, offset });
}

/**
 * GET /api/threat-intel/snapshot/:format
 * Streams the compiled list from R2, or returns a presigned URL.
 */
export async function handleGetListSnapshot(
    _request: Request,
    env: Env,
    params: { pathParams: Record<string, string> },
): Promise<Response> {
    const format = params.pathParams['format'];
    const key = `threat-intel/snapshots/latest-${format}.txt`;
    const obj = await env.FILTER_STORAGE.get(key);

    if (!obj) {
        return JsonResponse.error(`No snapshot available for format: ${format}`, 404);
    }

    return new Response(obj.body, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=900',
            'X-Threat-Intel-Format': format,
        },
    });
}

/**
 * GET /api/threat-intel/status
 */
export async function handleIngestionStatus(_request: Request, env: Env): Promise<Response> {
    const [totalResult, bySourceResult, queuedResult] = await Promise.all([
        env.DB.prepare('SELECT COUNT(*) AS total FROM threat_signals').first<{ total: number }>(),
        env.DB.prepare(
            'SELECT signal_source, COUNT(*) AS count, AVG(confidence_score) AS avg_confidence FROM threat_signals GROUP BY signal_source',
        ).all(),
        env.DB.prepare('SELECT COUNT(*) AS total FROM generated_rules WHERE status = ?1').bind('pending').first<{ total: number }>(),
    ]);

    return JsonResponse.success({
        totalSignals: totalResult?.total ?? 0,
        pendingRuleReview: queuedResult?.total ?? 0,
        bySource: bySourceResult.results,
    });
}
```typescript

### 5.4 Authentication and Tier Gating

| Tier | query_threat_domains | get_generated_rules | get_list_snapshot | report_domain | get_ingestion_status |
|------|---------------------|--------------------|--------------------|---------------|---------------------|
| Unauthenticated | No | No | No | No | No |
| Free (Clerk JWT) | Yes, limit 100/day | Yes, approved only | Yes, adguard format only | Yes | No |
| Pro | Yes, limit 10k/day | Yes, all statuses | Yes, all formats | Yes | Yes |
| Enterprise | Unlimited | Unlimited | Unlimited + webhook push | Yes | Yes |
| Admin | Unlimited | Unlimited | Unlimited | Yes | Yes + manual trigger |

Tier gating is enforced in worker/middleware/auth.ts using the existing Clerk JWT pattern.

### 5.5 Registration in agent-routing.ts

```typescript
// worker/agent-routing.ts — add to the MCP tool registry

import {
    handleGetGeneratedRules,
    handleGetSignals,
    handleGetListSnapshot,
    handleIngestionStatus,
    handleReportDomain,
} from './handlers/threat-intel.ts';

// Add these entries to the existing tool registry object:

{
    name: 'query_threat_domains',
    description: 'Query the real-time threat/ad/tracker domain intelligence database.',
    inputSchema: {
        type: 'object',
        properties: {
            categories: { type: 'array', items: { type: 'string' } },
            minConfidence: { type: 'number', minimum: 0, maximum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 500 },
            offset: { type: 'integer', minimum: 0 },
            since: { type: 'string', format: 'date-time' },
        },
    },
    handler: (request: Request, env: Env) => handleGetSignals(request, env),
},
{
    name: 'get_generated_rules',
    description: 'Retrieve generated blocklist rules for domains in a specific syntax format.',
    inputSchema: {
        type: 'object',
        required: ['format'],
        properties: {
            domains: { type: 'array', items: { type: 'string' } },
            format: { type: 'string', enum: ['adguard', 'ublock', 'hosts', 'rpz'] },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
            limit: { type: 'integer', minimum: 1, maximum: 1000 },
        },
    },
    handler: (request: Request, env: Env) => handleGetGeneratedRules(request, env),
},
{
    name: 'get_list_snapshot',
    description: 'Get the latest compiled real-time threat intelligence blocklist in a specified format.',
    inputSchema: {
        type: 'object',
        required: ['format'],
        properties: {
            format: { type: 'string', enum: ['adguard', 'ublock', 'hosts', 'rpz'] },
            minConfidence: { type: 'number', minimum: 0, maximum: 1 },
        },
    },
    handler: (request: Request, env: Env, params: unknown) => handleGetListSnapshot(request, env, params as { pathParams: Record<string, string> }),
},
{
    name: 'get_ingestion_status',
    description: 'Get current status of the threat intelligence ingestion pipeline.',
    inputSchema: { type: 'object', properties: {} },
    handler: (request: Request, env: Env) => handleIngestionStatus(request, env),
},
```

---

## 6. Rule Generation Pipeline

High-confidence signals in the queue are processed by a new queue consumer in worker/handlers/queue.ts (following the existing processCompileMessage pattern):

```typescript
// Additions to worker/handlers/queue.ts

import type { IThreatIntelQueueMessage } from '../types.ts';
import { AGTree } from '../../src/utils/AGTreeUtils.ts'; // TODO(@jaypatrick): confirm import path

export async function processThreatIntelMessage(
    message: IThreatIntelQueueMessage,
    env: Env,
    logger: ILogger,
): Promise<void> {
    const { domain, categories, confidenceScore } = message;

    // Build AGTree AST node for a DNS block rule
    const ruleAdguard = `||${domain}^`;
    const ruleUblock = `||${domain}^`;
    const ruleHosts = `0.0.0.0 ${domain}`;
    const ruleRpz = `${domain} CNAME .`;

    const autoApprove = confidenceScore >= 0.95;

    await env.DB.prepare(
        `INSERT INTO generated_rules (domain, rule_adguard, rule_ublock, rule_hosts, rule_rpz, confidence_score, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(rowid) DO NOTHING`,
    ).bind(domain, ruleAdguard, ruleUblock, ruleHosts, ruleRpz, confidenceScore, autoApprove ? 'approved' : 'pending').run();

    logger.info(`Rule generated for ${domain} (confidence: ${confidenceScore}, status: ${autoApprove ? 'approved' : 'pending'})`);

    // Update threat_signals to mark rule as generated
    await env.DB.prepare(
        'UPDATE threat_signals SET rule_generated = 1 WHERE domain = ?1',
    ).bind(domain).run();

    // If auto-approved, flush approved rules snapshot to R2
    if (autoApprove) {
        await flushApprovedRulesToR2(env, logger);
    }
}

async function flushApprovedRulesToR2(env: Env, logger: ILogger): Promise<void> {
    const formats = ['adguard', 'ublock', 'hosts', 'rpz'] as const;
    for (const format of formats) {
        const col = `rule_${format}`;
        const result = await env.DB.prepare(
            `SELECT ${col} AS rule FROM generated_rules WHERE status = 'approved' AND ${col} IS NOT NULL ORDER BY confidence_score DESC`,
        ).all<{ rule: string }>();

        const content = result.results.map((r) => r.rule).join('\n');
        await env.FILTER_STORAGE.put(
            `threat-intel/snapshots/latest-${format}.txt`,
            content,
            { httpMetadata: { contentType: 'text/plain' } },
        );
    }
    logger.info('Flushed approved rules to R2 snapshots');
}
```

---

## 7. Distribution Layer

Once rules are in R2 snapshots, distribution happens via:

1. **Direct R2 URL** — providers can fetch the list over HTTPS. URLs are stable and cache-friendly (15-min max-age).
2. **Provider-specific format endpoints** — /api/threat-intel/snapshot/adguard, /snapshot/hosts, /snapshot/rpz, /snapshot/ublock.
3. **Webhooks (Phase 2)** — POST to subscriber URLs when snapshot is updated (use Cloudflare Queues).
4. **Subscription API (Phase 2)** — POST /api/subscriptions — providers register their endpoint and preferred format/frequency.

**Suggested list names for provider submissions:**

| Provider | Format | Submission URL |
|----------|--------|----------------|
| AdGuard Home | adguard | https://adguard-dns.io/kb/general/dns-filtering-syntax/ |
| NextDNS | hosts or adguard | https://nextdns.io/help/adding-custom-list |
| Pi-hole | hosts | https://discourse.pi-hole.net |
| ControlD | adguard | https://controld.com/docs |
| RPZ resolvers | rpz | Standard DNS RPZ zone transfer |

---

## 8. Prisma Schema Changes

Add the following models to prisma/schema.prisma (D1/SQLite adapter):

```prisma
model ThreatSignal {
  id              String   @id @default(cuid())
  domain          String   @unique
  categories      String   @default("[]")   // JSON string[]
  rankPosition    Int?
  firstSeen       String
  signalSource    String
  confidenceScore Float    @default(0.0)
  ruleGenerated   Boolean  @default(false)
  ruleId          String?
  updatedAt       DateTime @updatedAt
  createdAt       DateTime @default(now())

  @@index([confidenceScore])
  @@index([updatedAt])
  @@index([signalSource])
  @@map("threat_signals")
}

model GeneratedRule {
  id              String   @id @default(cuid())
  domain          String
  ruleAdguard     String?
  ruleUblock      String?
  ruleHosts       String?
  ruleRpz         String?
  confidenceScore Float
  status          String   @default("pending")
  reviewedBy      String?
  reviewedAt      DateTime?
  createdAt       DateTime @default(now())

  @@index([status])
  @@index([domain])
  @@map("generated_rules")
}
```

After changes: run deno task db:generate then deno task db:migrate.

---

## 9. Implementation Phases

### Phase 1 — Foundation (Target: next sprint)

- [ ] Implement CloudflareRadarFetcher (src/platform/CloudflareRadarFetcher.ts)
- [ ] Add CloudflareRadarFetcher.test.ts with mock Radar API responses
- [ ] Create worker/handlers/threat-intel.ts with handleThreatIntelIngestion, handleManualIngest, handleGetSignals
- [ ] D1 migration 0010_threat_intel.sql
- [ ] Add Prisma schema models ThreatSignal and GeneratedRule
- [ ] Register new routes in worker/router.ts
- [ ] Add THREAT_INTEL_QUEUE producer/consumer to wrangler.toml
- [ ] Add "*/15 * * * *" cron to wrangler.toml [triggers]
- [ ] Add CF_RADAR_API_TOKEN to .env.example
- [ ] Run deno task schema:generate after new routes
- [ ] Run deno task preflight:full before PR

### Phase 2 — MCP Surface (Target: following sprint)

- [ ] Register all 5 MCP tools in worker/agent-routing.ts
- [ ] Implement handleGetGeneratedRules, handleGetListSnapshot, handleIngestionStatus, handleReportDomain
- [ ] Implement processThreatIntelMessage queue consumer in worker/handlers/queue.ts
- [ ] Implement flushApprovedRulesToR2
- [ ] Implement tier gating in worker/middleware/auth.ts for threat-intel routes
- [ ] Add E2E tests for MCP tool endpoints
- [ ] Update OpenAPI spec and run deno task openapi:validate

### Phase 3 — Distribution and Growth (Target: post-beta)

- [ ] Webhook subscription system (POST /api/subscriptions)
- [ ] Certificate Transparency log fetcher
- [ ] URLhaus / PhishTank feed fetcher
- [ ] Community report endpoint (POST /api/threat-intel/report) with Turnstile protection
- [ ] Provider outreach (AdGuard, NextDNS, Pi-hole)
- [ ] Analytics dashboard for signal/rule metrics in the Angular frontend
- [ ] RPZ zone file server (DNS AXFR)

---

## 10. Open Questions and Decisions

| ID | Question | Status | Decision |
|----|----------|--------|----------|
| OQ-1 | What is the exact Cloudflare Radar API endpoint for domain-category lookup? The /radar/datasets?datasetType=DOMAIN_CATEGORIES path needs to be verified against the live API before writing production code. | OPEN | Verify at https://developers.cloudflare.com/api/operations/radar-get-datasets |
| OQ-2 | Should the radar:// scheme be registered as a first-class source type in IConfiguration, or handled entirely outside the existing compiler pipeline? | OPEN | Lean toward separate ingestion pathway to avoid polluting the blocklist compilation pipeline |
| OQ-3 | How do we handle the THREAT_INTEL_QUEUE consumer in the existing handleQueue dispatch in worker/handlers/queue.ts? Union type extension vs. separate consumer handler? | OPEN | Prefer extending the QueueMessage union type to keep dispatch centralised |
| OQ-4 | What is the right auto-approve threshold? Currently proposed at 0.95. Too aggressive? | OPEN | Needs review |
| OQ-5 | RPZ zone file serving — serve as a plain text file from R2, or implement a real DNS AXFR endpoint? | OPEN | R2 plain-text for Phase 1; AXFR is a Phase 3 stretch goal |
| OQ-6 | Pricing model for provider API subscriptions? Flat monthly fee, per-domain query, or tiered by update frequency? | OPEN | @jaypatrick to decide |
| OQ-7 | Should generated_rules require a human review step for scores 0.80-0.94, or is a time-delay auto-approve sufficient? | OPEN | Recommend human review queue with 24h fallback auto-approve |

---

## 11. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-03-14 | @jaypatrick | Initial draft — ingestion layer and MCP interface design |