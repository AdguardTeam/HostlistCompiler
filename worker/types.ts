/**
 * Shared type definitions for the Cloudflare Worker.
 * Provides type safety and eliminates 'any' types throughout the worker.
 */

/// <reference types="@cloudflare/workers-types" />

import type { IConfiguration } from '../src/types/index.ts';
import type { PipelineBinding } from '../src/services/PipelineService.ts';
import type { BrowserWorker } from './cloudflare-workers-shim.ts';

// ============================================================================
// Database Types
// ============================================================================

/**
 * D1 Database type from Cloudflare Workers Types
 */
export interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run(): Promise<D1Result>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
    meta?: D1ResultMeta;
}

export interface D1ResultMeta {
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
}

export interface D1ExecResult {
    count: number;
    duration: number;
}

// ============================================================================
// Workflow Types
// ============================================================================

export type WorkflowStatus = 'queued' | 'running' | 'completed' | 'failed' | 'paused' | 'terminated';

/**
 * Workflow binding type - matches Cloudflare Workers Workflow type
 */
export interface Workflow<Params = unknown> {
    create(options?: { id?: string; params?: Params }): Promise<WorkflowInstance>;
    get(id: string): Promise<WorkflowInstance>;
}

export interface WorkflowInstance {
    id: string;
    pause(): Promise<void>;
    resume(): Promise<void>;
    terminate(): Promise<void>;
    restart(): Promise<void>;
    status(): Promise<WorkflowStatusResult>;
}

export interface WorkflowStatusResult {
    status: WorkflowStatus;
    output?: unknown;
    error?: string;
}

// ============================================================================
// Hyperdrive Binding
// ============================================================================

/**
 * Cloudflare Hyperdrive binding type.
 * Provides accelerated PostgreSQL connectivity via Cloudflare's edge network.
 */
