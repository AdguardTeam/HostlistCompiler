#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Postman Collection Generator
 *
 * Auto-generates a Postman Collection v2.1.0 and environment file from
 * the canonical OpenAPI specification (docs/api/openapi.yaml).
 *
 * Organises requests into folders by tag, extracts request bodies from
 * OpenAPI examples, resolves $ref schema references for body placeholders,
 * and adds basic pm.test assertions for each endpoint.
 *
 * Run: deno task postman:collection
 * Output: docs/postman/postman-collection.json
 *         docs/postman/postman-environment.json
 */

import { parse } from '@std/yaml';
import { existsSync } from '@std/fs';

const OPENAPI_PATH = './docs/api/openapi.yaml';
const COLLECTION_OUTPUT_PATH = './docs/postman/postman-collection.json';
const ENVIRONMENT_OUTPUT_PATH = './docs/postman/postman-environment.json';

// ---------------------------------------------------------------------------
// OpenAPI type stubs (only the fields we actually read)
// ---------------------------------------------------------------------------

interface OAInfo {
    title: string;
    description?: string;
    version: string;
}

interface OAServer {
    url: string;
    description?: string;
}

interface OAMediaType {
    schema?: Record<string, unknown>;
    example?: unknown;
    examples?: Record<string, { summary?: string; value?: unknown }>;
}

interface OARequestBody {
    required?: boolean;
    content?: Record<string, OAMediaType>;
}

interface OAResponse {
    description?: string;
    content?: Record<string, OAMediaType>;
}

interface OAOperation {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    security?: Array<Record<string, unknown>>;
    requestBody?: OARequestBody;
    parameters?: Array<{
        name: string;
        in: string;
        required?: boolean;
        schema?: Record<string, unknown>;
        description?: string;
    }>;
    responses?: Record<string, OAResponse>;
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
    servers?: OAServer[];
    tags?: OATag[];
    paths: Record<string, OAPathItem>;
    components?: {
        schemas?: Record<string, unknown>;
        securitySchemes?: Record<string, { type: string; in?: string; name?: string; description?: string }>;
        [key: string]: unknown;
    };
}

// ---------------------------------------------------------------------------
// Postman Collection v2.1.0 type stubs
// ---------------------------------------------------------------------------

interface PostmanUrl {
    raw: string;
    protocol?: string;
    host: string[];
    path: string[];
    variable?: Array<{ key: string; value: string; description?: string }>;
    query?: Array<{ key: string; value: string; disabled?: boolean; description?: string }>;
}

interface PostmanHeader {
    key: string;
    value: string;
    type?: string;
    description?: string;
}

interface PostmanBody {
    mode: 'raw' | 'formdata' | 'urlencoded' | 'none';
    raw?: string;
    options?: { raw?: { language: string } };
}

interface PostmanRequest {
    method: string;
    header: PostmanHeader[];
    url: PostmanUrl;
    body?: PostmanBody;
    description?: string;
}

interface PostmanEvent {
    listen: 'test' | 'prerequest';
    script: {
        type: string;
        exec: string[];
    };
}

interface PostmanItem {
    name: string;
    description?: string;
    event?: PostmanEvent[];
    request?: PostmanRequest;
    item?: PostmanItem[];
}

