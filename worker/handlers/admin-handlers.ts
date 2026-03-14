/**
 * Admin System API Handlers — handler functions for all admin system endpoints.
 *
 * Each exported handler follows a consistent pattern:
 *  1. Guard with `requireAdminPermission()` or `extractAdminContext()`.
 *  2. Validate the request body/params with Zod.
 *  3. Call the relevant service function.
 *  4. Write an audit log entry for mutations.
 *  5. Invalidate caches where applicable.
 *  6. Fire analytics events.
 *  7. Return `JsonResponse.success()` / `JsonResponse.error()`.
 *
 * All handlers accept the standard `(request, env, params)` signature used by
 * the router, where `params.pathParams` carries named URL segments.
 *
 * @module admin-handlers
 */

import type { Env } from '../types.ts';
import { JsonResponse } from '../utils/response.ts';
import {
    AssignRoleRequestSchema,
    AuditLogQuerySchema,
    CreateAdminRoleRequestSchema,
    CreateAnnouncementRequestSchema,
    CreateEndpointOverrideRequestSchema,
    CreateFeatureFlagRequestSchema,
    UpdateAdminRoleRequestSchema,
    UpdateAnnouncementRequestSchema,
    UpdateEndpointOverrideRequestSchema,
    UpdateFeatureFlagRequestSchema,
    UpdateScopeConfigRequestSchema,
    UpdateTierConfigRequestSchema,
} from '../schemas.ts';
import { extractAdminContext, requireAdminPermission } from '../middleware/admin-role-middleware.ts';
import { assignRole, createRole, invalidateRoleCache, listRoleAssignments, listRoles, revokeRole, updateRole } from '../services/admin-role-service.ts';
import {
    createAnnouncement,
    createEndpointOverride,
    deleteAnnouncement,
    deleteEndpointOverride,
    getEndpointOverride,
    getScopeConfig,
    getTierConfig,
    listAnnouncements,
    listEndpointOverrides,
    listScopeConfigs,
    listTierConfigs,
    updateAnnouncement,
    updateEndpointOverride,
    updateScopeConfig,
    updateTierConfig,
} from '../services/admin-config-service.ts';
import { createAuditContext, queryAuditLogs, writeAuditLog } from '../services/admin-audit-service.ts';
import { createFeatureFlag, deleteFeatureFlag, getFeatureFlag, listFeatureFlags, updateFeatureFlag } from '../services/admin-feature-flag-service.ts';
import { invalidateScopeCache, invalidateTierCache } from '../services/admin-registry-service.ts';
import { trackAdminAction, trackAdminConfigChange } from '../services/admin-analytics-events.ts';
import { createAdminLogger, createRequestId, withAdminTracing } from '../services/admin-logger.ts';

// ---------------------------------------------------------------------------
// Router parameter types (mirrors worker/router.ts RouteParams)
// ---------------------------------------------------------------------------

/** Route parameters forwarded by the router. */
interface RouteParams {
    pathname: string;
    searchParams: URLSearchParams;
    ip: string;
    requestId: string;
    pathParams: Record<string, string>;
}

// ---------------------------------------------------------------------------
// D1 type compatibility shim
// ---------------------------------------------------------------------------

/**
 * Cast the project's D1Database interface (worker/types.ts) to the global
 * `@cloudflare/workers-types` D1Database expected by admin-role-service.
 *
 * The project interface omits the `withSession` method, but the two are
 * otherwise structurally identical for every operation used at runtime.
 * This is a pre-existing type gap also present in admin-role-middleware.ts.
 *
 * @internal
 */
// deno-lint-ignore no-explicit-any
const asCfDb = (db: unknown): any => db;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse a JSON request body, returning the parsed value or an error `Response`.
 * @internal
 */
async function parseJsonBody(request: Request): Promise<{ data: unknown } | Response> {
    try {
        const data: unknown = await request.json();
        return { data };
    } catch {
        return JsonResponse.badRequest('Invalid JSON body');
    }
}

/**
 * Return the client IP from a request (CF header → X-Forwarded-For → 'unknown').
 * @internal
 */
