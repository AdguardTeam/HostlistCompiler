/**
 * Zod schemas for worker runtime validation.
 * Provides type-safe validation for worker requests, queue messages, and workflow parameters.
 */

import { z } from 'zod';
import { ConfigurationSchema, PrioritySchema } from '../src/configuration/schemas.ts';
import { AuthScope, UserTier } from './types.ts';

// ============================================================================
// Basic Enums and Constants
// ============================================================================

// PrioritySchema is re-exported from src/configuration/schemas.ts to avoid duplication.
export { PrioritySchema } from '../src/configuration/schemas.ts';

/**
 * Queue message type schema
 */
export const QueueMessageTypeSchema = z.enum(['compile', 'batch-compile', 'cache-warm']).describe('Type of queue message');

/**
 * Workflow status schema
 */
export const WorkflowStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'paused', 'terminated']).describe('Current workflow execution status');

// ============================================================================
// AST Parse Request Schema
// ============================================================================
// Note: CompileRequestSchema, BatchRequestSchema, BatchRequestSyncSchema, and
// BatchRequestAsyncSchema are available from '../src/configuration/schemas.ts'
// and can be imported directly when needed in worker context.

/**
 * Schema for AST parse request
 */
export const ASTParseRequestSchema = z.object({
    rules: z.array(z.string()).optional(),
    text: z.string().optional(),
}).refine(
    (data) => data.rules !== undefined || data.text !== undefined,
    {
        message: 'Either rules or text must be provided',
    },
);

// ============================================================================
// Admin Request Schemas
// ============================================================================

/**
 * Schema for admin SQL query request
 */
export const AdminQueryRequestSchema = z.object({
    sql: z.string().min(1, 'SQL query is required'),
});

// ============================================================================
// Queue Message Schemas
// ============================================================================

/**
 * Base queue message schema
 */
const BaseQueueMessageSchema = z.object({
    requestId: z.string().optional(),
    timestamp: z.number().int().positive(),
    priority: PrioritySchema.optional(),
    /** Optional group identifier; jobs sharing a group can be cancelled or queried together */
    group: z.string().max(128).optional(),
});

/**
 * Schema for a single batch request item
 * Shared between batch-related schemas to prevent drift.
 */
export const BatchRequestItemSchema = z.object({
    id: z.string().min(1),
    configuration: ConfigurationSchema,
    preFetchedContent: z.record(z.string(), z.string()).optional(),
    benchmark: z.boolean().optional(),
});

/**
 * Schema for single compilation queue message
 */
export const CompileQueueMessageSchema = BaseQueueMessageSchema.extend({
    type: z.literal('compile'),
    configuration: ConfigurationSchema,
    preFetchedContent: z.record(z.string(), z.string()).optional(),
    benchmark: z.boolean().optional(),
});

/**
 * Schema for batch compilation queue message
 */
export const BatchCompileQueueMessageSchema = BaseQueueMessageSchema.extend({
    type: z.literal('batch-compile'),
    requests: z.array(BatchRequestItemSchema).nonempty(),
});

/**
 * Schema for cache warming queue message
 */
export const CacheWarmQueueMessageSchema = BaseQueueMessageSchema.extend({
    type: z.literal('cache-warm'),
    configurations: z.array(ConfigurationSchema).nonempty(),
});

/**
 * Union schema for all queue message types
 */
export const QueueMessageSchema = z.discriminatedUnion('type', [
    CompileQueueMessageSchema,
    BatchCompileQueueMessageSchema,
    CacheWarmQueueMessageSchema,
]);

// ============================================================================
// Workflow Parameter Schemas
// ============================================================================

/**
 * Schema for compilation workflow parameters
 */
export const CompilationParamsSchema = z.object({
    requestId: z.string().min(1),
    configuration: ConfigurationSchema,
    preFetchedContent: z.record(z.string(), z.string()).optional(),
    benchmark: z.boolean().optional(),
    priority: PrioritySchema.optional(),
    queuedAt: z.number().int().positive(),
});

/**
 * Schema for batch compilation workflow parameters
 */
export const BatchCompilationParamsSchema = z.object({
    batchId: z.string().min(1),
    requests: z.array(BatchRequestItemSchema).nonempty(),
    priority: PrioritySchema.optional(),
    queuedAt: z.number().int().positive(),
});

/**
 * Schema for cache warming workflow parameters
 */