interface PostmanCollection {
    info: {
        name: string;
        description: string;
        schema: string;
        _postman_id: string;
        version: string;
    };
    variable: Array<{ key: string; value: string; type: string; description?: string }>;
    item: PostmanItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Resolve a $ref string against the spec components.
 * Only handles local #/components/... references.
 */
function resolveRef(ref: string, spec: OASpec): Record<string, unknown> | null {
    if (!ref.startsWith('#/')) return null;
    const parts = ref.slice(2).split('/');
    let node: unknown = spec;
    for (const part of parts) {
        if (node == null || typeof node !== 'object') return null;
        node = (node as Record<string, unknown>)[part];
    }
    return (node != null && typeof node === 'object') ? (node as Record<string, unknown>) : null;
}

/**
 * Build a minimal JSON example object from an OpenAPI schema.
 * Returns a plain JS value suitable for JSON.stringify.
 */
function schemaToExample(schema: Record<string, unknown> | undefined, spec: OASpec, depth = 0): unknown {
    if (!schema || depth > 4) return {};
    if ('$ref' in schema && typeof schema['$ref'] === 'string') {
        const resolved = resolveRef(schema['$ref'] as string, spec);
        return schemaToExample(resolved as Record<string, unknown> | undefined, spec, depth + 1);
    }
    if ('example' in schema) return schema['example'];
    const type = schema['type'];
    if (type === 'object' || (type == null && schema['properties'])) {
        const props = schema['properties'] as Record<string, unknown> | undefined;
        if (!props) return {};
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(props)) {
            if (depth < 3) {
                result[key] = schemaToExample(val as Record<string, unknown>, spec, depth + 1);
            }
        }
        return result;
    }
    if (type === 'array') {
        const items = schema['items'] as Record<string, unknown> | undefined;
        return [schemaToExample(items, spec, depth + 1)];
    }
    if (type === 'string') return (schema['enum'] as string[] | undefined)?.[0] ?? 'string';
    if (type === 'integer' || type === 'number') return 0;
    if (type === 'boolean') return false;
    return {};
}

/**
 * Extract the best available request body example from an OAMediaType.
 */
function extractBodyExample(mediaType: OAMediaType | undefined, spec: OASpec): unknown {
    if (!mediaType) return undefined;
    if (mediaType.example !== undefined) return mediaType.example;
    if (mediaType.examples) {
        const first = Object.values(mediaType.examples)[0];
        if (first?.value !== undefined) return first.value;
    }
    if (mediaType.schema) return schemaToExample(mediaType.schema as Record<string, unknown>, spec);
    return undefined;
}

/**
 * Convert an OpenAPI path string to Postman URL parts.
 *
 * /queue/results/{requestId}  →  path: ["queue","results",":requestId"]
 *                                variable: [{key:"requestId", value:"{{requestId}}"}]
 *
 * Query parameters (in: 'query') are appended to url.query.
 * Required query params appear in url.raw with their placeholder value;
 * optional ones are included but disabled so they are easy to enable.
 */
function buildPostmanUrl(
    rawPath: string,
    baseVarName: string,
    queryParams: Array<{ name: string; required?: boolean; schema?: Record<string, unknown>; description?: string }> = [],
): PostmanUrl {
    const segments = rawPath.split('/').filter(Boolean);
    const pathParts: string[] = [];
    const variables: Array<{ key: string; value: string; description?: string }> = [];

    for (const seg of segments) {
        if (seg.startsWith('{') && seg.endsWith('}')) {
            const paramName = seg.slice(1, -1);
            pathParts.push(`:${paramName}`);
            variables.push({ key: paramName, value: `{{${paramName}}}`, description: `Path parameter: ${paramName}` });
        } else {
            pathParts.push(seg);
        }
    }

    // Build query string entries. The schema field is used only locally for type inference and
    // is intentionally omitted from the Postman output (Postman does not need schema metadata).
    const query: Array<{ key: string; value: string; disabled?: boolean; description?: string }> = queryParams.map((p) => ({
        key: p.name,
        value: `{{${p.name}}}`,
        ...(p.description ? { description: p.description } : {}),
        ...(p.required ? {} : { disabled: true }),
    }));

    // raw URL: include required query params inline so the URL is immediately usable
    const requiredQueryParts = queryParams.filter((p) => p.required).map((p) => `${p.name}={{${p.name}}}`);
    const rawQuery = requiredQueryParts.length > 0 ? `?${requiredQueryParts.join('&')}` : '';
    const rawUrl = `{{${baseVarName}}}/${pathParts.join('/')}${rawQuery}`;

    const url: PostmanUrl = {
        raw: rawUrl,
        host: [`{{${baseVarName}}}`],
        path: pathParts,
    };
    if (variables.length > 0) url.variable = variables;
    if (query.length > 0) url.query = query;
    return url;
}

