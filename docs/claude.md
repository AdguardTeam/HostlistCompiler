# CLAUDE.md - AI Assistant Guide

This document provides essential context for AI assistants working with the adblock-compiler codebase.

## Project Overview

**AdBlock Compiler** is a Compiler-as-a-Service for adblock filter lists. It transforms, optimizes, and combines filter lists from multiple sources with real-time progress tracking.

- **Version:** 0.7.12
- **Runtime:** Deno 2.4+ (primary), Node.js compatible, Cloudflare Workers compatible
- **Language:** TypeScript (strict mode, 100% type-safe)
- **License:** GPL-3.0
- **JSR Package:** `@jk-com/adblock-compiler`

## Quick Commands

```bash
# Development
deno task dev              # Development with watch mode
deno task compile          # Run compiler CLI

# Testing
deno task test             # Run all tests
deno task test:watch       # Tests in watch mode
deno task test:coverage    # Generate coverage reports

# Code Quality
deno task lint             # Lint code
deno task fmt              # Format code
deno task fmt:check        # Check formatting
deno task check            # Type check

# Build & Deploy
deno task build            # Build standalone executable
npm run dev                # Run wrangler dev server (port 8787)
npm run deploy             # Deploy to Cloudflare Workers

# Benchmarks
deno task bench            # Run performance benchmarks
```

## Project Structure

```
src/
├── cli/                   # CLI implementation (ArgumentParser, ConfigurationLoader)
├── compiler/              # Core compilation (FilterCompiler, SourceCompiler)
├── configuration/         # Config validation (pure TypeScript, no AJV)
├── transformations/       # 11 rule transformations (see below)
├── downloader/            # Content fetching & preprocessing
├── platform/              # Platform abstraction (Workers, Deno, Node.js)
├── storage/               # Caching & health monitoring
├── filters/               # Rule filtering utilities
├── utils/                 # Utilities (RuleUtils, Wildcard, TldUtils, etc.)
├── types/                 # TypeScript interfaces (IConfiguration, ISource)
├── index.ts               # Library exports
├── mod.ts                 # Deno module exports
└── cli.deno.ts            # Deno CLI entry point

worker/
├── worker.ts              # Cloudflare Worker (main API handler)
└── html.ts                # HTML templates

public/                    # Static web UI assets
examples/                  # Example filter list configurations
docs/                      # Additional documentation
```

## Architecture Patterns

The codebase uses these key patterns:

- **Strategy Pattern:** Transformations (SyncTransformation, AsyncTransformation)
- **Builder Pattern:** TransformationPipeline construction
- **Factory Pattern:** TransformationRegistry
- **Composite Pattern:** CompositeFetcher for chaining fetchers
- **Adapter Pattern:** Platform abstraction layer

### Two Compiler Classes

1. **FilterCompiler** (`src/compiler/`) - File system-based, for Deno/Node.js CLI
2. **WorkerCompiler** (`src/platform/`) - Platform-agnostic, for Workers/browsers

## Transformation System

11 available transformations applied in order:

1. `ConvertToAscii` - Non-ASCII to Punycode
2. `RemoveComments` - Remove ! and # comment lines
3. `Compress` - Hosts to adblock syntax conversion
4. `RemoveModifiers` - Strip unsupported modifiers
5. `Validate` - Remove dangerous/incompatible rules
6. `ValidateAllowIp` - Like Validate but keeps IPs
7. `Deduplicate` - Remove duplicate rules
8. `InvertAllow` - Convert blocks to allow rules
9. `RemoveEmptyLines` - Remove blank lines
10. `TrimLines` - Remove leading/trailing whitespace
11. `InsertFinalNewLine` - Add final newline

All transformations extend `SyncTransformation` or `AsyncTransformation` base classes in `src/transformations/base/`.

## Code Conventions

### Naming

- **Classes:** PascalCase (`FilterCompiler`, `RemoveCommentsTransformation`)
- **Functions/methods:** camelCase (`executeSync`, `validate`)
- **Constants:** UPPER_SNAKE_CASE (`CACHE_TTL`, `RATE_LIMIT_MAX_REQUESTS`)
- **Interfaces:** I-prefixed (`IConfiguration`, `ILogger`, `ISource`)
- **Enums:** PascalCase (`TransformationType`, `SourceType`)

### File Organization

- Each module in its own directory with `index.ts` exports
- Tests co-located as `*.test.ts` next to source files
- No deeply nested directory structures

### TypeScript

- Strict mode enabled (all strict options)
- No implicit any
- Explicit return types on public methods
- Use interfaces over type aliases for object shapes

