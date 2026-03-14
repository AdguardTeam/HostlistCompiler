## Description

<!-- Brief description of what this PR does. Link related issues with "Closes #NNN". -->

## Changes

<!-- List the key changes made in this PR. -->

-

## Testing

<!-- How were these changes tested? -->

- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] CI passes

## Zero Trust Architecture Checklist

> **Required for every PR touching `worker/` or `frontend/`.**
> Check each item that applies. If an item doesn't apply, check it and note "N/A".

### Worker / Backend

- [ ] Every handler verifies auth before executing business logic
- [ ] CORS origin allowlist enforced (not `*`) on write/authenticated endpoints
- [ ] All secrets accessed via Worker Secret bindings (not `[vars]`)
- [ ] All external inputs Zod-validated before use
- [ ] All D1 queries use parameterized `.prepare().bind()` (no string interpolation)
- [ ] Security events emitted to Analytics Engine on auth failures

### Frontend / Angular

- [ ] Protected routes have functional `CanActivateFn` auth guards
- [ ] Auth tokens managed via Clerk SDK (not `localStorage`)
- [ ] HTTP interceptor attaches Bearer token (no manual token passing)
- [ ] API responses validated with Zod schemas before consumption

---

_If this PR does not touch `worker/` or `frontend/`, the ZTA checklist is not required._