/**
 * Determine whether an operation requires the AdminKey security header.
 */
function requiresAdminKey(operation: OAOperation): boolean {
    if (!operation.security) return false;
    return operation.security.some((scheme) => Object.keys(scheme).includes('AdminKey'));
}

/**
 * Build test script lines for an operation.
 */
function buildTestScript(operation: OAOperation): string[] {
    const lines: string[] = [];
    const successStatus = Object.keys(operation.responses ?? {}).find((s) => s.startsWith('2')) ?? '200';
    const statusNum = parseInt(successStatus, 10);
    const successResponse = operation.responses?.[successStatus];
    const contentTypes = Object.keys(successResponse?.content ?? {});
    const isJson = contentTypes.some((ct) => ct.includes('json'));
    const isSse = contentTypes.some((ct) => ct.includes('event-stream'));

    lines.push(`pm.test('Status code is ${statusNum}', function () {`);
    lines.push(`    pm.response.to.have.status(${statusNum});`);
    lines.push('});');

    if (isJson) {
        lines.push('');
        lines.push("pm.test('Response is JSON', function () {");
        lines.push('    pm.response.to.be.json;');
        lines.push('});');
    }

    if (isSse) {
        lines.push('');
        lines.push("pm.test('Response is SSE stream', function () {");
        lines.push("    pm.expect(pm.response.headers.get('Content-Type')).to.include('text/event-stream');");
        lines.push('});');
    }

    return lines;
}

/**
 * Build a single Postman request item from a path + method + operation.
 */
