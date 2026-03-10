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
 */

import { type RuleSet, RuleSetCreateSchema, RuleSetUpdateSchema } from '../schemas.ts';
import type { Env } from '../types.ts';

const RULES_PREFIX = 'rules:';
const RULES_INDEX_KEY = 'rules:__index__';
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

async function getIndex(kv: KVNamespace): Promise<string[]> {
    const raw = await kv.get(RULES_INDEX_KEY, 'json') as string[] | null;
    return raw ?? [];
}

async function saveIndex(kv: KVNamespace, ids: string[]): Promise<void> {
    await kv.put(RULES_INDEX_KEY, JSON.stringify(ids));
}

// ============================================================================
// POST /api/rules
// ============================================================================

export async function handleRulesCreate(request: Request, env: Env): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: cors() });
    }

    const parsed = RuleSetCreateSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json(
            { success: false, error: parsed.error.issues.map((i) => i.message).join('; ') },
            { status: 422, headers: cors() },
        );
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

    const index = await getIndex(kv);
    await saveIndex(kv, [...index, id]);

    return Response.json({ success: true, data: ruleSet }, { status: 201, headers: cors() });
}

// ============================================================================
// GET /api/rules
// ============================================================================

export async function handleRulesList(_request: Request, env: Env): Promise<Response> {
    const kv = getRulesKv(env);
    const index = await getIndex(kv);

    const limited = index.slice(0, MAX_LIST_RESULTS);
    const items: Array<Omit<RuleSet, 'rules'> & { ruleCount: number }> = [];

    await Promise.all(
        limited.map(async (id) => {
            const raw = await kv.get<RuleSet>(`${RULES_PREFIX}${id}`, 'json');
            if (raw) {
                // Return metadata without the full rules array for list responses.
                const { rules: _rules, ...meta } = raw;
                items.push(meta);
            }
        }),
    );

    // Sort by creation date, newest first.
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return Response.json(
        { success: true, items, total: index.length },
        { headers: cors() },
    );
}

// ============================================================================
// GET /api/rules/{id}
// ============================================================================

export async function handleRulesGet(id: string, env: Env): Promise<Response> {
    const kv = getRulesKv(env);
    const ruleSet = await kv.get<RuleSet>(`${RULES_PREFIX}${id}`, 'json');

    if (!ruleSet) {
        return Response.json({ success: false, error: 'Rule set not found' }, { status: 404, headers: cors() });
    }

    return Response.json({ success: true, data: ruleSet }, { headers: cors() });
}

// ============================================================================
// PUT /api/rules/{id}
// ============================================================================

export async function handleRulesUpdate(id: string, request: Request, env: Env): Promise<Response> {
    const kv = getRulesKv(env);
    const existing = await kv.get<RuleSet>(`${RULES_PREFIX}${id}`, 'json');

    if (!existing) {
        return Response.json({ success: false, error: 'Rule set not found' }, { status: 404, headers: cors() });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: cors() });
    }

    const parsed = RuleSetUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json(
            { success: false, error: parsed.error.issues.map((i) => i.message).join('; ') },
            { status: 422, headers: cors() },
        );
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

    return Response.json({ success: true, data: updated }, { headers: cors() });
}

// ============================================================================
// DELETE /api/rules/{id}
// ============================================================================

export async function handleRulesDelete(id: string, env: Env): Promise<Response> {
    const kv = getRulesKv(env);
    const existing = await kv.get(`${RULES_PREFIX}${id}`);

    if (!existing) {
        return Response.json({ success: false, error: 'Rule set not found' }, { status: 404, headers: cors() });
    }

    await kv.delete(`${RULES_PREFIX}${id}`);

    const index = await getIndex(kv);
    await saveIndex(kv, index.filter((i) => i !== id));

    return Response.json({ success: true, message: `Rule set '${id}' deleted` }, { headers: cors() });
}

// ============================================================================
// Helpers
// ============================================================================

function cors(): Record<string, string> {
    return { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
}
