# RTM (v1.0.0) Issue Backlog

> These issues are intentionally deferred until the **beta milestone is complete**.
> Once beta is signed off, convert each item below into a GitHub issue assigned to @jaypatrick under the `rtm` milestone.

---

## Epic 6 — Stabilization & Comprehensive Testing

### 6.1 End-to-End Test Suite

- **Milestone:** `rtm`
- **Labels:** `enhancement`
- **Description:** Automated E2E tests covering all critical user journeys.
- **Tasks:**
  - [ ] Choose E2E framework (Playwright recommended for Angular + Cloudflare Workers)
  - [ ] Cover: compile a blocklist, view result, download/copy output
  - [ ] Cover: dashboard/admin flows (if applicable)
  - [ ] Cover: error states (bad source URL, network failure, DB timeout)
  - [ ] Run E2E suite in CI on main branch merges (nightly or on release candidates)
- **Acceptance Criteria:**
  - All critical user journeys have passing E2E specs
  - E2E suite runs nightly or on release candidates

---

### 6.2 Backend & API Integration Tests

- **Milestone:** `rtm`
- **Labels:** `enhancement`
- **Description:** Integration tests for all Cloudflare Worker API endpoints and DB access paths.
- **Tasks:**
  - [ ] Write integration tests for all API endpoints (Cloudflare Worker routes)
  - [ ] Test all DB access paths (Prisma + D1 + R2) with real data
  - [ ] Cover error paths: missing input, invalid schema, DB failures
  - [ ] Run in CI on every PR
- **Acceptance Criteria:**
  - All API endpoints have integration test coverage
  - DB error scenarios handled gracefully and tested

---

### 6.3 Load & Performance Testing

- **Milestone:** `rtm`
- **Labels:** `enhancement`
- **Description:** Stress test compilation APIs and frontend under realistic load.
- **Tasks:**
  - [ ] Define target SLOs: max p95 latency for compilation, max concurrent requests
  - [ ] Write load test scripts (k6 or similar) simulating realistic traffic
  - [ ] Test large blocklist compilations (simulate worst-case inputs)
  - [ ] Document results and any bottlenecks found
- **Acceptance Criteria:**
  - Load test results documented in /docs/performance.md
  - No crashes or data loss under simulated peak load

---

## Epic 7 — Security & Compliance

### 7.1 Dependency Security Audit

- **Milestone:** `rtm`
- **Labels:** `enhancement`
- **Description:** Audit all dependencies for known CVEs and set up ongoing monitoring.
- **Tasks:**
  - [ ] Run `deno audit` / `npm audit` on all dependency trees
  - [ ] Resolve all critical and high severity findings
  - [ ] Set up Dependabot or equivalent for ongoing monitoring
  - [ ] Document any known acceptable risks
- **Acceptance Criteria:**
  - Zero unresolved critical/high CVEs at time of RTM tag

---

### 7.2 Application Security Review

- **Milestone:** `rtm`
- **Labels:** `enhancement`
- **Description:** Review all API inputs, auth, secrets handling, CORS, and Turnstile validation.
- **Tasks:**
  - [ ] Audit all API inputs for sanitization (injection, SSRF risks from blocklist URLs)
  - [ ] Verify Cloudflare Worker auth/authz for admin endpoints
  - [ ] Confirm no secrets, tokens, or credentials are logged or exposed
  - [ ] Review CORS configuration
  - [ ] Confirm Turnstile (CAPTCHA) integration is correctly validated server-side
- **Acceptance Criteria:**
  - Security checklist reviewed and signed off
  - All findings resolved or documented as accepted risk

---

### 7.3 GPL-3.0 License Compliance Review

- **Milestone:** `rtm`
- **Labels:** `documentation`
- **Description:** Verify all dependencies are license-compatible with GPL-3.0.
- **Tasks:**
  - [ ] Audit all dependencies for license compatibility with GPL-3.0
  - [ ] Ensure LICENSE file is accurate and present
  - [ ] Add license headers to source files if required by fork/upstream policy
  - [ ] Verify compliance with AdguardTeam/HostlistCompiler upstream requirements
- **Acceptance Criteria:**
  - License compatibility confirmed for all production dependencies

---

## Epic 8 — Production Observability (Full)

### 8.1 Full Grafana Dashboard & Alerting

- **Milestone:** `rtm`
- **Labels:** `enhancement`
- **Description:** Expand Grafana dashboards to all subsystems and add production alerting.
- **Tasks:**
  - [ ] Expand beta dashboards to cover all subsystems
  - [ ] Add alerting rules for: error rate > threshold, p95 latency spike, DB connection failures
  - [ ] Document on-call runbook in /docs/ops/runbook.md
  - [ ] Configure notification channel (email, Slack, PagerDuty, etc.)
- **Acceptance Criteria:**
  - All critical metrics have alerts
  - Runbook covers top 5 failure scenarios

---

### 8.2 Structured Logging & Error Tracking

- **Milestone:** `rtm`
- **Labels:** `enhancement`
- **Description:** Implement structured logging and integrate error capture across all Workers.
- **Tasks:**
  - [ ] Implement structured logging (JSON) in Cloudflare Workers
  - [ ] Integrate Sentry or Cloudflare Tail Workers for error capture
  - [ ] Ensure source maps are uploaded for meaningful stack traces
  - [ ] Log all compilation jobs (input, output, duration, errors)
- **Acceptance Criteria:**
  - Errors in production surface with full context within 1 minute

---

## Epic 9 — Final Documentation & Release

### 9.1 Complete End-User Documentation

- **Milestone:** `rtm`
- **Labels:** `documentation`
- **Description:** Full user-facing and contributor documentation, reviewed and finalized.
- **Tasks:**
  - [ ] User guide: how to use the compiler (UI walkthrough)
  - [ ] Self-hosting guide: how to deploy your own instance
  - [ ] API reference: all endpoints, request/response schemas, auth
  - [ ] FAQ and troubleshooting section
  - [ ] CHANGELOG kept current
- **Acceptance Criteria:**
  - Docs reviewed by someone who has never seen the project before
  - All major flows documented with examples

---

### 9.2 v1.0.0 Release Candidate & GA Cut

- **Milestone:** `rtm`
- **Labels:** `enhancement`
- **Description:** Cut the v1.0.0-rc tag, run final smoke tests, publish release notes, and ship GA.
- **Tasks:**
  - [ ] Cut `v1.0.0-rc.1` tag and deploy to production
  - [ ] Run full manual smoke test against production
  - [ ] Confirm automated version-bump and release workflow fires correctly
  - [ ] Write v1.0.0 release notes (features, breaking changes, migration from beta)
  - [ ] Update homepage (adblock.jaysonknight.com) with GA announcement
  - [ ] Merge and lock `v1.0.0` tag
- **Acceptance Criteria:**
  - `v1.0.0` tag exists
  - Release notes published on GitHub Releases
  - Production deploy healthy post-release
  - No sev-1 issues open at time of tag

---

## Checklist: Beta Exit Criteria (must be complete before creating RTM issues)

- [ ] All 14 beta milestone issues closed
- [ ] Angular frontend has feature parity with legacy HTML/CSS frontend
- [ ] All Angular Material 3 component refactors complete
- [ ] Database layer (PlanetScale, Hyperdrive, D1, R2, Prisma) fully operational
- [ ] Vitest coverage gate passing in CI at ≥ 80%
- [ ] Frontend build integrated into CI/CD and blocking merges
- [ ] Grafana/observability decision made and documented
- [ ] No sev-1 or sev-2 bugs open

---

_Once all items above are checked, promote these items to live GitHub issues under the `rtm` milestone._