function buildRequestItem(path: string, method: HttpMethod, operation: OAOperation, spec: OASpec): PostmanItem {
    const name = operation.summary ?? operation.operationId ?? `${method.toUpperCase()} ${path}`;
    const headers: PostmanHeader[] = [];

    // Content-Type for methods that have a body
    const jsonMedia = operation.requestBody?.content?.['application/json'];
    if (jsonMedia) {
        headers.push({ key: 'Content-Type', value: 'application/json', type: 'text' });
    }

    // AdminKey header
    if (requiresAdminKey(operation)) {
        headers.push({ key: 'X-Admin-Key', value: '{{adminKey}}', type: 'text', description: 'Admin API key' });
    }

    // Request body
    let body: PostmanBody | undefined;
    if (jsonMedia) {
        const example = extractBodyExample(jsonMedia, spec);
        if (example !== undefined) {
            body = {
                mode: 'raw',
                raw: JSON.stringify(example, null, 4),
                options: { raw: { language: 'json' } },
            };
        }
    }

    const url = buildPostmanUrl(
        path,
        'baseUrl',
        (operation.parameters ?? []).filter((p) => p.in === 'query'),
    );

    const item: PostmanItem = {
        name,
        description: operation.description?.split('\n')[0] ?? operation.summary,
        event: [
            {
                listen: 'test',
                script: {
                    type: 'text/javascript',
                    exec: buildTestScript(operation),
                },
            },
        ],
        request: {
            method: method.toUpperCase(),
            header: headers,
            url,
            ...(body ? { body } : {}),
            description: operation.description,
        },
    };

    return item;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

async function generatePostmanCollection(): Promise<void> {
    console.log('🚀 Generating Postman collection from OpenAPI spec...\n');

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

    // Collect all server URLs
    const servers = spec.servers ?? [];
    const prodServer = servers.find((s) => !s.url.startsWith('http://localhost'));
    const localServer = servers.find((s) => s.url.startsWith('http://localhost'));

    const baseUrlValue = localServer?.url ?? 'http://localhost:8787';
    const prodUrlValue = prodServer?.url ?? '';

    // Build tag → folder map
    const tagOrder: string[] = (spec.tags ?? []).map((t) => t.name);
    const tagDescriptions: Record<string, string> = Object.fromEntries((spec.tags ?? []).map((t) => [t.name, t.description ?? '']));

    // Items per tag (preserve order from spec.tags, then catch-all)
    const tagItems: Record<string, PostmanItem[]> = {};
    for (const tagName of tagOrder) {
        tagItems[tagName] = [];
    }
    const untaggedItems: PostmanItem[] = [];

    let requestCount = 0;
    for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const method of HTTP_METHODS) {
            const operation = pathItem[method];
            if (!operation) continue;
            const item = buildRequestItem(path, method, operation, spec);
            const tag = operation.tags?.[0];
            if (tag) {
                if (!tagItems[tag]) tagItems[tag] = [];
                tagItems[tag].push(item);
            } else {
                untaggedItems.push(item);
            }
            requestCount++;
        }
    }

    // Build top-level folder items (only tags that have at least one request)
    const folderItems: PostmanItem[] = [];
    for (const tagName of tagOrder) {
        const items = tagItems[tagName];
        if (!items || items.length === 0) continue;
        folderItems.push({
            name: tagName,
            description: tagDescriptions[tagName],
            item: items,
        });
    }
    if (untaggedItems.length > 0) {
        folderItems.push({ name: 'Other', item: untaggedItems });
    }

    // Build collection
    const collection: PostmanCollection = {
        info: {
            name: spec.info.title,
            description: `Auto-generated from docs/api/openapi.yaml. Run 'deno task postman:collection' to regenerate.\n\n${spec.info.description ?? ''}`.trim(),
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
            _postman_id: 'adblock-compiler-api',
            version: spec.info.version,
        },
        variable: [
            { key: 'baseUrl', value: baseUrlValue, type: 'string' },
            { key: 'prodUrl', value: prodUrlValue, type: 'string' },
            { key: 'requestId', value: '', type: 'string' },
            { key: 'adminKey', value: '', type: 'string', description: 'Admin API key for protected admin endpoints (X-Admin-Key header)' },
            { key: 'userId', value: '', type: 'string', description: 'User ID captured from Create User response' },
            { key: 'apiKeyPrefix', value: '', type: 'string', description: 'API key prefix captured from Create API Key response' },
        ],
        item: folderItems,
    };

    // Write collection
    try {
        await Deno.writeTextFile(COLLECTION_OUTPUT_PATH, JSON.stringify(collection, null, 2) + '\n');
        console.log(`✅ Generated Postman collection: ${COLLECTION_OUTPUT_PATH} (${requestCount} requests across ${folderItems.length} folders)`);
    } catch (error) {
        console.error(`❌ Failed to write collection: ${error instanceof Error ? error.message : String(error)}`);
        Deno.exit(1);
    }

    // Also regenerate the environment file from spec servers
    const environment = {
        name: `${spec.info.title} - Local`,
        values: [
            { key: 'baseUrl', value: baseUrlValue, type: 'default', enabled: true },
            { key: 'prodUrl', value: prodUrlValue, type: 'default', enabled: true },
        ],
        _postman_variable_scope: 'environment',
        _postman_exported_using: 'deno task postman:collection',
    };

    try {
        await Deno.writeTextFile(ENVIRONMENT_OUTPUT_PATH, JSON.stringify(environment, null, 4) + '\n');
        console.log(`✅ Generated Postman environment: ${ENVIRONMENT_OUTPUT_PATH}`);
    } catch (error) {
        console.error(`❌ Failed to write environment: ${error instanceof Error ? error.message : String(error)}`);
        Deno.exit(1);
    }

    console.log('\n🎉 Postman collection generation complete!\n');
}

if (import.meta.main) {
    try {
        await generatePostmanCollection();
    } catch (error) {
        console.error(`❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        Deno.exit(1);
    }
}
