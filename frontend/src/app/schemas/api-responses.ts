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

export const UpdateKeyResponseSchema = z.object({
    success: z.boolean(),
    id: z.string(),
    keyPrefix: z.string(),
    name: z.string(),
    scopes: z.array(z.string()),
    rateLimitPerMinute: z.number(),
    lastUsedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------

export const CompileResponseSchema = z.object({
    success: z.boolean(),
    rules: z.array(z.string()).optional(),
    ruleCount: z.number().optional(),
    metrics: z
        .object({
            totalDuration: z.number().optional(),
            sourceCount: z.number().optional(),
            transformationCount: z.number().optional(),
            inputRuleCount: z.number().optional(),
            outputRuleCount: z.number().optional(),
            phases: z.record(z.string(), z.number()).optional(),
        })
        .optional(),
    compiledAt: z.string().optional(),
    previousVersion: z
        .object({
            rules: z.array(z.string()),
            ruleCount: z.number(),
            compiledAt: z.string(),
        })
        .optional(),
    cached: z.boolean().optional(),
    deduplicated: z.boolean().optional(),
    error: z.string().optional(),
});

export const AsyncCompileResponseSchema = z.object({
    success: z.boolean(),
    requestId: z.string(),
    note: z.string(),
    message: z.string().optional(),
    batchSize: z.number().optional(),
    priority: z.string().optional(),
    error: z.string().optional(),
});

export const BatchCompileItemSchema = CompileResponseSchema.extend({
    id: z.string(),
});

export const BatchCompileResponseSchema = z.object({
    success: z.boolean(),
    results: z.array(BatchCompileItemSchema),
    error: z.string().optional(),
});

export const ASTResultSchema = z.object({
    success: z.boolean(),
    parsedRules: z.unknown(),
    summary: z.unknown().optional(),
    error: z.string().optional(),
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
