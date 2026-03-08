#!/usr/bin/env zsh
# =============================================================================
# count-loc.sh — Lines of Code counter for adblock-compiler
#
# Usage:
#   ./scripts/count-loc.sh              # count all source files
#   ./scripts/count-loc.sh --total      # print grand total only
#   ./scripts/count-loc.sh --no-vendor  # skip lock files & generated files
#
# Requirements: none beyond standard zsh + POSIX tools (find, wc, awk, sort)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults & flags
# ---------------------------------------------------------------------------
SHOW_TOTAL_ONLY=false
SKIP_VENDOR=false

for arg in "$@"; do
  case $arg in
    --total)      SHOW_TOTAL_ONLY=true ;; 
    --no-vendor)  SKIP_VENDOR=true ;;
    -h|--help)
      echo "Usage: $0 [--total] [--no-vendor]"
      echo "  --total      Print the grand total line count only"
      echo "  --no-vendor  Exclude lock files and generated files"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg  (use --help)" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Resolve the repo root (one level up from this script, wherever it lives)
# ---------------------------------------------------------------------------
SCRIPT_DIR="${0:A:h}"          # absolute path to scripts/
REPO_ROOT="${SCRIPT_DIR:h}"    # one level up → repo root

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Directories / files to always exclude
# ---------------------------------------------------------------------------
PRUNE_DIRS=(
  node_modules
  .git
  dist
  build
  .wrangler
  output
  coverage
  .turbo
  .next
  ".angular"
)

# Files to exclude when --no-vendor is given (lock files, generated artefacts)
VENDOR_PATTERNS=(
  "pnpm-lock.yaml"
  "package-lock.json"
  "deno.lock"
  "yarn.lock"
  "*.min.js"
  "*.min.css"
  "*.generated.ts"
  "*.d.ts"
)

# ---------------------------------------------------------------------------
# Extensions → language labels
# ---------------------------------------------------------------------------
typeset -A EXT_LANG=(
  ts   "TypeScript"
  tsx  "TypeScript (TSX)"
  js   "JavaScript"
  mjs  "JavaScript (ESM)"
  cjs  "JavaScript (CJS)"
  css  "CSS"
  scss "SCSS"
  html "HTML"
  py   "Python"
  sh   "Shell"
  zsh  "Zsh"
  toml "TOML"
  yaml "YAML"
  yml  "YAML"
  json "JSON"
  md   "Markdown"
  sql  "SQL"
  dockerfile "Dockerfile"
)

# ---------------------------------------------------------------------------
# Build the `find` prune expression
# ---------------------------------------------------------------------------
build_prune_expr() {
  local expr=()
  for dir in $PRUNE_DIRS; do
    expr+=( -name "$dir" -prune -o )
  done
  echo "${expr[@]}"
}

# ---------------------------------------------------------------------------
# Count lines for a given extension, return the number
# ---------------------------------------------------------------------------
count_ext() {
  local ext="$1"
  local prune_expr
  prune_expr="$(build_prune_expr)"

  # Collect matching files, excluding pruned dirs
  local files
  if [[ "$ext" == "dockerfile" ]]; then
    # Dockerfile has no extension
    files=$(eval "find . $prune_expr -type f -iname 'Dockerfile*' -print" 2>/dev/null || true)
  else
    files=$(eval "find . $prune_expr -type f -name '*.$ext' -print" 2>/dev/null || true)
  fi

  # Strip vendor patterns when --no-vendor
  if $SKIP_VENDOR; then
    for pat in $VENDOR_PATTERNS; do
      files=$(echo "$files" | grep -v "$pat" || true)
    done
  fi

  [[ -z "$files" ]] && echo 0 && return

  # Count non-blank, non-comment lines would be slow; just count all lines
  echo "$files" | xargs wc -l 2>/dev/null \
    | tail -1 \
    | awk '{print $1}'
}

# ---------------------------------------------------------------------------
# Main — gather counts per language
# ---------------------------------------------------------------------------
typeset -A lang_counts=()
GRAND_TOTAL=0

for ext lang in ${(kv)EXT_LANG}; do
  count=$(count_ext "$ext")
  if (( count > 0 )); then
    if [[ -n "
{lang_counts[$lang]+_}" ]]; then
      lang_counts[$lang]=$(( lang_counts[$lang] + count ))
    else
      lang_counts[$lang]=$count
    fi
    GRAND_TOTAL=$(( GRAND_TOTAL + count ))
  fi
done

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
if $SHOW_TOTAL_ONLY; then
  echo "$GRAND_TOTAL"
  exit 0
fi

# Print header
printf "\n%-30s %10s  %6s\n" "Language" "Lines" "Share"
printf "%\-30s %10s  %6s\n" "------------------------------" "----------" "------"

# Sort by line count descending
for lang in ${(k)lang_counts}; do
  count=${lang_counts[$lang]}
  pct=$(awk "BEGIN { printf '%.1f%%', ($count / $GRAND_TOTAL) * 100 }")
  printf "%-30s %10d  %6s\n" "$lang" "$count" "$pct"
done \
  | sort -k2 -rn

printf "%-30s %10s  %6s\n" "------------------------------" "----------" "------"
printf "%-30s %10d  %6s\n" "TOTAL" "$GRAND_TOTAL" "100%"
printf "\n"

# Tip: for a faster/richer alternative, install 'tokei' or 'cloc'
# brew install tokei   →  tokei .
# brew install cloc    →  cloc --exclude-dir=node_modules,.git .
