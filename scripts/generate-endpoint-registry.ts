#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Endpoint Registry Generator
 *
 * Auto-generates a JSON endpoint registry from the canonical OpenAPI
 * specification (docs/api/openapi.yaml).  The resulting file is consumed
 * by the Angular admin UI to display all API endpoints together with their
 * authentication requirements, parameter counts, and tags.
 *
 * Run: deno task generate:endpoints
 * Output: frontend/src/assets/endpoint-registry.json
 */

import { parse } from '@std/yaml';
import { existsSync } from '@std/fs';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const OPENAPI_PATH = './docs/api/openapi.yaml';
const REGISTRY_OUTPUT_PATH = './frontend/src/assets/endpoint-registry.json';

// ---------------------------------------------------------------------------
// OpenAPI type stubs (only the fields we actually read)
// ---------------------------------------------------------------------------

interface OAInfo {
    title: string;
    description?: string;
    version: string;
}

interface OAOperation {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    security?: Array<Record<string, unknown>>;
    requestBody?: { required?: boolean; content?: Record<string, unknown> };
    parameters?: Array<{
        name: string;
        in: string;
        required?: boolean;
        schema?: Record<string, unknown>;
        description?: string;
    }>;
    responses?: Record<string, unknown>;
}

interface OAPathItem {
    get?: OAOperation;
    post?: OAOperation;
    put?: OAOperation;
    patch?: OAOperation;
    delete?: OAOperation;
    options?: OAOperation;
    head?: OAOperation;
    trace?: OAOperation;
}

interface OATag {
    name: string;
    description?: string;
}

interface OASpec {
    openapi: string;
    info: OAInfo;
    tags?: OATag[];
    paths: Record<string, OAPathItem>;
    security?: Array<Record<string, unknown>>;
    components?: {
        securitySchemes?: Record<string, { type: string; in?: string; name?: string; description?: string }>;
        [key: string]: unknown;
    };
}

// ---------------------------------------------------------------------------
// Registry types (output)
// ---------------------------------------------------------------------------

interface EndpointEntry {
    path: string;
    method: string;
    operationId: string;
    summary: string;
    description: string;
    tags: string[];
    security: string[];
    parameterCount: number;
    hasRequestBody: boolean;
}

interface TagEntry {
    name: string;
    description: string;
}

interface EndpointRegistry {
    generatedAt: string;
    specVersion: string;
    endpoints: EndpointEntry[];
    tags: TagEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const MAX_DESCRIPTION_LENGTH = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a description to `MAX_DESCRIPTION_LENGTH` characters, appending an
 * ellipsis when the text is trimmed.  Also normalises multi-line descriptions
 * down to a single line.
 */
function truncateDescription(raw: string | undefined): string {
    if (!raw) return '';
    const single = raw.replace(/\s+/g, ' ').trim();
    if (single.length <= MAX_DESCRIPTION_LENGTH) return single;
    return single.slice(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
}

/**
 * Extract the security scheme names that apply to an operation.
 *
 * Resolution order (mirrors the OpenAPI 3.0.3 spec):
 *  1. Operation-level `security` overrides everything.
 *  2. If the operation does **not** declare `security`, the global `security`
 *     block applies.
 *  3. An explicit empty array `security: []` means "no auth required".
 */
function resolveSecuritySchemes(operation: OAOperation, globalSecurity: Array<Record<string, unknown>> | undefined): string[] {
    const securityBlock = operation.security ?? globalSecurity;
    if (!securityBlock || securityBlock.length === 0) return [];
    const schemes = new Set<string>();
    for (const requirement of securityBlock) {
        for (const name of Object.keys(requirement)) {
            schemes.add(name);
        }
    }
    return [...schemes].sort();
}

/**
 * Build an `EndpointEntry` from a path + method + operation.
 */
function buildEndpointEntry(
    path: string,
    method: HttpMethod,
    operation: OAOperation,
    globalSecurity: Array<Record<string, unknown>> | undefined,
): EndpointEntry {
    return {
        path,
        method: method.toUpperCase(),
        operationId: operation.operationId ?? '',
        summary: operation.summary ?? '',
        description: truncateDescription(operation.description),
        tags: operation.tags ?? [],
        security: resolveSecuritySchemes(operation, globalSecurity),
        parameterCount: operation.parameters?.length ?? 0,
        hasRequestBody: operation.requestBody != null,
    };
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

async function generateEndpointRegistry(): Promise<void> {
    console.log('🚀 Generating endpoint registry from OpenAPI spec...\n');

    // --- Read & parse ---
    if (!existsSync(OPENAPI_PATH)) {
        console.error(`❌ OpenAPI file not found: ${OPENAPI_PATH}`);
        Deno.exit(1);
    }

    let spec: OASpec;
    try {
        const content = await Deno.readTextFile(OPENAPI_PATH);
        spec = parse(content) as OASpec;
        console.log('✅ Loaded OpenAPI specification');
    } catch (error) {
        console.error(`❌ Failed to parse OpenAPI file: ${error instanceof Error ? error.message : String(error)}`);
        Deno.exit(1);
    }

    // --- Build endpoints ---
    const endpoints: EndpointEntry[] = [];
    const globalSecurity = spec.security;

    for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const method of HTTP_METHODS) {
            const operation = pathItem[method];
            if (!operation) continue;
            endpoints.push(buildEndpointEntry(path, method, operation, globalSecurity));
        }
    }

    // Sort by path (ascending), then method (ascending)
    endpoints.sort((a, b) => {
        const pathCmp = a.path.localeCompare(b.path);
        if (pathCmp !== 0) return pathCmp;
        return a.method.localeCompare(b.method);
    });

    // --- Build tags ---
    const tags: TagEntry[] = (spec.tags ?? []).map((t) => ({
        name: t.name,
        description: t.description ?? '',
    }));

    // Discover tags used by endpoints but not declared in spec.tags
    const declaredTagNames = new Set(tags.map((t) => t.name));
    const usedTagNames = new Set(endpoints.flatMap((e) => e.tags));
    for (const name of usedTagNames) {
        if (!declaredTagNames.has(name)) {
            tags.push({ name, description: '' });
        }
    }

    // --- Assemble registry ---
    const registry: EndpointRegistry = {
        generatedAt: new Date().toISOString(),
        specVersion: spec.info.version,
        endpoints,
        tags,
    };

    // --- Write output ---
    try {
        await Deno.writeTextFile(REGISTRY_OUTPUT_PATH, JSON.stringify(registry, null, 2) + '\n');
        console.log(`✅ Generated endpoint registry: ${REGISTRY_OUTPUT_PATH}`);
        console.log(`   ${endpoints.length} endpoints across ${tags.length} tags`);
    } catch (error) {
        console.error(`❌ Failed to write registry: ${error instanceof Error ? error.message : String(error)}`);
        Deno.exit(1);
    }

    // --- Summary ---
    const securedCount = endpoints.filter((e) => e.security.length > 0).length;
    const withBody = endpoints.filter((e) => e.hasRequestBody).length;
    console.log(`   ${securedCount} secured endpoints, ${withBody} with request bodies`);
    console.log('\n🎉 Endpoint registry generation complete!\n');
}

if (import.meta.main) {
    try {
        await generateEndpointRegistry();
    } catch (error) {
        console.error(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        Deno.exit(1);
    }
}
