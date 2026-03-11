# Phase 2: Prisma Schema + Clerk Webhook Handler

## Context
Continuing from Phase 1 (committed on `feature/clerk-auth-integration`). Phase 1 established:
- Auth types (UserTier, IAuthContext, IClerkClaims) in `worker/types.ts`
- Clerk JWT verification via `jose` in `worker/middleware/clerk-jwt.ts`
- Unified auth middleware in `worker/middleware/auth.ts`
- Tiered rate limiting in `worker/middleware/index.ts`

## Phase 2 Todos

### p2-prisma-schema
Update `prisma/schema.prisma`:
- Add `clerkUserId` String? @unique field to User model
- Add `imageUrl`, `firstName`, `lastName` optional fields
- Add `emailVerified` Boolean field
- Add `tier` field as String @default("free") to align with UserTier enum
- Add `lastSignInAt` DateTime? for tracking
- Keep existing `role` field but ensure compatibility with Clerk metadata

### p2-user-service
Create `worker/services/user-service.ts`:
- Uses raw pg Pool (consistent with existing worker pattern — no Prisma client in worker)
- `upsertUserFromClerk(pool, clerkUser)` — insert or update user from Clerk event data
- `deleteUserByClerkId(pool, clerkId)` — soft delete or hard delete user by Clerk ID
- `findUserByClerkId(pool, clerkId)` — lookup for auth middleware
- `updateUserTier(pool, clerkId, tier)` — tier changes from Clerk metadata

### p2-webhook-handler
Create `worker/handlers/clerk-webhook.ts`:
- Verify Svix signature using `svix` npm package (already in deps from Phase 1)
- Handle `user.created` → upsert user record
- Handle `user.updated` → update user fields + tier from metadata
- Handle `user.deleted` → delete/deactivate user record
- Return 200 for successful processing, 400 for invalid signature, 500 for DB errors

### p2-webhook-route
Wire `POST /api/webhooks/clerk` in `worker/worker.ts`:
- Add route before the general API routing
- No auth middleware (webhook uses Svix signature verification)
- No Turnstile verification
- No rate limiting (Clerk controls the call rate)

## Notes
- Worker uses raw `pg` Pool via Hyperdrive, NOT Prisma client (Prisma is for migrations/schema only)
- Svix package already added to `deno.json` and `package.json` in Phase 1
- The existing `handleNotify` webhook handler in `worker/handlers/webhook.ts` is a good pattern reference