function getIp(request: Request): string {
    return request.headers.get('cf-connecting-ip') ??
        request.headers.get('x-forwarded-for') ??
        'unknown';
}

/**
 * Guard helper that ensures ADMIN_DB is configured. Returns an error response
 * if the binding is missing, or `null` if it's present.
 * @internal
 */
function requireAdminDb(env: Env): Response | null {
    if (!env.ADMIN_DB) {
        return JsonResponse.error('Admin system not configured', 503);
    }
    return null;
}

// ============================================================================
//  Role Management
// ============================================================================

/**
 * GET — List all admin roles.
 * Permission: `admin:read`
 */
export async function handleAdminListRoles(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('admin:read')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('role.list').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'role.list', async () => {
        const roles = await listRoles(asCfDb(env.ADMIN_DB));
        return JsonResponse.success({ items: roles, total: roles.length });
    });
}

/**
 * POST — Create a new admin role.
 * Permission: `roles:write`
 */
export async function handleAdminCreateRole(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('roles:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    const parsed = CreateAdminRoleRequestSchema.safeParse(body.data);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('role.create').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'role.create', async () => {
        const role = await createRole(asCfDb(env.ADMIN_DB), parsed.data);
        if (!role) return JsonResponse.error('Failed to create role', 500);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'role.create',
            resource_type: 'admin_role',
            resource_id: role.role_name,
            new_values: role,
            status: 'success',
        });

        trackAdminAction(env, {
            action: 'role.create',
            resourceType: 'admin_role',
            resourceId: role.role_name,
            actorId: guard.adminContext.clerk_user_id,
            ip: getIp(request),
            success: true,
        });

        return JsonResponse.success({ role }, { status: 201 });
    });
}

/**
 * PATCH — Update an existing admin role.
 * Permission: `roles:write`
 * URL param: `params.pathParams.name` — the role name.
 */
export async function handleAdminUpdateRole(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('roles:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const roleName = params.pathParams.name;
    if (!roleName) return JsonResponse.badRequest('Missing role name in URL');

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    const parsed = UpdateAdminRoleRequestSchema.safeParse(body.data);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('role.update').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'role.update', async () => {
        const oldRole = await listRoles(asCfDb(env.ADMIN_DB)).then((r) => r.find((x) => x.role_name === roleName));
        const updated = await updateRole(asCfDb(env.ADMIN_DB), roleName, parsed.data);
        if (!updated) return JsonResponse.error('Role not found', 404);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'role.update',
            resource_type: 'admin_role',
            resource_id: roleName,
            old_values: oldRole ?? null,
            new_values: updated,
            status: 'success',
        });

        trackAdminAction(env, {
            action: 'role.update',
            resourceType: 'admin_role',
            resourceId: roleName,
            actorId: guard.adminContext.clerk_user_id,
            ip: getIp(request),
            success: true,
        });

        return JsonResponse.success({ role: updated });
    });
}

/**
 * GET — List role assignments (with optional query-string filters).
 * Permission: `admin:read`
 */
export async function handleAdminListAssignments(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('admin:read')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('role.listAssignments').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'role.listAssignments', async () => {
        const filters: { clerk_user_id?: string; role_name?: string } = {};
        const userId = params.searchParams.get('clerk_user_id');
        const roleName = params.searchParams.get('role_name');
        if (userId) filters.clerk_user_id = userId;
        if (roleName) filters.role_name = roleName;

        const assignments = await listRoleAssignments(asCfDb(env.ADMIN_DB), filters);
        return JsonResponse.success({ items: assignments, total: assignments.length });
    });
}

/**
 * POST — Assign a role to a Clerk user.
 * Permission: `roles:assign`
 */
