# Removing Anonymous Access

This document describes the plan for migrating the adblock-compiler API and web UI from open anonymous access to authenticated-only access using Clerk.

---

## Overview

The adblock-compiler has historically allowed unauthenticated access to all endpoints. As usage grows and rate-limit enforcement becomes important, anonymous access needs to be removed in a phased rollout to avoid breaking existing integrations.

---

## Phase 1: Soft Warning

Add `Warning` response headers and optional `X-Auth-Required: true` markers on all unauthenticated responses. Clients can begin authenticating without any hard failures.

- Log all unauthenticated requests with a deprecation marker
- Emit an analytics event to measure the volume of anonymous traffic
- No breaking changes

---

## Phase 2: Rate-Limit Anonymous Traffic

Tighten the rate limits on unauthenticated requests to motivate migration:

- Anonymous requests: **30 req/min** (down from unlimited)
- Authenticated free tier: **60 req/min**
- Authenticated pro tier: **300 req/min**

Return `429 Too Many Requests` with a `Retry-After` header when the anonymous limit is exceeded. Include a `WWW-Authenticate` header pointing to the sign-up page.

---

## Phase 3: Hard Enforcement

After an adequate migration window, reject all unauthenticated requests with:

```json
{
    "success": false,
    "error": "Authentication is required. Sign up at https://adblock-compiler.jayson-knight.workers.dev/sign-up"
}
```

HTTP status: `401 Unauthorized`

All endpoints (`/compile`, `/compile/stream`, `/compile/batch`, `/compile/async`, `/api/*`) require a valid Bearer token or API key.

### Performance Monitoring

After hard enforcement lands, Lighthouse CI runs automatically against each production deployment and audits:

- `/` — Compiler UI (unauthenticated users will see the sign-in redirect; LCP and CLS are tracked)
- `/sign-in` and `/sign-up` — First pages new users encounter; accessibility score ≥ 0.90 is enforced
- `/health` — Baseline sanity check

Results are uploaded as workflow artifacts on every deploy. See `.lighthouserc.json` for thresholds and `.github/workflows/lighthouse.yml` for the workflow.

---

## Migration Guide for API Consumers

### Step 1: Create an account

Sign up at [https://adblock-compiler.jayson-knight.workers.dev/sign-up](https://adblock-compiler.jayson-knight.workers.dev/sign-up).

### Step 2: Generate an API key

Navigate to **Settings → API Keys** in the web UI and create a new key. Store it securely — it is displayed only once.

### Step 3: Add the Authorization header

Add the following header to all API requests:

```http
Authorization: Bearer <your-api-key>
```

### Step 4: Handle 401 responses

Update your error-handling code to detect `401 Unauthorized` and surface a meaningful message to users.

---

## FAQ

**Q: When does Phase 3 go live?**
A: The timeline is TBD and will be communicated via the changelog and GitHub releases at least 30 days in advance.

**Q: Will existing filter list URLs break?**
A: Direct URL-based filter list subscriptions (e.g. in DNS resolvers) are unaffected during Phases 1 and 2. Phase 3 will require those callers to pass an API key via the `Authorization: Bearer <api-key>` header.

**Q: What if I hit rate limits?**
A: Upgrade to Pro tier (300 req/min) or contact us for Enterprise needs.
