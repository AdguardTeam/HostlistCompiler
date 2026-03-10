/**
 * Handlers for rule set management endpoints:
 *   POST   /api/rules            – create a new rule set
 *   GET    /api/rules            – list all saved rule sets (metadata only)
 *   GET    /api/rules/{id}       – retrieve a specific rule set
 *   PUT    /api/rules/{id}       – update a rule set
 *   DELETE /api/rules/{id}       – delete a rule set
 *
 * Rule sets are persisted in the RULES_KV namespace (or COMPILATION_CACHE when
 * RULES_KV is not bound) using the key prefix "rules:".
 *
 * Listing is derived from kv.list() with the rules prefix to avoid the
 * read-modify-write race condition of a centralised index.
 */

import { type RuleSet, RuleSetCreateSchema, RuleSetUpdateSchema } from '../schemas.ts';
import { JsonResponse } from '../utils/response.ts';
import type { Env } from '../types.ts';

const RULES_PREFIX = 'rules:';
const MAX_LIST_RESULTS = 100;

/** Returns the KV namespace to use for rule sets, falling back to COMPILATION_CACHE. */
function getRulesKv(env: Env): KVNamespace {
    return env.RULES_KV ?? env.COMPILATION_CACHE;
}

function generateId(): string {
    // Produce a UUID v4-compatible identifier using the Web Crypto API.
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ============================================================================
// POST /api/rules
// ============================================================================

export async function handleRulesCreate(request: Request, env: Env): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return JsonResponse.badRequest('Invalid JSON body');
    }

    const parsed = RuleSetCreateSchema.safeParse(body);
    if (!parsed.success) {
        return JsonResponse.error(parsed.error.issues.map((i) => i.message).join('; '), 422);
    }

    const { name, description, rules, tags } = parsed.data;
    const id = generateId();
    const now = new Date().toISOString();

    const ruleSet: RuleSet = {
        id,
        name,
        description,
        rules,
        ruleCount: rules.length,
        tags,
        createdAt: now,
        updatedAt: now,
    };

    const kv = getRulesKv(env);
    await kv.put(`${RULES_PREFIX}${id}`, JSON.stringify(ruleSet));

    return JsonResponse.success({ data: ruleSet }, { status: 201 });
}

// ============================================================================
// GET /api/rules
// ============================================================================

/** Maximum total rule sets to enumerate when computing the list total. */
const MAX_TOTAL_RULES = 1_000;

export async function handleRulesList(_request: Request, env: Env): Promise<Response> {
    const kv = getRulesKv(env);

    // Paginate through all keys to obtain an accurate total count, then
    // fetch full metadata only for the first MAX_LIST_RESULTS items.
    // This avoids the read-modify-write race condition of a centralised index
    // while still reporting an accurate (or near-accurate) total.
    const allKeys: string[] = [];
    let cursor: string | undefined;
    let listComplete = false;

    while (!listComplete && allKeys.length < MAX_TOTAL_RULES) {
        const page = await kv.list({ prefix: RULES_PREFIX, limit: 100, ...(cursor ? { cursor } : {}) });
        allKeys.push(...page.keys.map((k) => k.name));
        listComplete = page.list_complete;
        cursor = page.list_complete ? undefined : page.cursor;
    }

    const total = allKeys.length;
    const pageKeys = allKeys.slice(0, MAX_LIST_RESULTS);
    const items: Array<Omit<RuleSet, 'rules'> & { ruleCount: number }> = [];

    await Promise.all(
        pageKeys.map(async (key) => {
            const raw = await kv.get<RuleSet>(key, 'json');
            if (raw) {
                // Return metadata without the full rules array for list responses.
                const { rules: _rules, ...meta } = raw;
                items.push(meta);
            }
        }),
    );

    // Sort by creation date, newest first.
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return JsonResponse.success({ items, total });
}

// ============================================================================
// GET /api/rules/{id}
// ============================================================================

export async function handleRulesGet(id: string, env: Env): Promise<Response> {
    const kv = getRulesKv(env);
    const ruleSet = await kv.get<RuleSet>(`${RULES_PREFIX}${id}`, 'json');

    if (!ruleSet) {
        return JsonResponse.notFound('Rule set not found');
    }

    return JsonResponse.success({ data: ruleSet });
}

// ============================================================================
// PUT /api/rules/{id}
// ============================================================================

export async function handleRulesUpdate(id: string, request: Request, env: Env): Promise<Response> {
    const kv = getRulesKv(env);
    const existing = await kv.get<RuleSet>(`${RULES_PREFIX}${id}`, 'json');

    if (!existing) {
        return JsonResponse.notFound('Rule set not found');
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return JsonResponse.badRequest('Invalid JSON body');
    }

    const parsed = RuleSetUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return JsonResponse.error(parsed.error.issues.map((i) => i.message).join('; '), 422);
    }

    const patch = parsed.data;
    const updatedRules = patch.rules ?? existing.rules;
    const updated: RuleSet = {
        ...existing,
        ...patch,
        rules: updatedRules,
        ruleCount: updatedRules.length,
        updatedAt: new Date().toISOString(),
    };

    await kv.put(`${RULES_PREFIX}${id}`, JSON.stringify(updated));

    return JsonResponse.success({ data: updated });
}

// ============================================================================
// DELETE /api/rules/{id}
// ============================================================================

export async function handleRulesDelete(id: string, env: Env): Promise<Response> {
    const kv = getRulesKv(env);
    const existing = await kv.get(`${RULES_PREFIX}${id}`);

    if (!existing) {
        return JsonResponse.notFound('Rule set not found');
    }

    await kv.delete(`${RULES_PREFIX}${id}`);

    return JsonResponse.success({ message: `Rule set '${id}' deleted` });
}
