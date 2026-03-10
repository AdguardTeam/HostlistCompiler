#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Installs git hooks for local development.
 * Run: deno task setup:hooks
 */

import { join } from '@std/path';

const hooksDir = join(Deno.cwd(), '.git', 'hooks');
const prePushPath = join(hooksDir, 'pre-push');

const prePushScript = `#!/usr/bin/env bash
# Auto-installed by: deno task setup:hooks
# Runs preflight checks (fmt, lint, type-check all entry points, OpenAPI validation,
# schema drift detection) before every push. Fast path; does NOT run tests.
# To also run tests: deno task preflight:full
set -euo pipefail

echo "🔍 Running pre-push preflight checks (fmt, lint, types, schema drift)..."
echo "   Tip: run 'deno task preflight:full' to include tests before opening a PR."
echo ""

if ! deno task preflight; then
  echo ""
  echo "❌ Pre-push preflight failed. Fix the issues above and push again."
  exit 1
fi

echo "✅ Pre-push checks passed"
`;

try {
    await Deno.mkdir(hooksDir, { recursive: true });
    await Deno.writeTextFile(prePushPath, prePushScript);
    await new Deno.Command('chmod', { args: ['+x', prePushPath] }).output();
    console.log(`✅ Installed pre-push hook: ${prePushPath}`);
    console.log('   Runs: fmt, lint, type-check (all entry points), OpenAPI validate, schema drift check.');
    console.log('   For full checks (incl. tests): deno task preflight:full');
} catch (err) {
    console.error(`❌ Failed to install hook: ${err instanceof Error ? err.message : String(err)}`);
    Deno.exit(1);
}
