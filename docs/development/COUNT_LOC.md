# `count-loc.sh` — Lines of Code Counter

> **Location:** `scripts/count-loc.sh`
> **Added:** 2026-03-08
> **Shell:** zsh (no external dependencies — standard POSIX tools only)

---

## Overview

`count-loc.sh` is a zero-dependency shell script that counts lines of code across the entire repository, broken down by language. It is designed to run quickly against a local clone without requiring any third-party tools such as `tokei` or `cloc`.

It lives in `scripts/` alongside the other TypeScript utility scripts (`sync-version.ts`, `generate-docs.ts`, etc.) and follows the same convention of being run from the repository root.

---

## Usage

```zsh
# Make executable once
chmod +x scripts/count-loc.sh

# Full language breakdown (default)
./scripts/count-loc.sh

# Exclude lock files, *.d.ts, and minified files
./scripts/count-loc.sh --no-vendor

# Print only the grand total — useful for CI badges or scripting
./scripts/count-loc.sh --total

# Help
./scripts/count-loc.sh --help
```

### Options

| Flag | Description |
|---|---|
| *(none)* | Count all recognised source files; print a per-language table |
| `--no-vendor` | Additionally exclude lock files and generated/minified artefacts |
| `--total` | Print only the integer grand total and exit |
| `--help` / `-h` | Print usage and exit |

---

## Sample Output

```
Language                           Lines   Share
------------------------------ ----------  ------
TypeScript                          14823   71.2%
Markdown                             3201   15.4%
YAML                                  892    4.3%
JSON                                  741    3.6%
Shell                                 312    1.5%
CSS                                   289    1.4%
HTML                                  201    1.0%
TOML                                  198    1.0%
Python                                155    0.7%
------------------------------ ----------  ------
TOTAL                               20812  100%
```

---

## How It Works

### 1. Repo-root resolution

The script uses zsh's `${0:A:h}` (absolute path of the script's directory) and navigates one level up to find the repo root, so it works correctly regardless of where it is invoked from:

```zsh
SCRIPT_DIR="${0:A:h}"       # → /path/to/repo/scripts
REPO_ROOT="${SCRIPT_DIR:h}" # → /path/to/repo
cd "$REPO_ROOT"
```

### 2. Directory pruning

`find` prune expressions are built dynamically from `PRUNE_DIRS` to skip noisy directories in a single traversal pass:

```
node_modules  .git  dist  build  .wrangler
output  coverage  .turbo  .next  .angular
```

### 3. Language detection

Files are matched by extension using an associative array (`typeset -A EXT_LANG`). Dockerfiles (no extension) are matched by name pattern instead.

Recognised extensions:

| Extension(s) | Language |
|---|---|
| `.ts` | TypeScript |
| `.tsx` | TypeScript (TSX) |
| `.js` | JavaScript |
| `.mjs` / `.cjs` | JavaScript (ESM / CJS) |
| `.css` | CSS |
| `.scss` | SCSS |
| `.html` | HTML |
| `.py` | Python |
| `.sh` / `.zsh` | Shell / Zsh |
| `.toml` | TOML |
| `.yaml` / `.yml` | YAML |
| `.json` | JSON |
| `.md` | Markdown |
| `.sql` | SQL |
| `Dockerfile*` | Dockerfile |

### 4. Vendor filtering (`--no-vendor`)

When `--no-vendor` is passed, files matching the following patterns are excluded via `grep -v` after collection:

```
pnpm-lock.yaml   package-lock.json   deno.lock   yarn.lock
*.min.js         *.min.css           *.generated.ts   *.d.ts
```

### 5. Line counting

Lines are counted with `xargs wc -l`, which is the fastest approach on macOS and Linux for large file sets. The total is extracted from `wc`'s own summary line and accumulated per language.

---

## What Is and Is Not Counted

### Always counted (default mode)
- All source files matching the recognised extensions above
- Lock files (`pnpm-lock.yaml`, `deno.lock`, etc.)
- TypeScript declaration files (`*.d.ts`)
- Minified files

### Excluded by default
- `node_modules/`
- `.git/`
- `dist/`, `build/`, `output/`
- `.wrangler/`, `.angular/`, `.turbo/`, `.next/`
- `coverage/`

### Additionally excluded with `--no-vendor`
- `pnpm-lock.yaml`, `package-lock.json`, `deno.lock`, `yarn.lock`
- `*.d.ts`
- `*.min.js`, `*.min.css`
- `*.generated.ts`

> **Note:** The script counts *all* lines (including blank lines and comments). It does not perform semantic filtering. For blank/comment-stripped counts, use `tokei` or `cloc` (see [Alternatives](#alternatives) below).

---

## Integration

### CI / GitHub Actions

Use `--total` to surface the line count as a step output or log annotation:

```yaml
- name: Count lines of code
  run: |
    chmod +x scripts/count-loc.sh
    LOC=$(./scripts/count-loc.sh --total)
    echo "Total LOC: $LOC"
    echo "loc=$LOC" >> "$GITHUB_OUTPUT"
```

### Pre-commit hook

```zsh
# .git/hooks/pre-commit
#!/usr/bin/env zsh
echo "Repository LOC:"
./scripts/count-loc.sh --no-vendor
```

---

## Alternatives

For richer output (blank lines, comment lines, source lines broken out separately), install one of these popular tools:

```zsh
# tokei — fastest, Rust-based
brew install tokei
tokei .

# cloc — Perl-based, very detailed
brew install cloc
cloc --exclude-dir=node_modules,.git .
```

Both are referenced in a comment at the bottom of `count-loc.sh` as a reminder.

---

## Related

- [`scripts/count-loc.sh`](../../scripts/count-loc.sh) — the script itself
- [`development/benchmarks.md`](benchmarks.md) — performance benchmarking guide
- [`development/ARCHITECTURE.md`](ARCHITECTURE.md) — system architecture overview
