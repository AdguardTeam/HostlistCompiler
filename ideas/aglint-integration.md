# AGLint Integration Ideas

> Date: 2026-03-10

This document captures potential integration points for [AGLint](https://github.com/AdguardTeam/AGLint) (`@adguard/aglint`) into the adblock-compiler project.

---

## 1. Pre-Compilation Linting Step

Add AGLint as a validation pass *before* compilation runs. Filter rules from sources could be linted and any errors/warnings surfaced via the existing structured logging and `IBasicLogger` injection. This would complement the existing `Validate` transformation.

```typescript
import { Linter } from '@adguard/aglint';

const linter = new Linter(/* config */);
const results = linter.lint(rules.join('\n'));
// Surface results via your Logger / CompilerEventEmitter
```

---

## 2. New `LintTransformation`

Since the compiler has an extensible transformation pipeline (`src/transformations/`), add a `LintTransformation` that runs AGLint rules on the filter list mid-pipeline — e.g., stripping or warning on invalid rules before `Deduplicate` or `Compress` runs.

---

## 3. Angular Validation UI Enhancement

The Angular frontend already has a `validation` page with AGTree-powered rule validation. AGLint could extend this by surfacing linter warnings (e.g., `no-invalid-css-syntax`, `duplicated-modifiers`) alongside the existing parse errors — with color-coded output per the existing `VALIDATION_UI.md`.

---

## 4. API Endpoint: `/api/lint`

Expose AGLint programmatically via a new REST endpoint in `worker/worker.ts`. Clients could POST a filter list and receive lint results as JSON, similar to the existing `/api/compile` endpoint — fully documentable via the OpenAPI spec.

---

## 5. CI/CD Lint Gate

Add AGLint as a GitHub Actions step in the CI workflow (`.github/workflows/`) to lint example rules or any bundled filter lists on every PR.

```yaml
- name: Lint filter lists
  run: npx aglint src/resources/rules.txt
```

---

## 6. `.aglintrc.yml` Config + `.aglintignore`

Add a project-level `.aglintrc.yml` to the repo root, extending `aglint:recommended`, so contributors (and the CI lint gate above) get consistent rule checking out of the box.

---

## Key Consideration

AGLint is an **npm** package (`@adguard/aglint`), and the project is **Deno-native**. Consume it via **npm compatibility** (`npm:@adguard/aglint` in Deno) or use the programmatic API via a Node.js-targeted path. The existing `src/cli.ts` already has a Node.js entry point, making it a natural fit there.