export interface HyperdriveBinding {
    connectionString: string;
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

// ============================================================================
// Authentication & Authorization Types
// ============================================================================

/**
 * User tier determines rate limits and feature access.
 * Maps to the Prisma UserTier enum and Clerk user metadata.
 */
export enum UserTier {
    Anonymous = 'anonymous',
    Free = 'free',
    Pro = 'pro',
    Admin = 'admin',
}

// ---------------------------------------------------------------------------
// Tier Registry — single source of truth for tier metadata
// ---------------------------------------------------------------------------

/**
 * Configuration for a single user tier.
 * All tier-related metadata lives here — no scattered constants.
 */
export interface ITierConfig {
    /** Numeric rank for ordering comparisons (higher = more privileged) */
    readonly order: number;
    /** Maximum requests per 60-second sliding window for this tier */
    readonly rateLimit: number;
    /** Human-readable display name */
    readonly displayName: string;
    /** Short description of the tier */
    readonly description: string;
}

/**
 * Centralized tier registry — the single source of truth for tier ordering,
 * rate limits, and metadata. To add a new tier:
 *   1. Add the value to {@link UserTier}
 *   2. Add its config entry here
 * That's it — all guards, rate limiters, and UI derive from this registry.
 */
export const TIER_REGISTRY: Readonly<Record<UserTier, ITierConfig>> = {
    [UserTier.Anonymous]: { order: 0, rateLimit: 10, displayName: 'Anonymous', description: 'Unauthenticated user — basic access' },
    [UserTier.Free]: { order: 1, rateLimit: 60, displayName: 'Free', description: 'Registered free-tier user' },
    [UserTier.Pro]: { order: 2, rateLimit: 300, displayName: 'Pro', description: 'Paid pro-tier user — higher limits' },
    [UserTier.Admin]: { order: 3, rateLimit: Infinity, displayName: 'Admin', description: 'Administrator — unrestricted access' },
} as const;

/**
 * Rate limits per tier (requests per 60-second sliding window).
 * @deprecated Use {@link TIER_REGISTRY}[tier].rateLimit instead. Kept for backward compatibility.
 */
export const TIER_RATE_LIMITS: Readonly<Record<UserTier, number>> = {
    [UserTier.Anonymous]: TIER_REGISTRY[UserTier.Anonymous].rateLimit,
    [UserTier.Free]: TIER_REGISTRY[UserTier.Free].rateLimit,
    [UserTier.Pro]: TIER_REGISTRY[UserTier.Pro].rateLimit,
    [UserTier.Admin]: TIER_REGISTRY[UserTier.Admin].rateLimit,
} as const;

/**
 * Compare two tiers by rank. Returns true if `actual` >= `required`.
 */
export function isTierSufficient(actual: UserTier, required: UserTier): boolean {
    return TIER_REGISTRY[actual].order >= TIER_REGISTRY[required].order;
}

// ---------------------------------------------------------------------------
// Scope Registry — single source of truth for API scopes
// ---------------------------------------------------------------------------

/**
 * Enumeration of all API scopes. To add a new scope:
 *   1. Add the value here
 *   2. Add its config to {@link SCOPE_REGISTRY}
 */
export enum AuthScope {
    Compile = 'compile',
    Rules = 'rules',
    Admin = 'admin',
}

/**
 * Metadata for a single API scope.
 */
export interface IScopeConfig {
    /** Human-readable display name */
    readonly displayName: string;
    /** Short description shown in API key creation UI */
    readonly description: string;
    /** Minimum tier required to use this scope */
    readonly requiredTier: UserTier;
}

/**
 * Centralized scope registry — the single source of truth for scope
 * validation, descriptions, and tier requirements. To add a new scope:
 *   1. Add the value to {@link AuthScope}
 *   2. Add its config entry here
 */
export const SCOPE_REGISTRY: Readonly<Record<AuthScope, IScopeConfig>> = {
    [AuthScope.Compile]: {
        displayName: 'Compile',
        description: 'Compile and download filter lists',
        requiredTier: UserTier.Free,
    },
    [AuthScope.Rules]: {
        displayName: 'Rules',
        description: 'Create, read, update, and delete custom filter rules',
        requiredTier: UserTier.Free,
    },
    [AuthScope.Admin]: {
        displayName: 'Admin',
        description: 'Full administrative access — manage users, keys, and system config',
        requiredTier: UserTier.Admin,
    },
} as const;

/** All valid scope string values (derived from the registry). */
export const VALID_SCOPES: readonly string[] = Object.values(AuthScope);

/**
 * Type guard: checks whether a string is a valid {@link AuthScope}.
 */
export function isValidScope(value: string): value is AuthScope {
    return VALID_SCOPES.includes(value);
}

/**
 * Unified authentication context attached to every request.
 * Populated by the auth middleware chain (JWT → API key → anonymous).
 */
export interface IAuthContext {
    /** Internal database user ID (null for anonymous) */
    readonly userId: string | null;
    /** Clerk external user ID from JWT `sub` claim (null if not JWT-authenticated) */
    readonly clerkUserId: string | null;
    /** User tier determining rate limits and feature access */
    readonly tier: UserTier;
    /** User role from Clerk public metadata (e.g., 'admin', 'user') */
    readonly role: string;
    /** API key ID if authenticated via API key (null otherwise) */
    readonly apiKeyId: string | null;
    /** Clerk session ID from JWT `sid` claim (null if not JWT-authenticated) */
    readonly sessionId: string | null;
    /** Granted scopes (from API key permissions or JWT claims) */
    readonly scopes: readonly string[];
    /** Authentication method used for this request */
    readonly authMethod: 'clerk-jwt' | 'api-key' | 'anonymous';
}

/**
 * Clerk JWT payload claims.
 * @see https://clerk.com/docs/backend-requests/handling/manual-jwt
 */
export interface IClerkClaims {
    /** Clerk user ID (e.g., 'user_2abc123') */
    readonly sub: string;
    /** Issuer — Clerk instance URL (e.g., 'https://my-app.clerk.accounts.dev') */
    readonly iss: string;
    /** Expiration time (Unix timestamp) */
    readonly exp: number;
    /** Not before time (Unix timestamp) — optional in some Clerk token configurations */
    readonly nbf?: number;
    /** Issued at time (Unix timestamp) */
    readonly iat: number;
    /** Authorized party — the origin URL of the requesting application */
    readonly azp?: string;
    /** Clerk session ID */
    readonly sid?: string;
    /** Clerk organization ID (if using organizations) */
    readonly org_id?: string;
    /** Clerk organization role */
    readonly org_role?: string;
    /** Public metadata set on the user (contains role, tier) */
    readonly metadata?: IClerkPublicMetadata;
}

/**
 * Clerk user public metadata stored on the Clerk user object.
 * Set via Clerk Dashboard or Backend API.
 */
export interface IClerkPublicMetadata {
    /** User role (e.g., 'admin', 'user') */
    readonly role?: string;
    /** User tier override (normally derived from subscription) */
    readonly tier?: UserTier;
}

/**
 * Result of JWT verification via the Clerk JWKS middleware.
 */
export interface IJwtVerificationResult {
    /** Whether verification was successful */
    readonly valid: boolean;
    /** Decoded claims if valid */
    readonly claims?: IClerkClaims;
    /** Error message if invalid */
    readonly error?: string;
}

/**
 * Result of the unified authentication middleware chain.
 */
export interface IAuthMiddlewareResult {
    /** The resolved authentication context */
    readonly context: IAuthContext;
    /** Optional response to short-circuit the request (e.g., 401/403) */
    readonly response?: Response;
}

// ---------------------------------------------------------------------------
// Auth Provider Abstraction
// ---------------------------------------------------------------------------

/**
 * Result of JWT token verification from any auth provider.
 */
export interface IAuthProviderResult {
    /** Whether the token was valid */
    readonly valid: boolean;
    /** Unique user ID within the provider (e.g., Clerk's `user_2abc`) */
    readonly providerUserId?: string;
    /** User tier derived from provider metadata */
    readonly tier?: UserTier;
    /** User role derived from provider metadata */
    readonly role?: string;
    /** Session ID from the token */
    readonly sessionId?: string | null;
    /** Error message when invalid */
    readonly error?: string;
}

/**
 * Interface for pluggable authentication providers.
 *
 * Abstracts JWT verification and user metadata resolution so that swapping
 * from Clerk to Auth0, Okta, Firebase Auth, or a custom provider is a
 * single-line config change — implement this interface and pass the
 * instance to {@link authenticateRequestUnified}.
 *
 * @example
 * ```typescript
 * // Create a provider
 * const provider = new ClerkAuthProvider(env);
 *
 * // Use it for authentication
 * const result = await provider.verifyToken(request);
 * if (result.valid) {
 *     console.log('User:', result.providerUserId);
 * }
 * ```
 */
export interface IAuthProvider {
    /** Human-readable provider name (e.g., 'clerk', 'auth0', 'okta') */
    readonly name: string;

