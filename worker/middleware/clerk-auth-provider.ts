/**
 * Clerk Auth Provider
 *
 * Implements {@link IAuthProvider} for Clerk JWT authentication.
 * Wraps the existing `verifyClerkJWT()` function to conform to the
 * pluggable provider interface — swapping to Auth0/Okta only requires
 * implementing the same interface.
 *
 * @see worker/middleware/clerk-jwt.ts — underlying JWT verification
 * @see worker/types.ts — IAuthProvider interface
 */

import type { Env, IAuthProvider, IAuthProviderResult, IClerkPublicMetadata } from '../types.ts';
import { UserTier } from '../types.ts';
import { verifyClerkJWT } from './clerk-jwt.ts';

/**
 * Map Clerk public metadata to a {@link UserTier}.
 * Validates the tier value against the known {@link UserTier} enum values.
 * Falls back to {@link UserTier.Free} when metadata is absent or contains
 * an unrecognised tier value (e.g. a misconfigured Clerk public metadata field).
 *
 * @internal Exported for unit testing only.
 */
export function resolveTierFromMetadata(metadata: IClerkPublicMetadata | undefined): UserTier {
    if (!metadata?.tier) return UserTier.Free;
    const validTiers = Object.values(UserTier) as string[];
    if (!validTiers.includes(metadata.tier as string)) return UserTier.Free;
    return metadata.tier;
}

/**
 * Map Clerk public metadata to a role string.
 * Falls back to `'user'` when the metadata does not specify a role.
 */
function resolveRoleFromMetadata(metadata: IClerkPublicMetadata | undefined): string {
    return metadata?.role ?? 'user';
}

/**
 * Clerk implementation of {@link IAuthProvider}.
 *
 * Verifies Clerk-issued JWTs and resolves user tier/role from Clerk's
 * public metadata. Thread-safe and stateless per request — the JWKS
 * resolver is cached at module level inside `clerk-jwt.ts`.
 */
export class ClerkAuthProvider implements IAuthProvider {
    readonly name = 'clerk';
    readonly authMethod = 'clerk-jwt' as const;

    constructor(private readonly env: Env) {}

    async verifyToken(request: Request): Promise<IAuthProviderResult> {
        const jwtResult = await verifyClerkJWT(request, this.env);

        if (!jwtResult.valid || !jwtResult.claims) {
            return {
                valid: false,
                error: jwtResult.error,
            };
        }

        const metadata = jwtResult.claims.metadata;
        return {
            valid: true,
            providerUserId: jwtResult.claims.sub,
            tier: resolveTierFromMetadata(metadata),
            role: resolveRoleFromMetadata(metadata),
            sessionId: jwtResult.claims.sid ?? null,
        };
    }
}