export async function handleAdminAssignRole(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('roles:assign')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    const parsed = AssignRoleRequestSchema.safeParse(body.data);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('role.assign').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'role.assign', async () => {
        const assignment = await assignRole(asCfDb(env.ADMIN_DB), parsed.data, guard.adminContext.clerk_user_id);
        if (!assignment) return JsonResponse.error('Failed to assign role', 500);

        // Invalidate the target user's role cache so next request fetches fresh context.
        await invalidateRoleCache(env.RATE_LIMIT, parsed.data.clerk_user_id);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'role.assign',
            resource_type: 'admin_role_assignment',
            resource_id: `${parsed.data.clerk_user_id}:${parsed.data.role_name}`,
            new_values: assignment,
            status: 'success',
        });

        trackAdminAction(env, {
            action: 'role.assign',
            resourceType: 'admin_role_assignment',
            resourceId: parsed.data.clerk_user_id,
            actorId: guard.adminContext.clerk_user_id,
            ip: getIp(request),
            success: true,
        });

        return JsonResponse.success({ assignment }, { status: 201 });
    });
}

/**
 * DELETE — Revoke a role from a Clerk user.
 * Permission: `roles:assign`
 * Body: `{ clerk_user_id, role_name }`
 */
export async function handleAdminRevokeRole(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('roles:assign')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    // Reuse AssignRoleRequestSchema — same shape (clerk_user_id + role_name).
    const parsed = AssignRoleRequestSchema.safeParse(body.data);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('role.revoke').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'role.revoke', async () => {
        const deleted = await revokeRole(asCfDb(env.ADMIN_DB), parsed.data.clerk_user_id, parsed.data.role_name);
        if (!deleted) return JsonResponse.error('Role assignment not found', 404);

        // Invalidate the target user's role cache.
        await invalidateRoleCache(env.RATE_LIMIT, parsed.data.clerk_user_id);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'role.revoke',
            resource_type: 'admin_role_assignment',
            resource_id: `${parsed.data.clerk_user_id}:${parsed.data.role_name}`,
            old_values: { clerk_user_id: parsed.data.clerk_user_id, role_name: parsed.data.role_name },
            status: 'success',
        });

        trackAdminAction(env, {
            action: 'role.revoke',
            resourceType: 'admin_role_assignment',
            resourceId: parsed.data.clerk_user_id,
            actorId: guard.adminContext.clerk_user_id,
            ip: getIp(request),
            success: true,
        });

        return JsonResponse.success({ message: 'Role assignment revoked' });
    });
}

/**
 * GET — Get the current admin's permissions (no specific permission required).
 */
export async function handleAdminGetMyPermissions(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await extractAdminContext(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    return JsonResponse.success({
        clerk_user_id: guard.adminContext.clerk_user_id,
        role_name: guard.adminContext.role_name,
        permissions: guard.adminContext.permissions,
        expires_at: guard.adminContext.expires_at,
    });
}

// ============================================================================
//  Tier Config
// ============================================================================

/**
 * GET — List all tier configurations.
 * Permission: `admin:read`
 */
export async function handleAdminListTiers(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('admin:read')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('tier.list').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'tier.list', async () => {
        const tiers = await listTierConfigs(env.ADMIN_DB!);
        return JsonResponse.success({ items: tiers, total: tiers.length });
    });
}

/**
 * POST — Update (upsert-style) a tier configuration.
 * Permission: `config:write`
 * Body: `UpdateTierConfigRequest` + `tier_name` identifying the tier.
 */
export async function handleAdminUpdateTier(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('config:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    // Extract tier_name from body or URL.
    const rawBody = body.data as Record<string, unknown>;
    const tierName = (params.pathParams.name as string) || (rawBody.tier_name as string);
    if (!tierName) return JsonResponse.badRequest('Missing tier_name');

    const parsed = UpdateTierConfigRequestSchema.safeParse(rawBody);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('tier.update').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'tier.update', async () => {
        const oldTier = await getTierConfig(env.ADMIN_DB!, tierName);
        const updated = await updateTierConfig(env.ADMIN_DB!, tierName, parsed.data);
        if (!updated) return JsonResponse.error('Tier not found', 404);

        // Invalidate KV cache so next request fetches fresh tier data.
        await invalidateTierCache(env.RATE_LIMIT);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'tier.update',
            resource_type: 'tier_config',
            resource_id: tierName,
            old_values: oldTier,
            new_values: updated,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'tier',
            action: 'update',
            configId: tierName,
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ tier: updated });
    });
}