export const CacheWarmingParamsSchema = z.object({
    runId: z.string().min(1),
    configurations: z.array(ConfigurationSchema).nonempty(),
    scheduled: z.boolean(),
});

/**
 * Schema for health monitoring workflow parameters
 */
export const HealthMonitoringParamsSchema = z.object({
    runId: z.string().min(1),
    sources: z.array(
        z.object({
            name: z.string().min(1),
            url: z.string().url(),
            expectedMinRules: z.number().int().positive().optional(),
        }),
    ).nonempty(),
    alertOnFailure: z.boolean(),
});

// ============================================================================
// Turnstile Validation Schemas
// ============================================================================

/**
 * Schema for Turnstile verification response
 */
export const TurnstileVerifyResponseSchema = z.object({
    success: z.boolean(),
    challenge_ts: z.string().optional(),
    hostname: z.string().optional(),
    'error-codes': z.array(z.string()).optional(),
    action: z.string().optional(),
    cdata: z.string().optional(),
});

/**
 * Schema for Turnstile verification result
 */
export const TurnstileResultSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

// ============================================================================
// Metrics and Statistics Schemas
// ============================================================================

/**
 * Schema for rate limit data
 */
export const RateLimitDataSchema = z.object({
    count: z.number().int().nonnegative(),
    resetAt: z.number().int().positive(),
});

/**
 * Schema for endpoint metrics
 */
export const EndpointMetricsSchema = z.object({
    count: z.number().int().nonnegative(),
    success: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    totalDuration: z.number().nonnegative(),
    errors: z.record(z.string(), z.number().int().nonnegative()),
});

/**
 * Schema for endpoint metrics display (with calculated avg)
 */
export const EndpointMetricsDisplaySchema = z.object({
    count: z.number().int().nonnegative(),
    success: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    avgDuration: z.number().nonnegative(),
    errors: z.record(z.string(), z.number().int().nonnegative()),
});

/**
 * Schema for aggregated metrics
 */
export const AggregatedMetricsSchema = z.object({
    window: z.string(),
    timestamp: z.string().datetime().describe('ISO 8601 timestamp of the metrics window'),
    endpoints: z.record(z.string(), EndpointMetricsDisplaySchema),
});

/**
 * Schema for job history entry
 */
export const JobHistoryEntrySchema = z.object({
    requestId: z.string(),
    configName: z.string(),
    status: z.enum(['completed', 'failed', 'cancelled']),
    duration: z.number().nonnegative(),
    timestamp: z.string().datetime().describe('ISO 8601 timestamp when the job completed'),
    error: z.string().optional(),
    ruleCount: z.number().int().nonnegative().optional(),
    cacheKey: z.string().optional(),
});

/**
 * Schema for queue depth history entry
 */
export const DepthHistoryEntrySchema = z.object({
    timestamp: z.string().datetime().describe('ISO 8601 timestamp of the queue depth measurement'),
    pending: z.number().int().nonnegative(),
});

/**
 * Schema for queue statistics
 */
export const QueueStatsSchema = z.object({
    pending: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    totalProcessingTime: z.number().nonnegative(),
    averageProcessingTime: z.number().nonnegative(),
    processingRate: z.number().nonnegative(),
    queueLag: z.number().nonnegative(),
    lastUpdate: z.string(),
    history: z.array(JobHistoryEntrySchema),
    depthHistory: z.array(DepthHistoryEntrySchema),
});

/**
 * Schema for job info (for stat updates)
 */
export const JobInfoSchema = z.object({
    requestId: z.string().optional(),
    configName: z.string().optional(),
    error: z.string().optional(),
    ruleCount: z.number().int().nonnegative().optional(),
    cacheKey: z.string().optional(),
});

// ============================================================================
// Admin Response Schemas
// ============================================================================

/**
 * Schema for admin authentication result
 */
export const AdminAuthResultSchema = z.object({
    authorized: z.boolean(),
    error: z.string().optional(),
});

/**
 * Schema for storage statistics
 */
export const StorageStatsSchema = z.object({
    storage_entries: z.number().int().nonnegative(),
    filter_cache: z.number().int().nonnegative(),
    compilation_metadata: z.number().int().nonnegative(),
    expired_storage: z.number().int().nonnegative(),
    expired_cache: z.number().int().nonnegative(),
});

/**
 * Schema for table info
 */
export const TableInfoSchema = z.object({
    name: z.string(),
    type: z.string(),
});

