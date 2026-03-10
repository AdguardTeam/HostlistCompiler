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
# Regenerates generated files and aborts push if they changed (uncommitted).
set -euo pipefail

echo "🔍 Running pre-push preflight checks..."

# Regenerate schema files
deno task schema:generate > /dev/null 2>&1

# Check for uncommitted changes in generated files
if ! git diff --quiet docs/api/cloudflare-schema.yaml docs/postman/postman-collection.json docs/postman/postman-environment.json; then
  echo ""
  echo "❌ Generated files are out of date!"
  echo "   Run the following, then push again:"
  echo ""
  echo "   git add docs/api/cloudflare-schema.yaml docs/postman/postman-collection.json docs/postman/postman-environment.json"
  echo "   git commit -m 'chore: regenerate cloudflare schema and postman collection'"
  echo ""
  exit 1
fi

# Check formatting
if ! deno fmt --check > /dev/null 2>&1; then
  echo ""
  echo "❌ Formatting check failed. Run: deno task fmt"
  echo ""
  exit 1
fi

echo "✅ Pre-push checks passed"
`;

try {
    await Deno.mkdir(hooksDir, { recursive: true });
    await Deno.writeTextFile(prePushPath, prePushScript);
    await new Deno.Command('chmod', { args: ['+x', prePushPath] }).output();
    console.log(`✅ Installed pre-push hook: ${prePushPath}`);
    console.log('   The hook will regenerate schemas and check formatting before every push.');
} catch (err) {
    console.error(`❌ Failed to install hook: ${err instanceof Error ? err.message : String(err)}`);
    Deno.exit(1);
}