/**
 * DELETE — Soft-delete a tier configuration (sets is_active = false).
 * Permission: `config:write`
 * URL param: `params.pathParams.name` — the tier name.
 */
export async function handleAdminDeleteTier(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('config:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const tierName = params.pathParams.name;
    if (!tierName) return JsonResponse.badRequest('Missing tier name in URL');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('tier.delete').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'tier.delete', async () => {
        const oldTier = await getTierConfig(env.ADMIN_DB!, tierName);
        if (!oldTier) return JsonResponse.error('Tier not found', 404);

        // Soft-delete via update (no hard-delete function exists for tiers).
        const updated = await updateTierConfig(env.ADMIN_DB!, tierName, { is_active: false });

        await invalidateTierCache(env.RATE_LIMIT);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'tier.delete',
            resource_type: 'tier_config',
            resource_id: tierName,
            old_values: oldTier,
            new_values: updated,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'tier',
            action: 'delete',
            configId: tierName,
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ message: 'Tier deactivated' });
    });
}

// ============================================================================
//  Scope Config
// ============================================================================

/**
 * GET — List all scope configurations.
 * Permission: `admin:read`
 */
export async function handleAdminListScopes(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('admin:read')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('scope.list').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'scope.list', async () => {
        const scopes = await listScopeConfigs(env.ADMIN_DB!);
        return JsonResponse.success({ items: scopes, total: scopes.length });
    });
}

/**
 * POST — Update a scope configuration.
 * Permission: `config:write`
 * Body: `UpdateScopeConfigRequest` + `scope_name` identifying the scope.
 */
export async function handleAdminUpdateScope(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('config:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    const rawBody = body.data as Record<string, unknown>;
    const scopeName = (params.pathParams.name as string) || (rawBody.scope_name as string);
    if (!scopeName) return JsonResponse.badRequest('Missing scope_name');

    const parsed = UpdateScopeConfigRequestSchema.safeParse(rawBody);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('scope.update').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'scope.update', async () => {
        const oldScope = await getScopeConfig(env.ADMIN_DB!, scopeName);
        const updated = await updateScopeConfig(env.ADMIN_DB!, scopeName, parsed.data);
        if (!updated) return JsonResponse.error('Scope not found', 404);

        await invalidateScopeCache(env.RATE_LIMIT);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'scope.update',
            resource_type: 'scope_config',
            resource_id: scopeName,
            old_values: oldScope,
            new_values: updated,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'scope',
            action: 'update',
            configId: scopeName,
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ scope: updated });
    });
}

/**
 * DELETE — Soft-delete a scope configuration (sets is_active = false).
 * Permission: `config:write`
 * URL param: `params.pathParams.name` — the scope name.
 */
export async function handleAdminDeleteScope(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('config:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const scopeName = params.pathParams.name;
    if (!scopeName) return JsonResponse.badRequest('Missing scope name in URL');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('scope.delete').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'scope.delete', async () => {
        const oldScope = await getScopeConfig(env.ADMIN_DB!, scopeName);
        if (!oldScope) return JsonResponse.error('Scope not found', 404);

        const updated = await updateScopeConfig(env.ADMIN_DB!, scopeName, { is_active: false });

        await invalidateScopeCache(env.RATE_LIMIT);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'scope.delete',
            resource_type: 'scope_config',
            resource_id: scopeName,
            old_values: oldScope,
            new_values: updated,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'scope',
            action: 'delete',
            configId: scopeName,
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ message: 'Scope deactivated' });
    });
}

// ============================================================================
//  Endpoint Auth Overrides
// ============================================================================

/**
 * GET — List all endpoint auth overrides.
 * Permission: `admin:read`
 */
export async function handleAdminListEndpointOverrides(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('admin:read')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('endpoint.list').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'endpoint.list', async () => {
        const overrides = await listEndpointOverrides(env.ADMIN_DB!);
        return JsonResponse.success({ items: overrides, total: overrides.length });
    });
}