// ============================================================================
// Compilation Result Schemas
// ============================================================================

/**
 * Schema for compilation metrics
 */
export const CompilationMetricsSchema = z.object({
    totalDuration: z.number().nonnegative().optional(),
    sourceCount: z.number().int().nonnegative().optional(),
    transformationCount: z.number().int().nonnegative().optional(),
    inputRuleCount: z.number().int().nonnegative().optional(),
    outputRuleCount: z.number().int().nonnegative().optional(),
    phases: z.record(z.string(), z.number().nonnegative()).optional(),
});

/**
 * Schema for previous version info
 */
export const PreviousVersionSchema = z.object({
    rules: z.array(z.string()),
    ruleCount: z.number().int().nonnegative(),
    compiledAt: z.string().datetime().describe('ISO 8601 timestamp when this version was compiled'),
});

/**
 * Schema for compilation result
 */
export const CompilationResultSchema = z.object({
    success: z.boolean(),
    rules: z.array(z.string()).optional(),
    ruleCount: z.number().int().nonnegative().optional(),
    metrics: CompilationMetricsSchema.optional(),
    error: z.string().optional(),
    compiledAt: z.string().optional(),
    previousVersion: PreviousVersionSchema.optional(),
    cached: z.boolean().optional(),
    deduplicated: z.boolean().optional(),
});

// ============================================================================
// Workflow Result Schemas
// ============================================================================

/**
 * Schema for source fetch result
 */
export const SourceFetchResultSchema = z.object({
    name: z.string(),
    url: z.string().url(),
    success: z.boolean(),
    ruleCount: z.number().int().nonnegative().optional(),
    error: z.string().optional(),
    durationMs: z.number().nonnegative(),
    cached: z.boolean(),
    etag: z.string().optional(),
});

/**
 * Schema for transformation result
 */
export const TransformationResultSchema = z.object({
    transformationName: z.string(),
    inputRuleCount: z.number().int().nonnegative(),
    outputRuleCount: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative(),
});

// ============================================================================
// Workflow Step Sub-Schemas
// ============================================================================

/**
 * Schema for the validation step in a workflow compilation result
 */
export const WorkflowValidationStepSchema = z.object({
    durationMs: z.number().nonnegative(),
    success: z.boolean(),
});

/**
 * Schema for the source fetch step in a workflow compilation result
 */
export const WorkflowSourceFetchStepSchema = z.object({
    durationMs: z.number().nonnegative(),
    sources: z.array(SourceFetchResultSchema),
});

/**
 * Schema for the transformation step in a workflow compilation result
 */
export const WorkflowTransformationStepSchema = z.object({
    durationMs: z.number().nonnegative(),
    transformations: z.array(TransformationResultSchema),
});

/**
 * Schema for the header generation step in a workflow compilation result
 */
export const WorkflowHeaderGenerationStepSchema = z.object({
    durationMs: z.number().nonnegative(),
});

/**
 * Schema for the caching step in a workflow compilation result
 */
export const WorkflowCachingStepSchema = z.object({
    durationMs: z.number().nonnegative(),
    compressed: z.boolean(),
    sizeBytes: z.number().int().nonnegative(),
});

/**
 * Schema for all workflow compilation steps (each step is optional)
 */
export const WorkflowStepsSchema = z.object({
    validation: WorkflowValidationStepSchema.optional(),
    sourceFetch: WorkflowSourceFetchStepSchema.optional(),
    transformation: WorkflowTransformationStepSchema.optional(),
    headerGeneration: WorkflowHeaderGenerationStepSchema.optional(),
    caching: WorkflowCachingStepSchema.optional(),
});

/**
 * Schema for workflow compilation result
 */
export const WorkflowCompilationResultSchema = z.object({
    success: z.boolean().describe('Whether the compilation succeeded'),
    requestId: z.string().describe('Unique request identifier'),
    configName: z.string().describe('Name of the compiled filter list configuration'),
    rules: z.array(z.string()).optional().describe('Compiled filter rules'),
    ruleCount: z.number().int().nonnegative().optional().describe('Number of compiled filter rules'),
    cacheKey: z.string().optional().describe('Cache key under which the result is stored'),
    compiledAt: z.string().datetime().describe('ISO 8601 timestamp when compilation completed'),
    totalDurationMs: z.number().nonnegative().describe('Total compilation duration in milliseconds'),
    steps: WorkflowStepsSchema.describe('Per-step timing and result breakdown'),
    error: z.string().optional().describe('Error message if compilation failed'),
});

