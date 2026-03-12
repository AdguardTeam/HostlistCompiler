#!/usr/bin/env bash
# Usage:
#   scripts/lighthouse.sh <url|urls.txt> [output_dir] [categories]
#
# Arguments:
#   url|urls.txt  A single URL or a file containing one URL per line
#   output_dir    Directory to write JSON reports to (default: reports/lighthouse)
#   categories    Comma-separated Lighthouse categories to audit
#                 (default: performance,accessibility,best-practices,seo)
#
# Examples:
#   # All categories (default)
#   scripts/lighthouse.sh https://example.com
#
#   # SEO only (explicit)
#   scripts/lighthouse.sh https://example.com reports/lighthouse seo
#
#   # Multiple specific categories
#   scripts/lighthouse.sh https://example.com reports/lighthouse performance,accessibility
set -euo pipefail

# Auto-detect the lighthouse binary: system install first, then pnpm exec
if command -v lighthouse >/dev/null 2>&1; then
  LIGHTHOUSE_BIN="lighthouse"
elif pnpm exec lighthouse --version >/dev/null 2>&1; then
  LIGHTHOUSE_BIN="pnpm exec lighthouse"
else
  echo "lighthouse CLI not found. Install with: pnpm add -g lighthouse" >&2
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Usage: scripts/seo/lighthouse.sh <url|urls.txt> [output_dir] [categories]" >&2
  exit 1
fi

INPUT="$1"
OUTPUT_DIR="${2:-reports/lighthouse}"
CATEGORIES="${3:-performance,accessibility,best-practices,seo}"

mkdir -p "$OUTPUT_DIR"

run_lighthouse() {
  local url="$1"
  local safe_name
  safe_name=$(echo "$url" | sed -E 's#https?://##; s#[^a-zA-Z0-9._-]#_#g')
  local out_path="$OUTPUT_DIR/${safe_name}.json"

  echo "Running Lighthouse ($CATEGORIES) for $url"
  $LIGHTHOUSE_BIN "$url" \
    --only-categories="$CATEGORIES" \
    --output=json \
    --output-path="$out_path" \
    --quiet
}

if [ -f "$INPUT" ]; then
  while IFS= read -r url; do
    [ -z "$url" ] && continue
    run_lighthouse "$url"
  done < "$INPUT"
else
  run_lighthouse "$INPUT"
fi

echo "Reports saved to $OUTPUT_DIR"