/**
 * POST — Create a new endpoint auth override.
 * Permission: `config:write`
 */
export async function handleAdminCreateEndpointOverride(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('config:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    const parsed = CreateEndpointOverrideRequestSchema.safeParse(body.data);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('endpoint.create').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'endpoint.create', async () => {
        const override = await createEndpointOverride(env.ADMIN_DB!, parsed.data);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'endpoint.create',
            resource_type: 'endpoint_auth_override',
            resource_id: String(override.id),
            new_values: override,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'endpoint',
            action: 'create',
            configId: String(override.id),
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ override }, { status: 201 });
    });
}

/**
 * PATCH — Update an endpoint auth override.
 * Permission: `config:write`
 * URL param: `params.pathParams.id` — the override numeric ID.
 */
export async function handleAdminUpdateEndpointOverride(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('config:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const id = Number(params.pathParams.id);
    if (!Number.isFinite(id)) return JsonResponse.badRequest('Invalid endpoint override ID');

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    const parsed = UpdateEndpointOverrideRequestSchema.safeParse(body.data);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('endpoint.update').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'endpoint.update', async () => {
        const oldOverride = await getEndpointOverride(env.ADMIN_DB!, id);
        const updated = await updateEndpointOverride(env.ADMIN_DB!, id, parsed.data);
        if (!updated) return JsonResponse.error('Endpoint override not found', 404);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'endpoint.update',
            resource_type: 'endpoint_auth_override',
            resource_id: String(id),
            old_values: oldOverride,
            new_values: updated,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'endpoint',
            action: 'update',
            configId: String(id),
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ override: updated });
    });
}

/**
 * DELETE — Soft-delete an endpoint auth override (sets is_active = 0).
 * Permission: `config:write`
 * URL param: `params.pathParams.id` — the override numeric ID.
 */
export async function handleAdminDeleteEndpointOverride(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('config:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const id = Number(params.pathParams.id);
    if (!Number.isFinite(id)) return JsonResponse.badRequest('Invalid endpoint override ID');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('endpoint.delete').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'endpoint.delete', async () => {
        const oldOverride = await getEndpointOverride(env.ADMIN_DB!, id);
        if (!oldOverride) return JsonResponse.error('Endpoint override not found', 404);

        const deleted = await deleteEndpointOverride(env.ADMIN_DB!, id);
        if (!deleted) return JsonResponse.error('Failed to delete endpoint override', 500);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'endpoint.delete',
            resource_type: 'endpoint_auth_override',
            resource_id: String(id),
            old_values: oldOverride,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'endpoint',
            action: 'delete',
            configId: String(id),
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ message: 'Endpoint override deactivated' });
    });
}

// ============================================================================
//  Feature Flags
// ============================================================================

/**
 * GET — List all feature flags.
 * Permission: `admin:read`
 */
export async function handleAdminListFlags(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('admin:read')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('flag.list').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'flag.list', async () => {
        const flags = await listFeatureFlags(env.ADMIN_DB!);
        return JsonResponse.success({ items: flags, total: flags.length });
    });
}

/**
 * POST — Create a new feature flag.
 * Permission: `flags:write`
 */
export async function handleAdminCreateFlag(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('flags:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    const parsed = CreateFeatureFlagRequestSchema.safeParse(body.data);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('flag.create').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'flag.create', async () => {
        const flag = await createFeatureFlag(env.ADMIN_DB!, parsed.data, guard.adminContext.clerk_user_id);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'flag.create',
            resource_type: 'feature_flag',
            resource_id: flag.flag_name,
            new_values: flag,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'flag',
            action: 'create',
            configId: flag.flag_name,
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ flag }, { status: 201 });
    });
}

/**
 * PATCH — Update an existing feature flag.
 * Permission: `flags:write`
 * URL param: `params.pathParams.name` — the flag name.
 */
