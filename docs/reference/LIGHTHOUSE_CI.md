# Lighthouse CI Integration

Lighthouse CI is integrated into the adblock-compiler deployment pipeline to automatically audit performance, accessibility, best practices, and SEO after every production deployment.

---

## Overview

The integration uses [`@lhci/cli`](https://github.com/GoogleChrome/lighthouse-ci) to run Lighthouse against the live Cloudflare Workers deployment. Results are stored as GitHub Actions artifacts (no external LHCI server required).

**Key properties:**

- Runs post-deploy, not in the PR gate — regressions warn but do not block deployments initially
- Covers all four Lighthouse categories: Performance, Accessibility, Best Practices, SEO
- Desktop throttling profile (matches developer/API user persona)
- 2 runs per URL (median reported); bump to 3 if more reliable medians are needed
- Stores reports as GitHub workflow artifacts for 30 days

---

## Configuration

The full LHCI configuration lives in `.lighthouserc.json` at the repository root.

### Key settings

| Setting | Value | Rationale |
|---|---|---|
| `numberOfRuns` | 2 | Speed over precision; increase to 3 if medians are noisy |
| `formFactor` | desktop | Matches primary user persona (developers, API consumers) |
| `rttMs` | 40 ms | Simulates a reasonable broadband connection |
| `throughputKbps` | 10 240 | ~10 Mbps — fast broadband |
| `cpuSlowdownMultiplier` | 1 | No CPU throttling on desktop |
| `outputDir` | `lhci-results/` | Filesystem-only storage; no LHCI server needed |

---

## Workflow Triggers

The workflow (`.github/workflows/lighthouse.yml`) runs on two triggers:

### 1. `deployment_status` (automatic)

Fires when the Cloudflare Worker deploy job in `ci.yml` reports a successful deployment to production. The audited URL is taken from `github.event.deployment_status.target_url`.

### 2. `workflow_dispatch` (manual)

Trigger a run manually from the **Actions** tab. You can supply a custom URL via the `url` input (defaults to `https://adblock-compiler.jayson-knight.workers.dev`).

---

## Audit Targets

The following URLs are audited on every run:

| URL | Rationale |
|---|---|
| `/` | Main compiler UI — tracks LCP, CLS, and overall UX quality |
| `/sign-in` | First page unauthenticated users encounter after the anonymous access migration; a11y ≥ 0.90 is enforced |
| `/sign-up` | Registration page — same a11y requirement; new user onboarding quality |
| `/health` | Fast endpoint; should score near-perfect across all categories as a sanity baseline |

The `/sign-in` and `/sign-up` pages are explicitly included because the anonymous access migration documented in [`docs/auth/removing-anonymous-access.md`](../auth/removing-anonymous-access.md) changes what unauthenticated users see when they first visit the app.

---

## Thresholds & Assertions

Assertions are defined in `.lighthouserc.json`. The severity (`"error"` vs `"warn"`) controls whether `lhci autorun` exits non-zero:

| Audit | Severity | Threshold | Reason |
|---|---|---|---|
| `categories:accessibility` | **error** | ≥ 0.90 | A11y regressions must be caught immediately, especially after auth UI changes |
| `uses-https` | **error** | = 1.0 | Cloudflare Workers always serves HTTPS; failure indicates something is seriously wrong |
| `is-on-https` | **error** | = 1.0 | Same rationale as `uses-https` |
| `categories:performance` | warn | ≥ 0.85 | Permissive initially; tighten once baseline is established |
| `categories:best-practices` | warn | ≥ 0.90 | Advisory |
| `categories:seo` | warn | ≥ 0.90 | Advisory |
| `first-contentful-paint` | warn | ≤ 3 000 ms | |
| `largest-contentful-paint` | warn | ≤ 4 000 ms | |
| `total-blocking-time` | warn | ≤ 500 ms | Relevant for Angular compiler UI with large filter list outputs |
| `cumulative-layout-shift` | warn | ≤ 0.10 | SSR hydration with Angular Material can cause CLS |
| `interactive` (TTI) | warn | ≤ 5 000 ms | |
| `speed-index` | warn | ≤ 5 000 ms | |
| `no-vulnerable-libraries` | warn | = 1.0 | Advisory |
| `errors-in-console` | warn | 0 errors | Catch JS errors in production |

> **Note:** The workflow job itself has `continue-on-error: true`, so even `"error"`-level assertion failures only mark the Lighthouse job as failed — they do not block the deployment. This is intentional for the initial integration. Remove `continue-on-error` once baseline scores are stable.

---

## Reading Reports

After each successful Lighthouse run:

1. Go to the **Actions** tab in GitHub.
2. Open the relevant `Lighthouse CI` workflow run.
3. The **Job Summary** section at the bottom contains a Markdown table with scores for each audited URL. Scores are colour-coded: ✅ ≥ 90 · ⚠️ ≥ 75 · ❌ < 75.
4. Download the `lighthouse-results` artifact (retained for 30 days) to get the full JSON and HTML reports.

The JSON reports produced by `@lhci/cli` are standard Lighthouse result objects and can be opened with any Lighthouse viewer (e.g. [https://googlechrome.github.io/lighthouse/viewer/](https://googlechrome.github.io/lighthouse/viewer/)).

---

## Running Locally

To run the same audit locally against the live deployment:

```bash
npx lhci autorun --config=.lighthouserc.json \
  --collect.url="https://adblock-compiler.jayson-knight.workers.dev/" \
  --collect.url="https://adblock-compiler.jayson-knight.workers.dev/sign-in" \
  --collect.url="https://adblock-compiler.jayson-knight.workers.dev/sign-up" \
  --collect.url="https://adblock-compiler.jayson-knight.workers.dev/health"
```

This requires a live URL — it cannot run against a local dev server without additional `startServerCommand` configuration.

### Relationship to `skills/seo-aeo-audit/scripts/lighthouse.sh`

The `skills/seo-aeo-audit/scripts/lighthouse.sh` script is the **manual CLI** tool. It uses the standalone `lighthouse` binary directly and is useful for quick one-off audits or auditing arbitrary URLs from your terminal. It now supports all four categories via an optional third argument:

```bash
# All categories (default)
skills/seo-aeo-audit/scripts/lighthouse.sh https://example.com

# SEO only (explicit, matching previous behaviour)
skills/seo-aeo-audit/scripts/lighthouse.sh https://example.com reports/lighthouse seo
```

The `.github/workflows/lighthouse.yml` workflow is the **automated CI integration** that runs post-deploy. They complement each other.

---

## Adjusting Thresholds

To tighten or loosen a threshold:

1. Edit `.lighthouserc.json` in the repository root.
2. Change the `minScore` / `maxNumericValue` for the relevant assertion.
3. To promote a `"warn"` to `"error"`, change the first element of the tuple.
4. Commit and push — the next Lighthouse CI run will use the new thresholds.

Once the deployment has been running stably for a few weeks, consider:

- Tightening `categories:performance` from `0.85` → `0.90`
- Tightening `total-blocking-time` from `500 ms` → `300 ms`
- Adding a mobile job (duplicate the workflow job with `formFactor: mobile` settings)

---

## Troubleshooting

### `lhci autorun` exits non-zero in CI but the workflow job is green

This is expected when `continue-on-error: true` is set. Check the step output for which assertions failed. See the [Thresholds & Assertions](#thresholds--assertions) table above.

### Reports are empty or missing

Ensure the target URL is reachable from the GitHub Actions runner. The `deployment_status` trigger fires only after a successful Cloudflare deploy, so the URL should be live.

### `first-contentful-paint` is much higher than expected

Check for render-blocking resources or a slow Cloudflare Worker cold start. The desktop throttling profile in `.lighthouserc.json` uses a 40 ms RTT — cold-start latency will show up in FCP.

### `cumulative-layout-shift` is failing after an Angular Material update

CLS is commonly introduced by Angular Material components that render at a different size after hydration. Use Chrome DevTools to identify which elements shift and apply `min-height` or explicit dimensions.
