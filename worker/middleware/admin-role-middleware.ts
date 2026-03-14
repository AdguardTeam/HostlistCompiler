/**
 * @module admin-role-middleware
 *
 * Permission-checking middleware for the admin system.
 *
 * Provides higher-order guard functions that verify Clerk JWT authentication
 * and check granular permissions against the admin role system.  Each guard
 * returns an {@link AdminGuardResult} discriminated union so callers can
 * branch on `authorized` without type narrowing gymnastics.
 *
 * **Super-admin bypass**: users whose resolved role is `super-admin` skip
 * individual permission checks entirely (analogous to Unix root).
 */

import type { Env } from '../types.ts';
import type { ResolvedAdminContext } from '../schemas.ts';
import { ClerkAuthProvider } from './clerk-auth-provider.ts';
import { resolveAdminContext } from '../services/admin-role-service.ts';

/* ------------------------------------------------------------------ */
/*  Re-exported types                                                  */
/* ------------------------------------------------------------------ */

/** Type-safe permission string derived from {@link AdminPermissionSchema}. */
export type { AdminPermission } from '../schemas.ts';

// Local alias so the rest of this module can reference it without a
// second import-type statement.
import type { AdminPermission } from '../schemas.ts';

/**
 * Discriminated-union result returned by every admin guard function.
 *
 * - `authorized: true`  → the caller may proceed; `adminContext` is attached.
 * - `authorized: false` → the caller should return an error response using
 *   the provided `statusCode` and `error` message.
 */
export type AdminGuardResult =
    | { authorized: true; adminContext: ResolvedAdminContext }
    | { authorized: false; error: string; statusCode: number };

/** Signature shared by all guard functions returned from the higher-order helpers. */
type AdminGuardFn = (request: Request, env: Env) => Promise<AdminGuardResult>;

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Shared pipeline that authenticates a Clerk JWT, enforces the `admin`
 * entry-gate role, and resolves the full admin context (sub-role +
 * permissions) via D1/KV.
 *
 * @internal Not exported — every public guard delegates here first.
 */
async function resolveAuthenticatedAdmin(
    request: Request,
    env: Env,
): Promise<
    | { ok: true; adminContext: ResolvedAdminContext }
    | { ok: false; error: string; statusCode: number }