export async function handleAdminUpdateFlag(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('flags:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const flagName = params.pathParams.name;
    if (!flagName) return JsonResponse.badRequest('Missing flag name in URL');

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    const parsed = UpdateFeatureFlagRequestSchema.safeParse(body.data);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('flag.update').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'flag.update', async () => {
        const oldFlag = await getFeatureFlag(env.ADMIN_DB!, flagName);
        const updated = await updateFeatureFlag(env.ADMIN_DB!, flagName, parsed.data);
        if (!updated) return JsonResponse.error('Feature flag not found', 404);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'flag.update',
            resource_type: 'feature_flag',
            resource_id: flagName,
            old_values: oldFlag,
            new_values: updated,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'flag',
            action: 'update',
            configId: flagName,
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ flag: updated });
    });
}

/**
 * DELETE — Hard-delete a feature flag.
 * Permission: `flags:write`
 * URL param: `params.pathParams.name` — the flag name.
 */
export async function handleAdminDeleteFlag(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('flags:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const flagName = params.pathParams.name;
    if (!flagName) return JsonResponse.badRequest('Missing flag name in URL');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('flag.delete').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'flag.delete', async () => {
        const oldFlag = await getFeatureFlag(env.ADMIN_DB!, flagName);
        if (!oldFlag) return JsonResponse.error('Feature flag not found', 404);

        const deleted = await deleteFeatureFlag(env.ADMIN_DB!, flagName);
        if (!deleted) return JsonResponse.error('Failed to delete feature flag', 500);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'flag.delete',
            resource_type: 'feature_flag',
            resource_id: flagName,
            old_values: oldFlag,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'flag',
            action: 'delete',
            configId: flagName,
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ message: 'Feature flag deleted' });
    });
}

// ============================================================================
//  Audit Log
// ============================================================================

/**
 * GET — Query audit logs with optional filters from query string.
 * Permission: `audit:read`
 *
 * Supported query params: actor_id, action, resource_type, resource_id,
 * status, since, until, limit, offset.
 */
export async function handleAdminQueryAuditLogs(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('audit:read')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    // Build AuditLogQuery from query-string parameters.
    const sp = params.searchParams;
    const rawQuery: Record<string, unknown> = {};
    for (const key of ['actor_id', 'action', 'resource_type', 'resource_id', 'status', 'since', 'until']) {
        const val = sp.get(key);
        if (val !== null) rawQuery[key] = val;
    }
    const limitStr = sp.get('limit');
    if (limitStr) rawQuery.limit = Number(limitStr);
    const offsetStr = sp.get('offset');
    if (offsetStr) rawQuery.offset = Number(offsetStr);

    const parsed = AuditLogQuerySchema.safeParse(rawQuery);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid query parameters');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('audit.query').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'audit.query', async () => {
        const result = await queryAuditLogs(env.ADMIN_DB!, parsed.data);
        return JsonResponse.success({
            items: result.items,
            total: result.total,
            limit: parsed.data.limit,
            offset: parsed.data.offset,
        });
    });
}

// ============================================================================
//  Announcements
// ============================================================================

/**
 * GET — List all announcements.
 * Permission: `admin:read`
 */
export async function handleAdminListAnnouncements(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('admin:read')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('announcement.list').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'announcement.list', async () => {
        const announcements = await listAnnouncements(env.ADMIN_DB!);
        return JsonResponse.success({ items: announcements, total: announcements.length });
    });
}

/**
 * POST — Create a new announcement.
 * Permission: `config:write`
 */
export async function handleAdminCreateAnnouncement(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('config:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    const parsed = CreateAnnouncementRequestSchema.safeParse(body.data);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('announcement.create').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'announcement.create', async () => {
        const announcement = await createAnnouncement(env.ADMIN_DB!, parsed.data, guard.adminContext.clerk_user_id);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'announcement.create',
            resource_type: 'admin_announcement',
            resource_id: String(announcement.id),
            new_values: announcement,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'announcement',
            action: 'create',
            configId: String(announcement.id),
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ announcement }, { status: 201 });
    });
}

/**
 * PATCH — Update an existing announcement.
 * Permission: `config:write`
 * URL param: `params.pathParams.id` — the announcement numeric ID.
 */