/**
 * Schema for batch workflow result
 */
export const BatchWorkflowResultSchema = z.object({
    batchId: z.string(),
    totalRequests: z.number().int().positive(),
    successful: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    results: z.array(WorkflowCompilationResultSchema),
    totalDurationMs: z.number().nonnegative(),
});

/**
 * Schema for source health result
 */
export const SourceHealthResultSchema = z.object({
    name: z.string(),
    url: z.string().url(),
    healthy: z.boolean(),
    statusCode: z.number().int().optional(),
    responseTimeMs: z.number().nonnegative().optional(),
    ruleCount: z.number().int().nonnegative().optional(),
    error: z.string().optional(),
    lastChecked: z.string().datetime().describe('ISO 8601 timestamp of the last health check'),
});

/**
 * Schema for health monitoring result
 */
export const HealthMonitoringResultSchema = z.object({
    runId: z.string(),
    sourcesChecked: z.number().int().nonnegative(),
    healthySources: z.number().int().nonnegative(),
    unhealthySources: z.number().int().nonnegative(),
    results: z.array(SourceHealthResultSchema),
    alertsSent: z.boolean(),
    totalDurationMs: z.number().nonnegative(),
});

/**
 * Schema for cache warming result
 */
export const CacheWarmingResultSchema = z.object({
    runId: z.string(),
    scheduled: z.boolean(),
    warmedConfigurations: z.number().int().nonnegative(),
    failedConfigurations: z.number().int().nonnegative(),
    details: z.array(
        z.object({
            configName: z.string(),
            success: z.boolean(),
            cacheKey: z.string().optional(),
            error: z.string().optional(),
        }),
    ),
    totalDurationMs: z.number().nonnegative(),
});

// ============================================================================
// Workflow Event Schemas
// ============================================================================

/**
 * Schema for workflow event type
 */
export const WorkflowEventTypeSchema = z.enum([
    'workflow:started',
    'workflow:step:started',
    'workflow:step:completed',
    'workflow:step:failed',
    'workflow:progress',
    'workflow:completed',
    'workflow:failed',
    'source:fetch:started',
    'source:fetch:completed',
    'source:fetch:failed',
    'transformation:started',
    'transformation:completed',
    'cache:stored',
    'health:check:started',
    'health:check:completed',
]);

/**
 * Schema for workflow progress event
 */
