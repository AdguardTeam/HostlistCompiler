# Copilot Instructions for adblock-compiler

This repository contains the **Adblock Compiler** - a Deno-native, compiler-as-a-service for adblock filter lists. This document provides guidance to GitHub Copilot on how to work effectively with this codebase.

## Technology Stack

### Core Technologies

- **Deno 2.6.7+**: Primary runtime environment (NOT Node.js)
- **TypeScript**: All code is written in TypeScript with strict type checking
- **JSR (JavaScript Registry)**: Package is published to JSR at `@jk-com/adblock-compiler@0.8.8`
- **Cloudflare Workers**: Production deployment target for the worker implementation

### Supporting Technologies

- **Wrangler**: Cloudflare Workers deployment tool
- **Docker**: Container deployment support
- **Deno standard library**: `@std/path`, `@std/fs`, `@std/flags`, `@std/assert`, `@std/testing`, `@std/async`

## Project Structure

```
src/
├── cli/              # Command-line interface
├── compiler/         # Core compilation logic (FilterCompiler, SourceCompiler)
├── configuration/    # Configuration validation
├── downloader/       # Filter list downloading and fetching
├── platform/         # Platform abstraction (WorkerCompiler for edge runtimes)
├── transformations/  # Rule transformation implementations
├── types/            # TypeScript type definitions and interfaces
├── utils/            # Utility functions and helpers
└── index.ts          # Main library exports

worker/               # Cloudflare Worker implementation
public/               # Static web UI files
docs/                 # Documentation
examples/             # Example implementations
```

## Coding Conventions

### TypeScript Style