    /**
     * Verify a JWT token from the incoming request.
     * Implementations should:
     *   - Extract the token (Bearer header, cookie, etc.)
     *   - Verify signature against the provider's JWKS
     *   - Extract user ID, tier, role from the token/metadata
     *
     * @returns Provider result with user context or error
     */
    verifyToken(request: Request): Promise<IAuthProviderResult>;

    /**
     * Returns the auth method string used in {@link IAuthContext.authMethod}.
     * This allows the auth middleware to tag the context appropriately.
     */
    readonly authMethod: IAuthContext['authMethod'];
}

/**
 * Cloudflare Access JWT claims for admin route protection.
 * @see https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */
export interface ICfAccessClaims {
    /** Audience tag — matches the Access application AUD */
    readonly aud: readonly string[];
    /** Email of the authenticated user */
    readonly email: string;
    /** Expiration time (Unix timestamp) */
    readonly exp: number;
    /** Issued at time (Unix timestamp) */
    readonly iat: number;
    /** Not before time (Unix timestamp) */
    readonly nbf: number;
    /** Issuer — CF Access team domain */
    readonly iss: string;
    /** Subject (unique user identifier within CF Access) */
    readonly sub: string;
    /** Identity nonce for session binding */
    readonly identity_nonce?: string;
    /** Country of the request */
    readonly country?: string;
}

/**
 * Anonymous auth context — used when no authentication is provided.
 */
export const ANONYMOUS_AUTH_CONTEXT: IAuthContext = {
    userId: null,
    clerkUserId: null,
    tier: UserTier.Anonymous,
    role: 'anonymous',
    apiKeyId: null,
    sessionId: null,
    scopes: [],
    authMethod: 'anonymous',
} as const;

// ============================================================================
// Environment Bindings
// ============================================================================

/**
 * Priority levels for queue messages
 */
export type Priority = 'standard' | 'high';

/**
 * Environment bindings for the worker.
 */
export interface Env {
    COMPILER_VERSION: string;
    // KV namespaces
    COMPILATION_CACHE: KVNamespace;
    RATE_LIMIT: KVNamespace;
    METRICS: KVNamespace;
    // Static assets
    ASSETS?: Fetcher;
    // Queue bindings (optional - queues must be created in Cloudflare dashboard first)
    ADBLOCK_COMPILER_QUEUE?: Queue<QueueMessage>;
    ADBLOCK_COMPILER_QUEUE_HIGH_PRIORITY?: Queue<QueueMessage>;
    // Turnstile configuration
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    // Cloudflare Web Analytics token (injected into index.html at build time)
    CF_WEB_ANALYTICS_TOKEN?: string;
    // D1 Database binding (optional - for SQLite admin features)
    DB?: D1Database;
    // Admin D1 Database binding (isolated admin config: roles, flags, audit, tiers, scopes)
    ADMIN_DB?: D1Database;
    // Hyperdrive binding (optional - for PlanetScale PostgreSQL via Hyperdrive)
    HYPERDRIVE?: HyperdriveBinding;
    // Admin authentication key
    ADMIN_KEY?: string;
    // Request body size limit in megabytes (optional - defaults to 1MB)
    MAX_REQUEST_BODY_MB?: string;
    // Workflow bindings (optional - for durable execution)
    COMPILATION_WORKFLOW?: Workflow<CompilationParams>;
    BATCH_COMPILATION_WORKFLOW?: Workflow<BatchCompilationParams>;
    CACHE_WARMING_WORKFLOW?: Workflow<CacheWarmingParams>;
    HEALTH_MONITORING_WORKFLOW?: Workflow<HealthMonitoringParams>;
    // Analytics Engine binding (optional - for metrics tracking)
    ANALYTICS_ENGINE?: AnalyticsEngineDataset;
    // Analytics Engine SQL API credentials (required for GET /metrics/prometheus)
    // Set as Worker secrets: wrangler secret put ANALYTICS_ACCOUNT_ID
    //                        wrangler secret put ANALYTICS_API_TOKEN
    ANALYTICS_ACCOUNT_ID?: string;
    ANALYTICS_API_TOKEN?: string;
    // Cloudflare Pipelines binding (optional - for metrics/audit log ingestion)
    METRICS_PIPELINE?: PipelineBinding;
    // Error reporting configuration
    ERROR_REPORTER_TYPE?: string; // 'console', 'cloudflare', 'sentry', 'composite'
    SENTRY_DSN?: string; // Sentry Data Source Name (required if using Sentry)
    ERROR_REPORTER_VERBOSE?: string; // 'true' or 'false' for verbose console logging
    // Browser Rendering binding (for Cloudflare Browser Rendering / Playwright MCP)
    BROWSER?: BrowserWorker;
    // R2 bucket for browser-rendered screenshots (source monitor)
    FILTER_STORAGE?: R2Bucket;
    // Playwright MCP Agent Durable Object namespace
    MCP_AGENT?: DurableObjectNamespace;
    // Adblock Compiler container Durable Object namespace
    ADBLOCK_COMPILER?: DurableObjectNamespace;
    // KV namespace for persisted user rule sets (POST/GET/PUT/DELETE /api/rules)
    RULES_KV?: KVNamespace;
    // Webhook target URL for POST /api/notify (generic HTTP endpoint)
    WEBHOOK_URL?: string;
    // Datadog API key for POST /api/notify (optional third-party integration)
    DATADOG_API_KEY?: string;
    // --- Clerk Authentication ---
    /** Clerk secret key for backend API calls (secret — set via `wrangler secret put`) */
    CLERK_SECRET_KEY?: string;
    /** Clerk publishable key for frontend initialization (not secret — set as var) */
    CLERK_PUBLISHABLE_KEY?: string;
    /** Clerk JWKS URL for JWT verification (e.g., https://<instance>.clerk.accounts.dev/.well-known/jwks.json) */
    CLERK_JWKS_URL?: string;
    /** Clerk webhook signing secret for Svix signature verification (secret) */
    CLERK_WEBHOOK_SECRET?: string;
    // --- Cloudflare Access (admin route protection) ---
    /** Cloudflare Access team domain (e.g., 'myteam' for myteam.cloudflareaccess.com) */
    CF_ACCESS_TEAM_DOMAIN?: string;
    /** Cloudflare Access application audience (AUD) tag */
    CF_ACCESS_AUD?: string;
    // --- CORS ---
    /** Comma-separated list of allowed origins for CORS (public, not a secret — set in [vars]) */
    CORS_ALLOWED_ORIGINS?: string;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Compile request body structure.
 */
export interface CompileRequest {
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
    priority?: Priority;
    turnstileToken?: string;
}

/**
 * Batch compile request structure.
 */
export interface BatchRequest {
    requests: Array<{
        id: string;
        configuration: IConfiguration;
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>;
    priority?: Priority;
}

/**
 * AST parse request body.
 */
export interface ASTParseRequest {
    rules?: string[];
    text?: string;
}

/**
 * Admin SQL query request.
 */
export interface AdminQueryRequest {
    sql: string;
}

// ============================================================================
// Queue Message Types
// ============================================================================

/**
 * Queue message types for different operations
 */
export type QueueMessageType = 'compile' | 'batch-compile' | 'cache-warm';

/**
 * Base queue message structure
 */
export interface QueueMessage {
    type: QueueMessageType;
    requestId?: string;
    timestamp: number;
    priority?: Priority;
    /** Optional group identifier; jobs sharing a group can be cancelled or queried together */
    group?: string;
}

/**
 * Queue message for single compilation
 */
export interface CompileQueueMessage extends QueueMessage {
    type: 'compile';
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
}

/**
 * Queue message for batch compilation
 */
export interface BatchCompileQueueMessage extends QueueMessage {
    type: 'batch-compile';
    requests: Array<{
        id: string;
        configuration: IConfiguration;
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>;
}

/**
 * Queue message for cache warming
 */
export interface CacheWarmQueueMessage extends QueueMessage {
    type: 'cache-warm';
    configurations: IConfiguration[];
}

// ============================================================================
// Workflow Parameter Types
// ============================================================================

export interface CompilationParams {
    requestId: string;
    configuration: IConfiguration;
    preFetchedContent?: Record<string, string>;
    benchmark?: boolean;
    priority?: Priority;
    queuedAt: number;
}

export interface BatchCompilationParams {
    batchId: string;
    requests: Array<{
        id: string;
        configuration: IConfiguration;
        preFetchedContent?: Record<string, string>;
        benchmark?: boolean;
    }>;
    priority?: Priority;
    queuedAt: number;
}

export interface CacheWarmingParams {
    runId: string;
    configurations: IConfiguration[];
    scheduled: boolean;
}

export interface HealthMonitoringParams {
    runId: string;
    sources: Array<{
        name: string;
        url: string;
        expectedMinRules?: number;
    }>;
    alertOnFailure: boolean;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Result of a compilation with metrics
 */
export interface CompilationResult {
    success: boolean;
    rules?: string[];
    ruleCount?: number;
    metrics?: CompilationMetrics;
    error?: string;
    compiledAt?: string;
    previousVersion?: PreviousVersion;
    cached?: boolean;
    deduplicated?: boolean;
}

export interface CompilationMetrics {
    totalDuration?: number;
    sourceCount?: number;
    transformationCount?: number;
    inputRuleCount?: number;
    outputRuleCount?: number;
    phases?: Record<string, number>;
}

export interface PreviousVersion {
    rules: string[];
    ruleCount: number;
    compiledAt: string;
}

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Rate limit data structure
 */
export interface RateLimitData {
    count: number;
    resetAt: number;
}

/**
 * Endpoint metrics structure
 */
export interface EndpointMetrics {
    count: number;
    success: number;
    failed: number;
    totalDuration: number;
    errors: Record<string, number>;
}

/**
 * Aggregated metrics response
 */
export interface AggregatedMetrics {
    window: string;
    timestamp: string;
    endpoints: Record<string, EndpointMetricsDisplay>;
}

export interface EndpointMetricsDisplay {
    count: number;
    success: number;
    failed: number;
    avgDuration: number;
    errors: Record<string, number>;
}

/**
 * Job history entry
 */
export interface JobHistoryEntry {
    requestId: string;
    configName: string;
    status: 'completed' | 'failed' | 'cancelled';
    duration: number;
    timestamp: string;
    error?: string;
    ruleCount?: number;
    cacheKey?: string;
}

/**
 * Queue depth history entry
 */
export interface DepthHistoryEntry {
    timestamp: string;
    pending: number;
}

/**
 * Queue statistics structure with history
 */
export interface QueueStats {
    pending: number;
    completed: number;
    failed: number;
    cancelled: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    processingRate: number;
    queueLag: number;
    lastUpdate: string;
    history: JobHistoryEntry[];
    depthHistory: DepthHistoryEntry[];
}

/**
 * Job info for queue stat updates
 */
export interface JobInfo {
    requestId?: string;
    configName?: string;
    error?: string;
    ruleCount?: number;
    cacheKey?: string;
}

// ============================================================================
// Turnstile Types
// ============================================================================

/**
 * Turnstile verification response
 */
export interface TurnstileVerifyResponse {
    success: boolean;
    challenge_ts?: string;
    hostname?: string;
    'error-codes'?: string[];
    action?: string;
    cdata?: string;
}

/**
 * Turnstile verification result
 */
export interface TurnstileResult {
    success: boolean;
    error?: string;
}

// ============================================================================
// Admin Types
// ============================================================================

/**
 * Admin auth result
 */
export interface AdminAuthResult {
    authorized: boolean;
    error?: string;
}

/**
 * Storage stats response
 */
export interface StorageStats {
    storage_entries: number;
    filter_cache: number;
    compilation_metadata: number;
    expired_storage: number;
    expired_cache: number;
}

/**
 * Table info from sqlite_master
 */
export interface TableInfo {
    name: string;
    type: string;
}

// ============================================================================
// Workflow Event Types
// ============================================================================

export interface WorkflowEvent {
    type: string;
    workflowId: string;
    workflowType: string;
    timestamp: string;
    step?: string;
    progress?: number;
    message?: string;
    data?: Record<string, unknown>;
}

export interface WorkflowEventLog {
    workflowId: string;
    workflowType: string;
    startedAt: string;
    completedAt?: string;
    events: WorkflowEvent[];
}

export interface WorkflowMetrics {
    totalCompilations?: number;
    totalBatches?: number;
    totalRuns?: number;
    totalChecks?: number;
}

// ============================================================================
// Browser Rendering Types
// ============================================================================

/**
 * Playwright page-load strategy shared by browser-rendering endpoints.
 * `'networkidle'` waits for network activity to settle (most reliable for SPAs).
 * `'load'` waits only for the `load` event (faster; suitable for static pages).
 * `'domcontentloaded'` is the fastest option; only waits for HTML parsing.
 */
export type BrowserWaitUntil = 'load' | 'domcontentloaded' | 'networkidle';

/**
 * Request body for `POST /api/browser/resolve-url`.
 */
export interface UrlResolveRequest {
    /** The URL to navigate to and resolve. */
    url: string;
    /** Navigation timeout in milliseconds. @default 30_000 */
    timeout?: number;
    /** Playwright page-load strategy. @default 'networkidle' */
    waitUntil?: BrowserWaitUntil;
}

/**
 * Response body for `POST /api/browser/resolve-url`.
 */
export interface UrlResolveResponse {
    success: true;
    /** The canonical URL after all JavaScript redirects have settled. */
    resolvedUrl: string;
    /** The original URL that was submitted. */
    originalUrl: string;
}

/**
 * Request body for `POST /api/browser/monitor`.
 */
export interface SourceMonitorRequest {
    /** Array of URLs to health-check (max 10). */
    urls: string[];
    /** When `true`, a PNG screenshot is captured and stored per URL. @default false */
    captureScreenshots?: boolean;
    /** R2 object key prefix for screenshots. Defaults to the current ISO date. */
    screenshotPrefix?: string;
    /** Navigation timeout per URL in milliseconds. @default 30_000 */
    timeout?: number;
    /** Playwright page-load strategy applied to every URL. @default 'networkidle' */
    waitUntil?: BrowserWaitUntil;
}

/**
 * Per-URL result inside a {@link SourceMonitorResponse}.
 */
export interface SourceMonitorResult {
    /** The URL that was checked. */
    url: string;
    /** Whether the URL was reachable and returned non-empty content. */
    reachable: boolean;
    /** HTTP-like status code returned by the browser navigation. */
    status?: number;
    /** Error message when `reachable` is `false`. */
    error?: string;
    /** R2 object key for the screenshot, when captured. */
    screenshotKey?: string;
    /** ISO timestamp of the check. */
    checkedAt: string;
}

/**
 * Response body for `POST /api/browser/monitor`.
 */
export interface SourceMonitorResponse {
    success: true;
    results: SourceMonitorResult[];
    /** Total number of URLs checked. */
    total: number;
    /** Number of reachable URLs. */
    reachable: number;
    /** Number of unreachable URLs. */
    unreachable: number;
}
