## feat: Lighthouse CI — Deno-native + pnpm

Implements a fully automated Lighthouse CI integration with a **Deno-first** approach and **pnpm** as the Node package manager for the one tool that requires Node (`@lhci/cli`).

---

### What changed

| File | Action | Notes |
|------|--------|-------|
| `.github/workflows/lighthouse.yml` | ✅ Created | Post-deploy audit workflow; `deployment_status` + `workflow_dispatch` |
| `.lighthouserc.json` | ✅ Created | LHCI config — a11y `error`-level (≥0.90), all others `warn` |
| `scripts/lighthouse-summary.ts` | ✅ Created | **Deno-native** report parser; writes Markdown table to `$GITHUB_STEP_SUMMARY` |
| `skills/seo-aeo-audit/scripts/lighthouse.sh` | ✅ Updated | Expanded from SEO-only → all 4 categories; pnpm-aware install hint |
| `docs/auth/removing-anonymous-access.md` | ✅ Updated | Phase 3 Performance Monitoring section added; stray backtick removed |
| `docs/reference/LIGHTHOUSE_CI.md` | ✅ Created | Full reference documentation |

---

### Deno vs pnpm split

`@lhci/cli` has no Deno-native equivalent — it shells out to Chrome and uses Node internals. The strategy is:

- **Deno** — everything that *can* be Deno: the report summarisation script (`scripts/lighthouse-summary.ts`) uses `jsr:@std/cli`, `jsr:@std/fs`, and `Deno.readTextFile`. The workflow reuses the existing `.github/actions/setup-deno-env` composite action.
- **pnpm** — `@lhci/cli` only, installed via `pnpm add --global` (matching the pattern in `ci.yml`'s `frontend-lint-test` and `frontend-build` jobs).
- **No npm** — the original spec called for `npm i -g @lhci/cli`; this is replaced with pnpm throughout.

---

### Key design decisions

- `continue-on-error: true` on the Lighthouse job — regressions warn, never block deploys
- Accessibility (≥0.90) and HTTPS assertions are `error`-level — the one exception to advisory-only
- `target: filesystem` in `.lighthouserc.json` — no LHCI server, no secrets needed
- Reports stored as 30-day GitHub artifacts; summary table written by the Deno script
- SHA-pinned actions consistent with `ci.yml` style (`actions/checkout`, `actions/setup-node`, `actions/upload-artifact`)

---

### Testing

The workflow can be triggered manually via **Actions → Lighthouse CI → Run workflow**, passing any URL. The Deno summary script can be run locally:

```bash
deno run --allow-read --allow-env scripts/lighthouse-summary.ts \
    --results-dir=lhci-results \
    --url=https://adblock-compiler.jayson-knight.workers.dev
```

*This pull request was created from Copilot chat.*