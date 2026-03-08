#!/bin/sh
# Builds the Angular frontend for the Cloudflare Worker.
# Skipped when the dist directory already exists (e.g. in CI, where the
# frontend artifact is downloaded before wrangler runs this script).
DIST_DIR="frontend/dist/adblock-compiler/browser"

if [ -d "$DIST_DIR" ]; then
    echo "Frontend assets already present at $DIST_DIR — skipping build."
    exit 0
fi

pnpm run build:worker