export async function handleAdminUpdateAnnouncement(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('config:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const id = Number(params.pathParams.id);
    if (!Number.isFinite(id)) return JsonResponse.badRequest('Invalid announcement ID');

    const body = await parseJsonBody(request);
    if (body instanceof Response) return body;

    const parsed = UpdateAnnouncementRequestSchema.safeParse(body.data);
    if (!parsed.success) return JsonResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('announcement.update').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'announcement.update', async () => {
        // Fetch old state for audit diff.
        const allAnnouncements = await listAnnouncements(env.ADMIN_DB!);
        const oldAnnouncement = allAnnouncements.find((a) => a.id === id);

        const updated = await updateAnnouncement(env.ADMIN_DB!, id, parsed.data);
        if (!updated) return JsonResponse.error('Announcement not found', 404);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'announcement.update',
            resource_type: 'admin_announcement',
            resource_id: String(id),
            old_values: oldAnnouncement ?? null,
            new_values: updated,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'announcement',
            action: 'update',
            configId: String(id),
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ announcement: updated });
    });
}

/**
 * DELETE — Soft-delete an announcement (sets is_active = 0).
 * Permission: `config:write`
 * URL param: `params.pathParams.id` — the announcement numeric ID.
 */
export async function handleAdminDeleteAnnouncement(
    request: Request,
    env: Env,
    params: RouteParams,
): Promise<Response> {
    const guard = await requireAdminPermission('config:write')(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const id = Number(params.pathParams.id);
    if (!Number.isFinite(id)) return JsonResponse.badRequest('Invalid announcement ID');

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('announcement.delete').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'announcement.delete', async () => {
        const allAnnouncements = await listAnnouncements(env.ADMIN_DB!);
        const oldAnnouncement = allAnnouncements.find((a) => a.id === id);
        if (!oldAnnouncement) return JsonResponse.error('Announcement not found', 404);

        const deleted = await deleteAnnouncement(env.ADMIN_DB!, id);
        if (!deleted) return JsonResponse.error('Failed to delete announcement', 500);

        await writeAuditLog(env.ADMIN_DB!, {
            ...createAuditContext(request, guard.adminContext),
            action: 'announcement.delete',
            resource_type: 'admin_announcement',
            resource_id: String(id),
            old_values: oldAnnouncement,
            status: 'success',
        });

        trackAdminConfigChange(env, {
            configType: 'announcement',
            action: 'delete',
            configId: String(id),
            actorId: guard.adminContext.clerk_user_id,
        });

        return JsonResponse.success({ message: 'Announcement deactivated' });
    });
}

// ============================================================================
//  My Context (combined dashboard context)
// ============================================================================

/**
 * GET — Return the authenticated admin's full context: role, permissions,
 * active announcements, and enabled feature flags.
 *
 * No specific permission required — any authenticated admin can call this.
 */
export async function handleAdminGetMyContext(
    request: Request,
    env: Env,
    _params: RouteParams,
): Promise<Response> {
    const guard = await extractAdminContext(request, env);
    if (!guard.authorized) return JsonResponse.error(guard.error, guard.statusCode);

    const dbGuard = requireAdminDb(env);
    if (dbGuard) return dbGuard;

    const reqId = createRequestId();
    const logger = createAdminLogger(reqId).withOperation('context.my').withActor(guard.adminContext.clerk_user_id);

    return withAdminTracing(logger, 'context.my', async () => {
        // Fetch supplementary context in parallel.
        const [announcements, flags] = await Promise.all([
            listAnnouncements(env.ADMIN_DB!, true).catch(() => []),
            listFeatureFlags(env.ADMIN_DB!, true).catch(() => []),
        ]);

        return JsonResponse.success({
            admin: {
                clerk_user_id: guard.adminContext.clerk_user_id,
                role_name: guard.adminContext.role_name,
                permissions: guard.adminContext.permissions,
                expires_at: guard.adminContext.expires_at,
            },
            announcements,
            feature_flags: flags.map((f) => ({ flag_name: f.flag_name, enabled: f.enabled })),
        });
    });
}