export const WorkflowProgressEventSchema = z.object({
    type: WorkflowEventTypeSchema,
    workflowId: z.string(),
    workflowType: z.string(),
    timestamp: z.string(),
    step: z.string().optional(),
    progress: z.number().min(0).max(100).optional(),
    message: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for workflow instance info
 */
export const WorkflowInstanceInfoSchema = z.object({
    id: z.string(),
    workflowName: z.string(),
    status: WorkflowStatusSchema,
    createdAt: z.string().datetime().describe('ISO 8601 timestamp when the workflow instance was created'),
    params: z.unknown().optional(),
    output: z.unknown().optional(),
    error: z.string().optional(),
});

// ============================================================================
// Rule Validation Schemas (POST /validate-rule)
// ============================================================================

/**
 * Schema for validating a single adblock rule.
 * Optionally tests the rule against a provided URL.
 */
export const ValidateRuleRequestSchema = z.object({
    rule: z.string().min(1, 'Rule must not be empty').describe('Single adblock filter rule to validate'),
    testUrl: z.string().url('testUrl must be a valid URL').optional().describe('Optional URL to test the rule against'),
    strict: z.boolean().optional().default(false).describe('Enable strict validation mode'),
});

export type ValidateRuleRequest = z.infer<typeof ValidateRuleRequestSchema>;

/**
 * Schema for a single validate-rule response
 */
export const ValidateRuleResponseSchema = z.object({
    success: z.boolean(),
    valid: z.boolean(),
    rule: z.string(),
    ruleType: z.string().optional().describe('High-level classification of the rule (e.g. "NetworkRule", "CosmeticRule")'),
    category: z.string().optional().describe('Category or subtype of the rule (e.g. "Network", "Cosmetic")'),
    syntax: z.string().optional().describe('Detected adblock syntax variant for the rule'),
    ast: z.record(z.string(), z.unknown()).optional().describe('Parsed AST representation when validation succeeds'),
    error: z.string().optional().describe('Parse error message when valid is false'),
    testUrl: z.string().optional().describe('The URL that was tested against the rule'),
    matchResult: z.boolean().optional().describe('Whether the rule matched the testUrl'),
    duration: z.string().describe('Processing duration e.g. "2ms"'),
});

// ============================================================================
// Rule Management Schemas (POST/GET/PUT/DELETE /rules)
// ============================================================================

/**
 * Schema for creating a new saved rule set
 */
export const RuleSetCreateSchema = z.object({
    name: z.string().min(1).max(128).describe('Human-readable name for this rule set'),
    description: z.string().max(512).optional().describe('Optional description'),
    rules: z.array(z.string()).min(1, 'At least one rule is required').max(10_000, 'Maximum 10,000 rules per set'),
    tags: z.array(z.string().max(64)).max(20).optional().describe('Optional tags for categorisation'),
});

export type RuleSetCreate = z.infer<typeof RuleSetCreateSchema>;

/**
 * Schema for updating an existing rule set (all fields optional)
 */
export const RuleSetUpdateSchema = z.object({
    name: z.string().min(1).max(128).optional(),
    description: z.string().max(512).optional(),
    rules: z.array(z.string()).min(1).max(10_000).optional(),
    tags: z.array(z.string().max(64)).max(20).optional(),
});

export type RuleSetUpdate = z.infer<typeof RuleSetUpdateSchema>;

/**
 * Schema for a stored rule set (full representation)
 */
export const RuleSetSchema = z.object({
    id: z.string().uuid().describe('Unique identifier for the rule set'),
    name: z.string(),
    description: z.string().optional(),
    rules: z.array(z.string()),
    ruleCount: z.number().int().nonnegative(),
    tags: z.array(z.string()).optional(),
    createdAt: z.string().datetime().describe('ISO 8601 creation timestamp'),
    updatedAt: z.string().datetime().describe('ISO 8601 last-updated timestamp'),
});

export type RuleSet = z.infer<typeof RuleSetSchema>;

// ============================================================================
// Webhook / Notification Schemas (POST /notify)
// ============================================================================

/**
 * Supported notification event levels
 */
export const NotifyLevelSchema = z.enum(['info', 'warn', 'error', 'debug']).describe('Severity level of the notification');

/**
 * Schema for an outbound webhook notification request
 */
export const WebhookNotifyRequestSchema = z.object({
    event: z.string().min(1).max(128).describe('Event name or type (e.g. "compile.error", "rule.invalid")'),
    level: NotifyLevelSchema.default('info'),
    message: z.string().min(1).max(2048).describe('Human-readable message describing the event'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Arbitrary additional data to attach to the notification'),
    source: z.string().max(128).optional().describe('Identifies the component that emitted the event'),
    timestamp: z.string().datetime().optional().describe('ISO 8601 event timestamp; defaults to current time if omitted'),
});

export type WebhookNotifyRequest = z.infer<typeof WebhookNotifyRequestSchema>;

/**
 * Schema for the result of a single webhook delivery attempt
 */
export const WebhookDeliverySchema = z.object({
    target: z.string().describe('Webhook target identifier (e.g. "generic", "sentry")'),
    success: z.boolean(),
    statusCode: z.number().int().optional(),
    error: z.string().optional(),
});

/**
 * Schema for POST /notify response
 */
export const WebhookNotifyResponseSchema = z.object({
    success: z.boolean(),
    event: z.string(),
    deliveries: z.array(WebhookDeliverySchema),
    duration: z.string(),
});

// ============================================================================
// Queue Group Enhancement
// ============================================================================

// Re-export BaseQueueMessageSchema extension note:
// The group field is added to queue messages to support grouped job processing.
// Consumers can use this to batch related jobs or apply shared cancellation.

// ============================================================================
// Clerk Auth Schemas
// ============================================================================

/**
 * A single email address entry in a Clerk user event payload.
 */
export const ClerkEmailAddressSchema = z.object({
    id: z.string().min(1),
    email_address: z.string().email(),
    verification: z.object({
        status: z.enum(['verified', 'unverified', 'failed', 'expired']),
    }).nullable().optional(),
});

export type ClerkEmailAddress = z.infer<typeof ClerkEmailAddressSchema>;

/**
 * Full user data shape sent by Clerk for `user.created` and `user.updated` events.
 * Uses `.passthrough()` to allow unknown fields Clerk may add in future versions.
 */
export const ClerkWebhookUserDataSchema = z.object({
    id: z.string().min(1),
    email_addresses: z.array(ClerkEmailAddressSchema).optional(),
    primary_email_address_id: z.string().nullable().optional(),
    first_name: z.string().max(100).nullable().optional(),
    last_name: z.string().max(100).nullable().optional(),
    image_url: z.string().url().nullable().optional(),
    public_metadata: z.object({
        tier: z.nativeEnum(UserTier).optional(),
        role: z.string().optional(),
    }).optional(),
    last_sign_in_at: z.number().int().min(0).nullable().optional(),
}).passthrough();

export type ClerkWebhookUserData = z.infer<typeof ClerkWebhookUserDataSchema>;

/**
 * Minimal base schema for any Clerk webhook event.
 * Accepts unknown event types so the handler can gracefully acknowledge them
 * (Svix retries on 4xx; unknown-type events should still return 200).
 */
export const ClerkWebhookEventBaseSchema = z.object({
    type: z.string().min(1),
    data: z.object({ id: z.string().min(1) }).passthrough(),
});

export type ClerkWebhookEventBase = z.infer<typeof ClerkWebhookEventBaseSchema>;

/**
 * Strict schema for the three Clerk user lifecycle events this worker handles.
 * Use for documentation and validation within known-type branches.
 */
export const ClerkWebhookEventSchema = z.object({
    type: z.enum(['user.created', 'user.updated', 'user.deleted']),
    data: ClerkWebhookUserDataSchema,
});

export type ClerkWebhookEvent = z.infer<typeof ClerkWebhookEventSchema>;

/**
 * Shape of a verified Clerk JWT payload after `jwtVerify()` succeeds.
 * Uses `.passthrough()` so additional JWKS claims do not cause parse failures.
 */
export const ClerkJWTClaimsSchema = z.object({
    sub: z.string().min(1, 'sub (user ID) is required'),
    iss: z.string().url(),
    exp: z.number().int().positive(),
    nbf: z.number().int().min(0).optional(),
    iat: z.number().int().min(0),
    azp: z.string().optional(),
    sid: z.string().optional(),
    org_id: z.string().optional(),
    org_role: z.string().optional(),
    metadata: z.object({
        tier: z.nativeEnum(UserTier).optional(),
        role: z.string().optional(),
    }).optional(),
}).passthrough();

export type ClerkJWTClaims = z.infer<typeof ClerkJWTClaimsSchema>;

/**
 * Request body for POST /api/keys (create a new API key).
 */
export const CreateApiKeyRequestSchema = z.object({
    name: z.string().trim().min(1, 'name is required').max(100, 'name must be at most 100 characters'),
    scopes: z.array(z.nativeEnum(AuthScope)).optional().default([AuthScope.Compile]),
    expiresInDays: z.number().int().min(1).max(365).optional(),
});

export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;

/**
 * Request body for PATCH /api/keys/:id (update an existing API key).
 * At least one of `name` or `scopes` must be present.
 */
export const UpdateApiKeyRequestSchema = z.object({
    name: z.string().trim().min(1, 'name must be a non-empty string').max(100, 'name must be at most 100 characters').optional(),
    scopes: z.array(z.nativeEnum(AuthScope)).optional(),
}).refine(
    (d) => d.name !== undefined || d.scopes !== undefined,
    { message: 'At least one of name or scopes is required' },
);

export type UpdateApiKeyRequest = z.infer<typeof UpdateApiKeyRequestSchema>;

/**
 * A single API key row returned from the `api_keys` table.
 * Used to validate DB rows before trusting them in business logic.
 */
export const ApiKeyRowSchema = z.object({
    id: z.string().min(1),
    user_id: z.string().optional(),
    key_prefix: z.string().optional(),
    name: z.string().optional(),
    scopes: z.array(z.nativeEnum(AuthScope)),
    rate_limit_per_minute: z.number().int().nonnegative(),
    expires_at: z.string().nullable().optional(),
    revoked_at: z.string().nullable().optional(),
    last_used_at: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});

export type ApiKeyRow = z.infer<typeof ApiKeyRowSchema>;

/**
 * A single row from `users` when resolving an API key owner's tier.
 */
export const UserTierRowSchema = z.object({
    tier: z.nativeEnum(UserTier),
});

export type UserTierRow = z.infer<typeof UserTierRowSchema>;
