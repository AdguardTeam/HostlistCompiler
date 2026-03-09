# CLI Reference

← [Back to README](../../README.md)

The `adblock-compiler` CLI is the primary entry-point for compiling filter lists locally with full control over the transformation pipeline, HTTP fetching, filtering, and output.

## Installation

```bash
# Run directly with Deno (no install)
deno run --allow-read --allow-write --allow-net jsr:@jk-com/adblock-compiler/cli -c config.json -o output.txt

# Install globally
deno install --allow-read --allow-write --allow-net -n adblock-compiler jsr:@jk-com/adblock-compiler/cli
```

## Usage

```
adblock-compiler [options]
```

---

## Options

### General

| Flag | Short | Type | Description |
|---|---|---|---|
| `--config <file>` | `-c` | string | Path to the compiler configuration file |
| `--input <source>` | `-i` | string[] | URL or file path to compile (repeatable) |
| `--input-type <type>` | `-t` | `hosts`\|`adblock` | Input format [default: `hosts`] |
| `--verbose` | `-v` | boolean | Enable verbose logging |
| `--benchmark` | `-b` | boolean | Show performance benchmark report |
| `--use-queue` | `-q` | boolean | Submit job to async queue (requires worker API) |
| `--priority <level>` | | `standard`\|`high` | Queue priority [default: `standard`] |
| `--version` | | boolean | Show version number |
| `--help` | `-h` | boolean | Show help |

> Either `--config` or `--input` must be provided (but not both).

---

### Output

| Flag | Short | Type | Description |
|---|---|---|---|
| `--output <file>` | `-o` | string | Output file path [required unless `--stdout`] |
| `--stdout` | | boolean | Write output to stdout instead of a file |
| `--append` | | boolean | Append to output file instead of overwriting |
| `--format <format>` | | string | Output format |
| `--name <file>` | | string | Compare output against an existing file and print a summary of added/removed rules |
| `--max-rules <n>` | | number | Truncate output to at most `n` rules |

> `--stdout` and `--output` are mutually exclusive.

---

### Transformation Control

When no transformation flags are specified, the default pipeline is used:
`RemoveComments` → `Deduplicate` → `Compress` → `Validate` → `TrimLines` → `InsertFinalNewLine`

| Flag | Type | Description |
|---|---|---|
| `--no-comments` | boolean | Skip the `RemoveComments` transformation |
| `--no-deduplicate` | boolean | Skip the `Deduplicate` transformation |
| `--no-compress` | boolean | Skip the `Compress` transformation |
| `--no-validate` | boolean | Skip the `Validate` transformation |
| `--allow-ip` | boolean | Replace `Validate` with `ValidateAllowIp` (keeps IP-address rules) |
| `--invert-allow` | boolean | Append the `InvertAllow` transformation |
| `--remove-modifiers` | boolean | Append the `RemoveModifiers` transformation |
| `--convert-to-ascii` | boolean | Append the `ConvertToAscii` transformation |
| `--transformation <name>` | string[] | **Override** the entire pipeline (repeatable). When provided, all other transformation flags are ignored. |

**Available transformation names for `--transformation`:**

| Name | Description |
|---|---|
| `RemoveComments` | Remove `!` and `#` comment lines |
| `Deduplicate` | Remove duplicate rules |
| `Compress` | Convert hosts-format rules to adblock syntax and remove redundant entries |
| `Validate` | Remove dangerous or incompatible rules (strips IP-address rules) |
| `ValidateAllowIp` | Like `Validate` but keeps IP-address rules |
| `InvertAllow` | Convert blocking rules to allow/exception rules |
| `RemoveModifiers` | Strip unsupported modifiers (`$third-party`, `$document`, etc.) |
| `TrimLines` | Remove leading/trailing whitespace from each line |
| `InsertFinalNewLine` | Ensure the output ends with a newline |
| `RemoveEmptyLines` | Remove blank lines |
| `ConvertToAscii` | Convert non-ASCII hostnames to Punycode |

> See [TRANSFORMATIONS.md](TRANSFORMATIONS.md) for detailed descriptions of each transformation.

---

### Filtering

These flags apply globally to the compiled output (equivalent to `IConfiguration.exclusions` / `inclusions`).

| Flag | Type | Description |
|---|---|---|
| `--exclude <pattern>` | string[] | Exclude rules matching the pattern (repeatable). Supports exact strings, `*` wildcards, and `/regex/` patterns. Maps to `exclusions[]`. |
| `--exclude-from <file>` | string[] | Load exclusion patterns from a file (repeatable). Maps to `exclusions_sources[]`. |
| `--include <file>` | string[] | Load inclusion patterns from a file (repeatable). Maps to `inclusions_sources[]`. |

When used with `--config`, these flags are overlaid on top of any `exclusions` / `inclusions` already defined in the config file.

---

### Networking

| Flag | Type | Description |
|---|---|---|
| `--timeout <ms>` | number | HTTP request timeout in milliseconds |
| `--retries <n>` | number | Number of HTTP retry attempts (uses exponential backoff) |
| `--user-agent <string>` | string | Custom `User-Agent` header for HTTP requests |

---

## Examples

### Basic compilation from a config file

```bash
adblock-compiler -c config.json -o output.txt
```

### Compile from multiple URL sources

```bash
adblock-compiler \
  -i https://example.org/hosts.txt \
  -i https://example.org/extra.txt \
  -o output.txt
```

### Stream output to stdout

```bash
adblock-compiler -i https://example.org/hosts.txt --stdout
```

### Skip specific transformations

```bash
# Keep IP-address rules and skip compression
adblock-compiler -c config.json -o output.txt --allow-ip --no-compress

# Skip deduplication (faster, output may contain duplicates)
adblock-compiler -c config.json -o output.txt --no-deduplicate
```

### Explicit transformation pipeline

```bash
# Only remove comments and deduplicate — no compression or validation
adblock-compiler -i https://example.org/hosts.txt -o output.txt \
  --transformation RemoveComments \
  --transformation Deduplicate \
  --transformation TrimLines \
  --transformation InsertFinalNewLine
```

### Filtering rules from output

```bash
# Exclude specific domain patterns
adblock-compiler -c config.json -o output.txt \
  --exclude "*.cdn.example.com" \
  --exclude "ads.example.org"

# Load exclusion list from a file
adblock-compiler -c config.json -o output.txt \
  --exclude-from my-whitelist.txt
```

### Limit output size

```bash
# Truncate to first 50,000 rules
adblock-compiler -c config.json -o output.txt --max-rules 50000
```

### Compare output against a previous build

```bash
adblock-compiler -c config.json -o output.txt --name output.txt.bak
# Output:
# Comparison with output.txt.bak:
#   Added:   +42 rules
#   Removed: -7 rules
#   Net:     +35 rules
```

### Append to an existing output file

```bash
adblock-compiler -i extra.txt -o output.txt --append
```

### Custom networking options

```bash
adblock-compiler -c config.json -o output.txt \
  --timeout 15000 \
  --retries 5 \
  --user-agent "MyListBot/1.0"
```

### Verbose benchmarking

```bash
adblock-compiler -c config.json -o output.txt --verbose --benchmark
```

---

## Configuration File

When using `--config`, the compiler reads an `IConfiguration` JSON file. The CLI filtering and transformation flags are applied as an overlay *on top of* what is defined in that file.

See [CONFIGURATION.md](CONFIGURATION.md) for the full configuration file reference.
