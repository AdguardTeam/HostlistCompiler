/**
 * Zod schemas for validating API responses from the Worker backend.
 *
 * ZTA principle: the Angular frontend MUST treat the Worker API as an
 * untrusted external service. All critical API responses are validated
 * at runtime before being consumed by components or services.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

export const ApiKeySchema = z.object({
    id: z.string(),
    keyPrefix: z.string(),
    name: z.string(),
    scopes: z.array(z.string()),
    rateLimitPerMinute: z.number(),
    lastUsedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
    revokedAt: z.string().nullable(),
    createdAt: z.string(),
});
export type ApiKeyValidated = z.infer<typeof ApiKeySchema>;

export const GetKeysResponseSchema = z.object({
    success: z.boolean(),
    keys: z.array(ApiKeySchema),
    total: z.number(),
});

export const CreateKeyResponseSchema = z.object({
    success: z.boolean(),
    key: z.string(),
    id: z.string(),
    keyPrefix: z.string(),
    name: z.string(),
    scopes: z.array(z.string()),
    rateLimitPerMinute: z.number(),
    expiresAt: z.string().nullable(),
    createdAt: z.string(),
});

export const UpdateKeyResponseSchema = ApiKeySchema.extend({
    success: z.boolean(),
});

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------

export const CompileResponseSchema = z.object({
    success: z.boolean(),
    ruleCount: z.number(),
    sources: z.number(),
    transformations: z.array(z.string()),
    message: z.string(),
    rules: z.array(z.string()).optional(),
    cached: z.boolean().optional(),
    benchmark: z
        .object({
            duration: z.string(),
            rulesPerSecond: z.number(),
        })
        .optional(),
});

export const AsyncCompileResponseSchema = z.object({
    success: z.boolean(),
    requestId: z.string(),
    note: z.string(),
    error: z.string().optional(),
});

export const ASTResultSchema = z.object({
    success: z.boolean(),
    ast: z.unknown(),
    ruleCount: z.number(),
    parseTime: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const ValidationErrorSchema = z.object({
    line: z.number(),
    column: z.number().optional(),
    rule: z.string(),
    errorType: z.string(),
    message: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
});

export const ValidationResultSchema = z.object({
    success: z.boolean(),
    valid: z.boolean(),
    totalRules: z.number(),
    validRules: z.number(),
    invalidRules: z.number(),
    errors: z.array(ValidationErrorSchema),
    warnings: z.array(ValidationErrorSchema),
    duration: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Utility: safe parse helper
// ---------------------------------------------------------------------------

/**
 * Validate an API response with the given Zod schema.
 * Returns the parsed value on success, throws a descriptive error on failure.
 */
export function validateResponse<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
    const result = schema.safeParse(data);
    if (!result.success) {
        console.error(`[ZTA] Invalid API response from ${context}:`, result.error.format());
        throw new Error(`Invalid API response from ${context}`);
    }
    return result.data;
}