- **Strict typing**: Enable all strict TypeScript options (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`)
- **No `any` types**: Always use explicit types or `unknown` instead of `any`
- **Interface naming**: Use `I` prefix for interfaces (e.g., `IConfiguration`, `ILogger`, `IContentFetcher`)
- **Type imports**: Use `import type` for type-only imports when possible
- **Readonly**: Use `readonly` for arrays that shouldn't be mutated (e.g., `readonly string[]`)

### Formatting

- **Indentation**: 4 spaces (not tabs)
- **Line width**: 180 characters maximum (as configured in deno.json)
- **Semicolons**: Always use semicolons
- **Quotes**: Single quotes for strings (use double quotes for strings containing apostrophes)
- **Imports**:
  - Use explicit `.ts` extension for relative imports (Deno requirement)
  - Use import map aliases like `@std/path`, `@std/assert` (defined in `deno.json`)
  - Import map aliases resolve to JSR packages (e.g., `@std/path` → `jsr:@std/path@^1.0.0`)

### File Organization

- **Tests**: Co-locate tests with source files using `*.test.ts` suffix (e.g., `DeduplicateTransformation.test.ts`)
- **Exports**: Export from `index.ts` files for clean module boundaries
- **Dependencies**: Import from Deno standard library using import map aliases (e.g., `@std/path`, `@std/assert`)

### Code Structure

- **Classes**: Use classes for stateful components (compilers, transformations, fetchers)
- **Interfaces**: Define interfaces in `src/types/index.ts`
- **Utilities**: Pure functions in `src/utils/`
- **Logging**: Use the `ILogger` interface, pass loggers via constructor dependency injection

### Naming Conventions

- **Classes**: PascalCase (e.g., `FilterCompiler`, `DeduplicateTransformation`)
- **Interfaces**: PascalCase with `I` prefix (e.g., `IConfiguration`, `ILogger`)
- **Methods/Functions**: camelCase (e.g., `executeSync`, `prepareHeader`)
- **Constants**: UPPER_SNAKE_CASE for true constants (e.g., `MAX_RETRIES`, `DEFAULT_TIMEOUT`). These are typically module-level or class-level constants with values that never change.
- **Private fields**: Use `private readonly` when fields shouldn't change after construction

### Error Handling

- **Error messages**: Extract error messages using: `error instanceof Error ? error.message : String(error)`
- **Logging errors**: Log errors at appropriate levels (error, warn, info, debug)
- **Validation**: Validate configurations and inputs early
- **Graceful degradation**: Continue processing when possible, logging failures

## Transformations

Transformations are the core of the filter list processing pipeline. When creating or modifying transformations:

### Transformation Base Classes

- **SyncTransformation**: For synchronous transformations (most common)
- **AsyncTransformation**: For transformations requiring async operations

### Transformation Pattern

```typescript
import { TransformationType } from '../types/index.ts';
import { RuleUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

export class MyTransformation extends SyncTransformation {
    public readonly type = TransformationType.MyTransform;
    public readonly name = 'My Transform';

    public executeSync(rules: readonly string[]): readonly string[] {
        // Use this.info(), this.debug(), this.error() for logging
        this.info('Starting transformation');

        // Example: Remove all comment lines
        const result = rules.filter((rule) => !RuleUtils.isComment(rule));

        this.info(`Transformation completed: ${rules.length} → ${result.length} rules`);
        return result;
    }
}
```

### Available Transformations

1. `RemoveComments` - Removes comment lines
2. `Compress` - Converts hosts format to adblock format and removes redundant rules
3. `RemoveModifiers` - Strips unsupported modifiers from rules
4. `Validate` - Validates rules for DNS-level blocking (removes IP addresses)
5. `ValidateAllowIp` - Same as Validate but keeps IP addresses
6. `Deduplicate` - Removes duplicate rules while preserving order
7. `InvertAllow` - Converts blocking rules to allow rules
8. `RemoveEmptyLines` - Removes empty lines
9. `TrimLines` - Removes leading/trailing whitespace
10. `InsertFinalNewLine` - Adds final newline to output
11. `ConvertToAscii` - Converts non-ASCII characters to punycode

## Building and Testing

### Development Commands

```bash
# Run in development mode with watch
deno task dev

# Run the compiler
deno task compile

# Build standalone executable
deno task build

# Run ALL tests (tests are co-located with source in src/)
deno task test

# Run tests in watch mode
deno task test:watch

# Run tests with coverage
deno task test:coverage

# Run specific test file
deno test src/transformations/DeduplicateTransformation.test.ts

# Lint code
deno task lint

# Format code
deno task fmt

# Check formatting without modifying
deno task fmt:check

# Type check
deno task check

# Cache dependencies
deno task cache
```

### Testing Guidelines

- **Co-location**: Place tests next to source files (e.g., `MyClass.ts` and `MyClass.test.ts`)
- **Test framework**: Use Deno's built-in test framework
- **Assertions**: Use `@std/assert` for assertions
- **Test structure**: Use descriptive test names with `Deno.test('should do X when Y', () => { ... })`
- **Coverage**: Aim for comprehensive test coverage, especially for transformations

### Before Committing

1. Run `deno task fmt` to format code
2. Run `deno task check` to verify types
3. Run `deno task test` to ensure tests pass
4. Run `deno task lint` to check for lint issues (if enabled)

## Architecture Patterns

### Platform Abstraction

The codebase supports multiple runtimes through a platform abstraction layer:

- **FilterCompiler**: For Deno/Node.js with file system access
- **WorkerCompiler**: For edge runtimes (Cloudflare Workers, Deno Deploy, etc.) without file system
- **IContentFetcher**: Pluggable content fetching (HttpFetcher, PreFetchedContentFetcher, CompositeFetcher)

### Dependency Injection

- Pass dependencies (logger, events, fetchers) via constructor options
- Use interfaces for dependencies to enable testing and flexibility

### Event-Driven Architecture

- Use `ICompilerEvents` for progress tracking and observability
- Emit events for compilation progress, warnings, errors

## Documentation

### JSDoc Comments

- Add JSDoc comments to all public classes, interfaces, and methods
- Include `@param`, `@returns`, `@throws` where applicable
- Include `@example` for complex APIs

### Documentation Files

- `README.md`: User-facing documentation
- `docs/`: Detailed guides and API documentation
- `CHANGELOG.md`: Version history
- `CODE_REVIEW.md`: Code quality review and recommendations

## Version Management

- **Version sync**: Keep version consistent across `deno.json` and `package.json`
- **Version file**: `src/version.ts` contains the canonical version string
- **Publishing**: CI/CD automatically publishes to JSR on version changes to master branch

## Security

### Important Security Rules

- **NO `new Function()`**: Never use `Function` constructor or `eval()` - use safe parsers instead
- **Input validation**: Always validate user inputs and configurations
- **Dependency scanning**: Security scans run automatically in CI via Trivy
- **CORS handling**: Pre-fetch content server-side in Worker to avoid CORS issues

## Platform-Specific Notes

### Cloudflare Workers

- Worker implementation in `worker/worker.ts`
- Use `WorkerCompiler` instead of `FilterCompiler`
- Pre-fetch all filter list content to avoid CORS restrictions
- Support streaming compilation via Server-Sent Events
- Web UI in `public/index.html` and `public/test.html`

### Docker

- Multi-stage builds using Deno and Node.js
- Configuration via `docker-compose.yml`
- Health checks included

## Common Tasks

### Adding a New Transformation

1. Add the transformation type to `TransformationType` enum in `src/types/index.ts`
2. Create `src/transformations/MyTransformation.ts` extending `SyncTransformation` or `AsyncTransformation`
3. Register in `TransformationRegistry.ts`
4. Create `src/transformations/MyTransformation.test.ts` with comprehensive tests
5. Document in `README.md` transformations section

### Adding a New Content Fetcher

1. Implement `IContentFetcher` interface
2. Add to `CompositeFetcher` chain as needed
3. Test with various source types
4. Document usage patterns

### Modifying the Compiler

- **FilterCompiler**: Main compiler with file system access
- **WorkerCompiler**: Platform-agnostic compiler for edge runtimes
- Avoid code duplication between the two - extract shared logic to utilities

## Resources

- **JSR Package**: https://jsr.io/@jk-com/adblock-compiler
- **Live Web UI**: https://adblock-compiler.jayson-knight.workers.dev/
- **AdGuard DNS Syntax**: https://adguard-dns.io/kb/general/dns-filtering-syntax/
- **Deno Manual**: https://deno.land/manual
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/

## Don't Do

- Don't use Node.js-specific APIs (use Deno standard library instead)
- Don't use `npm:` imports unless absolutely necessary (prefer JSR)
- Don't use `any` types
- Don't create tests in a separate `test/` directory (co-locate with source)
- Don't commit without running formatting and type checking
- Don't introduce breaking changes to the public API without documentation
- Don't use `Function` constructor or `eval()` for security reasons

## Questions or Clarifications

When uncertain about:

- **Architecture decisions**: Refer to existing patterns in `src/compiler/` and `src/platform/`
- **Transformation logic**: Check existing transformations in `src/transformations/`
- **API design**: Review `src/types/index.ts` for interface definitions
- **Testing patterns**: Look at existing `*.test.ts` files
- **Code quality**: Refer to `CODE_REVIEW.md` for best practices

## Summary

This is a mature, production-ready Deno TypeScript project with strict typing, comprehensive testing, and multi-platform support. Prioritize type safety, clean abstractions, and thorough testing. Follow the established patterns for transformations, fetchers, and compilers.
