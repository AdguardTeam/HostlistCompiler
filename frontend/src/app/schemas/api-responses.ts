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
    sources: z.number().optional(),
    benchmark: z
        .object({
            duration: z.string().optional(),
            startTime: z.number().optional(),
            endTime: z.number().optional(),
        })
        .optional(),
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

// ---------------------------------------------------------------------------
// Admin System Responses — ZTA validation for admin panel API calls (#1054)
// ---------------------------------------------------------------------------

/** Announcement severity */
export const AnnouncementSeveritySchema = z.enum(['info', 'warning', 'error', 'success']);

/** Admin role returned by the API */
export const AdminRoleSchema = z.object({
    id: z.number(),
    role_name: z.string(),
    display_name: z.string(),
    description: z.string(),
    permissions: z.array(z.string()),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});
export type AdminRoleValidated = z.infer<typeof AdminRoleSchema>;

/** Admin role assignment */
export const AdminRoleAssignmentSchema = z.object({
    id: z.number(),
    clerk_user_id: z.string(),
    role_name: z.string(),
    assigned_by: z.string(),
    assigned_at: z.string(),
    expires_at: z.string().nullable(),
});
export type AdminRoleAssignmentValidated = z.infer<typeof AdminRoleAssignmentSchema>;

/** Tier config as returned by the admin API */
export const TierConfigSchema = z.object({
    id: z.number(),
    tier_name: z.string(),
    order_rank: z.number(),
    rate_limit: z.number(),
    display_name: z.string(),
    description: z.string(),
    features: z.record(z.string(), z.unknown()),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});
export type TierConfigValidated = z.infer<typeof TierConfigSchema>;

/** Scope config as returned by the admin API */
export const ScopeConfigSchema = z.object({
    id: z.number(),
    scope_name: z.string(),
    display_name: z.string(),
    description: z.string(),
    required_tier: z.string(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});
export type ScopeConfigValidated = z.infer<typeof ScopeConfigSchema>;

/** Endpoint auth override */
export const EndpointAuthOverrideSchema = z.object({
    id: z.number(),
    path_pattern: z.string(),
    method: z.string(),
    required_tier: z.string().nullable(),
    required_scopes: z.array(z.string()).nullable(),
    is_public: z.boolean(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});
export type EndpointAuthOverrideValidated = z.infer<typeof EndpointAuthOverrideSchema>;

/** Feature flag */
export const FeatureFlagSchema = z.object({
    id: z.number(),
    flag_name: z.string(),
    enabled: z.boolean(),
    rollout_percentage: z.number(),
    target_tiers: z.array(z.string()),
    target_users: z.array(z.string()),
    description: z.string(),
    created_by: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
});
export type FeatureFlagValidated = z.infer<typeof FeatureFlagSchema>;

/** Announcement */
export const AdminAnnouncementSchema = z.object({
    id: z.number(),
    title: z.string(),
    body: z.string(),
    severity: AnnouncementSeveritySchema,
    active_from: z.string().nullable(),
    active_until: z.string().nullable(),
    is_active: z.boolean(),
    created_by: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
});
export type AdminAnnouncementValidated = z.infer<typeof AdminAnnouncementSchema>;

/** Audit log entry */
export const AdminAuditLogSchema = z.object({
    id: z.number(),
    actor_id: z.string(),
    actor_email: z.string().nullable(),
    action: z.string(),
    resource_type: z.string(),
    resource_id: z.string().nullable(),
    old_values: z.unknown().nullable(),
    new_values: z.unknown().nullable(),
    ip_address: z.string().nullable(),
    status: z.string(),
    created_at: z.string(),
});
export type AdminAuditLogValidated = z.infer<typeof AdminAuditLogSchema>;

/** Resolved admin context (current user's role + permissions) */
export const ResolvedAdminContextSchema = z.object({
    clerk_user_id: z.string(),
    role_name: z.string(),
    permissions: z.array(z.string()),
    expires_at: z.string().nullable(),
});
export type ResolvedAdminContextValidated = z.infer<typeof ResolvedAdminContextSchema>;

/** Generic admin list response — reusable for all paginated admin endpoints */
export const AdminListResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        success: z.literal(true),
        items: z.array(itemSchema),
        total: z.number(),
        limit: z.number(),
        offset: z.number(),
    });

// Pre-built list responses for common admin entities
export const GetRolesResponseSchema = AdminListResponseSchema(AdminRoleSchema);
export const GetTierConfigsResponseSchema = AdminListResponseSchema(TierConfigSchema);
export const GetScopeConfigsResponseSchema = AdminListResponseSchema(ScopeConfigSchema);
export const GetFeatureFlagsResponseSchema = AdminListResponseSchema(FeatureFlagSchema);
export const GetAnnouncementsResponseSchema = AdminListResponseSchema(AdminAnnouncementSchema);
export const GetAuditLogsResponseSchema = AdminListResponseSchema(AdminAuditLogSchema);
export const GetEndpointOverridesResponseSchema = AdminListResponseSchema(EndpointAuthOverrideSchema);