### Error Handling

- Custom error types for specific scenarios
- Validation results over exceptions where possible
- Retry logic with exponential backoff for network operations

## Testing

Tests use Deno's native testing framework:

```bash
# Run all tests
deno test --allow-read --allow-write --allow-net --allow-env

# Run specific test file
deno test src/utils/RuleUtils.test.ts --allow-read

# Run with coverage
deno task test:coverage
```

Test file conventions:

- Co-located with source: `FileName.ts` -> `FileName.test.ts`
- Use `Deno.test()` with descriptive names
- Mock external dependencies (network, file system)

## Configuration Schema

```typescript
interface IConfiguration {
    name: string; // Required
    description?: string;
    homepage?: string;
    license?: string;
    version?: string;
    sources: ISource[]; // Required, non-empty
    transformations?: TransformationType[];
    exclusions?: string[]; // Patterns to exclude
    inclusions?: string[]; // Patterns to include
}

interface ISource {
    source: string; // URL or file path
    name?: string;
    type?: 'adblock' | 'hosts';
    transformations?: TransformationType[];
    exclusions?: string[];
    inclusions?: string[];
}
```

Pattern types: plain string (contains), `*.wildcard`, `/regex/`

## API Endpoints (Worker)

- `POST /compile` - JSON compilation API
- `POST /compile/stream` - Streaming with SSE
- `POST /compile/batch` - Batch up to 10 lists
- `POST /compile/async` - Queue-based async compilation
- `POST /compile/batch/async` - Queue-based batch compilation
- `GET /metrics` - Performance metrics
- `GET /` - Interactive web UI

## Key Files to Know

| File                                            | Purpose                       |
| ----------------------------------------------- | ----------------------------- |
| `src/compiler/FilterCompiler.ts`                | Main compilation logic        |
| `src/platform/WorkerCompiler.ts`                | Platform-agnostic compiler    |
| `src/transformations/TransformationRegistry.ts` | Transformation management     |
| `src/configuration/ConfigurationValidator.ts`   | Config validation             |
| `src/downloader/FilterDownloader.ts`            | Content fetching with retries |
| `src/types/index.ts`                            | Core type definitions         |
| `worker/worker.ts`                              | Cloudflare Worker API handler |
| `deno.json`                                     | Deno tasks and configuration  |
| `wrangler.toml`                                 | Cloudflare Workers config     |

## Platform Support

The codebase supports multiple runtimes through the platform abstraction layer:

- **Deno** (primary) - Full file system access
- **Node.js** - npm-compatible via `package.json`
- **Cloudflare Workers** - No file system, HTTP-only
- **Web Workers** - Browser background threads

Use `FilterCompiler` for CLI/server environments, `WorkerCompiler` for edge/browser.

## Dependencies

Minimal external dependencies:

- `@luca/cases` (JSR) - String case conversion
- `@std/*` (Deno Standard Library) - Core utilities
- `tldts` (npm) - TLD/domain parsing
- `wrangler` (dev) - Cloudflare deployment

## Common Tasks

### Adding a New Transformation

1. Create `src/transformations/MyTransformation.ts`
2. Extend `SyncTransformation` or `AsyncTransformation`
3. Implement `execute(lines: string[]): string[]`
4. Register in `TransformationRegistry.ts`
5. Add to `TransformationType` enum in `src/types/index.ts`
6. Write co-located tests

### Modifying the API

1. Edit `worker/worker.ts`
2. Update route handlers
3. Test with `npm run dev`
4. Deploy with `npm run deploy`

### Adding CLI Options

1. Edit `src/cli/ArgumentParser.ts`
2. Update `parseArguments()` function
3. Handle in `src/cli/CliApp.deno.ts`

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):

1. **Test:** Run all tests with coverage
2. **Type Check:** Full TypeScript validation
3. **Security:** Trivy vulnerability scanning
4. **JSR Publish:** Auto-publish on master push
5. **Worker Deploy:** Deploy to Cloudflare Workers
6. **Pages Deploy:** Deploy static assets

## Environment Variables

See `.env.example` for available options:

- `PORT` - Server port (default: 8787)
- `DENO_DIR` - Deno cache directory
- Cloudflare bindings configured in `wrangler.toml`

## Useful Links

- [README.md](../README.md) - Full project documentation
- [TESTING.md](testing.md) - Testing guide
- [docs/api/README.md](api/README.md) - API documentation
- [docs/EXTENSIBILITY.md](EXTENSIBILITY.md) - Custom extensions
- [CHANGELOG.md](../CHANGELOG.md) - Version history
