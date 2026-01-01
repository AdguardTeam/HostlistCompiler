# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is `@adguard/hostlist-compiler`, a TypeScript tool that compiles DNS blocklists from multiple sources into AdGuard-compatible filter lists. The project is currently undergoing migration from Node.js to Deno (partial migration complete).

**Important:** This codebase maintains both Node.js and Deno versions. Deno files use `.deno.ts` suffix. When modifying code, consider which runtime you're targeting.

## Development Commands

### Node.js Version (Current Production)

```powershell
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Lint code
npm run lint
npm run lint:fix

# Run tests (using Jest)
npm test
npm run test:watch
npm run test:coverage

# Run the compiler
npm run compile -- -c examples/sdn/configuration.json -o output.txt

# Or use the built CLI directly
node dist/cli.js -c config.json -o output.txt
```

### Deno Version (In Progress)

```powershell
# Run tests
deno task test

# Lint and format
deno task lint
deno task fmt
deno fmt --check src/

# Type check
deno task check

# Run the compiler
deno task compile -c config.json -o output.txt
```

### Running Single Tests

**Node.js (Jest):**
```powershell
# Run a specific test file
npm test -- test/ConfigurationValidator.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should validate"
```

**Deno:**
```powershell
# Run a specific test file
deno test --allow-read --allow-write --allow-net test/ConfigurationValidator.test.ts

# Run tests matching a filter
deno test --filter "should validate"
```

## Architecture

### Core Design Patterns

The codebase follows these architectural patterns:

1. **Registry Pattern**: `TransformationRegistry` manages all transformation types
2. **Pipeline Pattern**: `TransformationPipeline` applies transformations in strict order
3. **Strategy Pattern**: Each transformation is a self-contained strategy implementing `Transformation` interface
4. **Dependency Injection**: Loggers and services are injected via constructors

### Key Components

#### 1. Compiler Layer (`src/compiler/`)
- **`FilterCompiler`**: Main orchestrator that coordinates the entire compilation process
  - Validates configuration via `ConfigurationValidator`
  - Processes multiple sources through `SourceCompiler`
  - Applies global transformations via `TransformationPipeline`
  - Generates headers with metadata

- **`SourceCompiler`**: Handles individual source compilation
  - Downloads or reads source files
  - Applies source-specific transformations
  - Manages per-source exclusions/inclusions

#### 2. Transformation System (`src/transformations/`)

Transformations are applied in **fixed order** (defined in `TransformationPipeline.getOrderedTransformations()`):

1. `ConvertToAscii` - Always first (converts internationalized domains)
2. `TrimLines`
3. `RemoveComments`
4. `Compress` - Converts `/etc/hosts` → adblock syntax, removes redundant rules
5. `RemoveModifiers` - Strips unsupported modifiers ($third-party, $document, etc.)
6. `InvertAllow` - Converts blocking rules to allowlist rules
7. `Validate` / `ValidateAllowIp` - Removes invalid/dangerous rules
8. `Deduplicate`
9. `RemoveEmptyLines`
10. `InsertFinalNewLine` - Always last

**Base Classes:**
- `Transformation`: Abstract base for all transformations
- `SyncTransformation`: For synchronous transformations
- `AsyncTransformation`: For async transformations

#### 3. Configuration System (`src/configuration/`)
- **`ConfigurationValidator`**: Uses AJV JSON Schema validation
- Schema defined in `src/schemas/configuration.schema.json`
- Validates both top-level config and source-level settings

#### 4. Services (`src/services/`)
- **`FilterService`**: Handles wildcard matching, exclusions, inclusions
- Supports plain strings, wildcards (`*.example.com`), and regex (`/pattern/`)

#### 5. Utilities (`src/utils/`)
- **`RuleUtils`**: Rule parsing (adblock & hosts formats), domain extraction
- **`StringUtils`**: Text manipulation utilities
- **`Wildcard`**: Pattern matching implementation

#### 6. CLI (`src/cli/`)
- **Node.js**: `CliApp.ts` uses `yargs` for argument parsing
- **Deno**: `CliApp.deno.ts` uses `@std/flags`

### Data Flow

