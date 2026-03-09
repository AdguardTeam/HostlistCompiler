#!/bin/sh
# Builds the Angular frontend for the Cloudflare Worker.
# Skipped when the dist directory already exists (e.g. in CI, where the
# frontend artifact is downloaded before wrangler runs this script).
DIST_DIR="frontend/dist/adblock-compiler/browser"

if [ -d "$DIST_DIR" ]; then
    echo "Frontend assets already present at $DIST_DIR — skipping build."
else
    pnpm run build:worker
fi

# Inject Cloudflare Web Analytics token into the built index.html.
# The placeholder {{CF_WEB_ANALYTICS_TOKEN}} is replaced with the token from
# the environment, or the analytics script is removed if the token is not set.
INDEX_HTML="$DIST_DIR/index.html"
if [ -f "$INDEX_HTML" ]; then
    if [ -n "$CF_WEB_ANALYTICS_TOKEN" ]; then
        # Escape characters special in sed replacement with '|' delimiter: & \ |
        ESCAPED_TOKEN=$(printf '%s' "$CF_WEB_ANALYTICS_TOKEN" | sed 's/[&|\\]/\\&/g')
        sed -i "s|{{CF_WEB_ANALYTICS_TOKEN}}|$ESCAPED_TOKEN|g" "$INDEX_HTML"
        echo "Cloudflare Web Analytics token injected into $INDEX_HTML."
    else
        sed -i '/CF_WEB_ANALYTICS_TOKEN/d' "$INDEX_HTML"
        echo "CF_WEB_ANALYTICS_TOKEN not set — analytics script removed from $INDEX_HTML."
    fi
fi