> {
    /* 0 — Pre-flight: ensure the admin subsystem is wired up. */
    if (!env.ADMIN_DB) {
        return { ok: false, error: 'Admin system not configured', statusCode: 503 };
    }

    /* 1 — Verify the Clerk JWT from the Authorization header. */
    const provider = new ClerkAuthProvider(env);
    let authResult;
    try {
        authResult = await provider.verifyToken(request);
    } catch (err) {
        console.error('[admin-role-middleware] JWT verification threw:', err);
        return { ok: false, error: 'Internal error during authentication', statusCode: 500 };
    }

    if (!authResult.valid || !authResult.providerUserId) {
        return {
            ok: false,
            error: authResult.error ?? 'Invalid or missing authentication token',
            statusCode: 401,
        };
    }

    /* 2 — Entry gate: Clerk publicMetadata.role must be 'admin'. */
    if (authResult.role !== 'admin') {
        console.warn(
            `[admin-role-middleware] Non-admin role attempted admin access: ` +
                `userId=${authResult.providerUserId}, role=${authResult.role ?? 'undefined'}`,
        );
        return { ok: false, error: 'Insufficient privileges: admin role required', statusCode: 403 };
    }

    /* 3 — Resolve sub-role + permissions from ADMIN_DB / KV cache. */
    let adminContext: ResolvedAdminContext | null;
    try {
        adminContext = await resolveAdminContext(env, authResult.providerUserId);
    } catch (err) {
        console.error('[admin-role-middleware] Failed to resolve admin context:', err);
        return { ok: false, error: 'Internal error resolving admin context', statusCode: 500 };
    }

    if (!adminContext) {
        console.warn(
            `[admin-role-middleware] No active admin role assignment: userId=${authResult.providerUserId}`,
        );
        return { ok: false, error: 'No active admin role assignment', statusCode: 403 };
    }

    return { ok: true, adminContext };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create a guard that requires a **single** admin permission.
 *
 * Users with the `super-admin` role bypass the permission check entirely.
 *
 * @example
 * ```ts
 * const guard = requireAdminPermission('config:write');
 * const result = await guard(request, env);
 * if (!result.authorized) return new Response(result.error, { status: result.statusCode });
 * // result.adminContext is now available
 * ```
 *
 * @param permission - The permission string the caller must possess.
 * @returns An async guard function with signature `(request, env) => Promise<AdminGuardResult>`.
 */
export function requireAdminPermission(permission: AdminPermission): AdminGuardFn {
    return async (request: Request, env: Env): Promise<AdminGuardResult> => {
        const resolved = await resolveAuthenticatedAdmin(request, env);
        if (!resolved.ok) {
            return { authorized: false, error: resolved.error, statusCode: resolved.statusCode };
        }

        const { adminContext } = resolved;

        // Super-admin bypasses all permission checks (root equivalent).
        if (adminContext.role_name === 'super-admin') {
            return { authorized: true, adminContext };
        }

        if (!adminContext.permissions.includes(permission)) {
            console.warn(
                `[admin-role-middleware] Permission denied: userId=${adminContext.clerk_user_id}, ` +
                    `role=${adminContext.role_name}, required=${permission}`,
            );
            return { authorized: false, error: `Missing required permission: ${permission}`, statusCode: 403 };
        }

        return { authorized: true, adminContext };
    };
}

/**
 * Create a guard that requires **any one** of the listed permissions.
 *
 * Users with the `super-admin` role bypass the permission check entirely.
 *
 * @example
 * ```ts
 * const guard = requireAnyAdminPermission(['users:read', 'users:write']);
 * const result = await guard(request, env);
 * ```
 *
 * @param permissions - At least one of these must be present in the admin's permission set.
 * @returns An async guard function.
 */
export function requireAnyAdminPermission(permissions: AdminPermission[]): AdminGuardFn {
    return async (request: Request, env: Env): Promise<AdminGuardResult> => {
        const resolved = await resolveAuthenticatedAdmin(request, env);
        if (!resolved.ok) {
            return { authorized: false, error: resolved.error, statusCode: resolved.statusCode };
        }

        const { adminContext } = resolved;

        if (adminContext.role_name === 'super-admin') {
            return { authorized: true, adminContext };
        }

        const hasAny = permissions.some((p) => adminContext.permissions.includes(p));
        if (!hasAny) {
            console.warn(
                `[admin-role-middleware] Permission denied (any-of): userId=${adminContext.clerk_user_id}, ` +
                    `role=${adminContext.role_name}, required=[${permissions.join(', ')}]`,
            );
            return {
                authorized: false,
                error: `Missing required permission: one of [${permissions.join(', ')}]`,
                statusCode: 403,
            };
        }

        return { authorized: true, adminContext };
    };
}

/**
 * Create a guard that requires **all** of the listed permissions.
 *
 * Users with the `super-admin` role bypass the permission check entirely.
 *
 * @example
 * ```ts
 * const guard = requireAllAdminPermissions(['config:read', 'config:write']);
 * const result = await guard(request, env);
 * ```
 *
 * @param permissions - Every listed permission must be present in the admin's permission set.
 * @returns An async guard function.
 */
export function requireAllAdminPermissions(permissions: AdminPermission[]): AdminGuardFn {
    return async (request: Request, env: Env): Promise<AdminGuardResult> => {
        const resolved = await resolveAuthenticatedAdmin(request, env);
        if (!resolved.ok) {
            return { authorized: false, error: resolved.error, statusCode: resolved.statusCode };
        }

        const { adminContext } = resolved;

        if (adminContext.role_name === 'super-admin') {
            return { authorized: true, adminContext };
        }

        const missing = permissions.filter((p) => !adminContext.permissions.includes(p));
        if (missing.length > 0) {
            console.warn(
                `[admin-role-middleware] Permission denied (all-of): userId=${adminContext.clerk_user_id}, ` +
                    `role=${adminContext.role_name}, missing=[${missing.join(', ')}]`,
            );
            return {
                authorized: false,
                error: `Missing required permissions: [${missing.join(', ')}]`,
                statusCode: 403,
            };
        }

        return { authorized: true, adminContext };
    };
}

/**
 * Lightweight context extractor — resolves the authenticated admin's context
 * **without** checking any specific permission.
 *
 * Intended for audit-logging or request-enrichment paths where you need to
 * know *who* is making the request but don't gate on a particular permission.
 *
 * @example
 * ```ts
 * const result = await extractAdminContext(request, env);
 * if (result.authorized) {
 *     auditLog.userId = result.adminContext.clerk_user_id;
 * }
 * ```
 *
 * @returns A guard result whose `adminContext` represents the caller, or a
 *          failure with an appropriate status code.
 */
export async function extractAdminContext(
    request: Request,
    env: Env,
): Promise<AdminGuardResult> {
    const resolved = await resolveAuthenticatedAdmin(request, env);
    if (!resolved.ok) {
        return { authorized: false, error: resolved.error, statusCode: resolved.statusCode };
    }
    return { authorized: true, adminContext: resolved.adminContext };
}