```
Configuration (JSON)
    ↓
FilterCompiler.compile()
    ↓
For each source:
    SourceCompiler.compile()
        ↓ Download/Read source
        ↓ Apply source transformations (TransformationPipeline)
        ↓ Apply source exclusions/inclusions
        ↓ Return rules[]
    ↓
Merge all source rules
    ↓
Apply global transformations (TransformationPipeline)
    ↓
Apply global exclusions/inclusions
    ↓
Add headers (metadata)
    ↓
Return final rules[]
```

## Deno Migration Status

**Completed:**
- `deno.json` configuration
- `src/cli.deno.ts` entry point
- `src/cli/CliApp.deno.ts` CLI application
- Build/test configurations

**TODO (per DENO_MIGRATION.md):**
- Migrate all `src/compiler/` files
- Migrate all `src/transformations/` files
- Migrate all `src/configuration/` files
- Convert Jest tests to Deno tests
- Replace `axios` with `fetch` API
- Test `@adguard/filters-downloader` compatibility with `npm:` specifier

**When modifying Deno files:**
- Replace `fs/promises` with `Deno.readTextFile()` / `Deno.writeTextFile()`
- Replace `process.exit()` with `Deno.exit()`
- Replace `process.argv` with `Deno.args`
- Use `import.meta.main` instead of `require.main === module`
- Add `.ts` extensions to all imports
- Use `npm:` prefix for npm packages (e.g., `npm:lodash@^4.17.21`)

## Testing Conventions

### Current (Jest)
- Test files: `*.test.ts` or `*.test.js`
- Setup file: `test/setup.ts`
- Uses `@jest/globals` for assertions
- Tests are co-located with implementation in some cases

### Target (Deno)
- Per user rule: **All Jest tests should be updated to Deno, and any Jest dependencies removed**
- Use `Deno.test()` instead of `describe()`/`it()`
- Use `@std/assert` assertions
- Remove `@types/*` dependencies

## Configuration Format

Minimal valid configuration:
```json
{
  "name": "My Blocklist",
  "sources": [
    {
      "source": "https://example.org/hosts.txt"
    }
  ]
}
```

Full configuration example at `examples/sdn/configuration.json`

## Important Implementation Details

### Transformation Order Matters
The order in `TransformationPipeline.getOrderedTransformations()` is **not arbitrary**. For example:
- `ConvertToAscii` must run first (before domain validation)
- `Compress` must run before `Validate` (to normalize rule format)
- `InsertFinalNewLine` must run last

**Never reorder transformations without understanding dependencies.**

### Exclusions Must Match Rule Format
Exclusions are applied via string/regex matching. If you have:
- `/etc/hosts` rules: `0.0.0.0 example.com`
- Exclusion: `||example.com^`

They **won't match** unless you apply `Compress` transformation first to convert hosts → adblock syntax.

### Rule Parsing Is Format-Specific
- `RuleUtils.parseAdblockRule()` - for adblock-style rules (`||domain^$options`)
- `RuleUtils.parseEtcHostsRule()` - for hosts-style rules (`0.0.0.0 domain`)

### Dependencies with Side Effects
- `@adguard/filters-downloader`: Downloads filter lists with caching
- `consola`: Logging library used throughout (can be replaced via DI)
- `tldts`: TLD extraction and validation

## Build Output

- **Node.js**: Compiles to `dist/` directory
  - `dist/cli.js` - CLI entry point
  - `dist/index.js` - Library entry point
  - `dist/index.d.ts` - TypeScript declarations

- **Deno**: No build step (runs TypeScript directly)
  - Can create standalone executable: `deno compile --output hostlist-compiler src/cli.deno.ts`

## Publishing

- NPM package: `@adguard/hostlist-compiler`
- Main entry: `dist/index.js`
- Types: `dist/index.d.ts`
- Binary: `dist/cli.js` (via `bin` field in package.json)

## Code Style

- TypeScript strict mode enabled
- Indentation: 4 spaces
- Line width: 100 characters (Deno) / unspecified (Node.js)
- Semi-colons: required
- Quotes: single quotes (Deno format)
- ESLint config: `.eslintrc.js` (for Node.js code)
