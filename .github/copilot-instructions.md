# Copilot Instructions for adblock-compiler

This repository contains the **Adblock Compiler** - a Deno-native, compiler-as-a-service for adblock filter lists, with an Angular 21 frontend web UI. This document provides guidance to GitHub Copilot on how to work effectively with this codebase.

## Technology Stack

### Core Technologies

- **Deno 2.6.7+**: Primary runtime environment for the backend/compiler (NOT Node.js)
- **TypeScript**: All code is written in TypeScript with strict type checking
- **JSR (JavaScript Registry)**: Package is published to JSR at `@jk-com/adblock-compiler@0.8.8`
- **Cloudflare Workers**: Production deployment target for the worker implementation
- **Angular 21**: Frontend web UI (standalone components, signals, zoneless change detection)

### Supporting Technologies

- **Wrangler**: Cloudflare Workers deployment tool
- **Docker**: Container deployment support
- **Deno standard library**: `@std/path`, `@std/fs`, `@std/flags`, `@std/assert`, `@std/testing`, `@std/async`
- **Angular Material 21**: UI component library for the frontend
- **Vitest + @analogjs/vitest-angular**: Unit testing framework for the Angular frontend
- **@angular/ssr**: Server-side rendering for the Angular frontend

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
frontend/             # Angular 21 web UI (standalone components, signals, SSR)
├── src/app/          # Angular application source
│   ├── compiler/     # Compiler UI feature area (standalone components)
│   ├── services/     # Angular services (signal-based state)
│   ├── guards/       # Route guards (functional)
│   └── interceptors/ # HTTP interceptors (functional)
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
- **`noUnusedLocals` / `noUnusedParameters`**: Both are enabled in `compilerOptions` — unused variables and parameters are **compile errors**, not warnings. Remove them or prefix with `_` if intentionally unused.
- **Tagged TODOs**: The `ban-untagged-todo` lint rule is enforced. All `TODO` comments must include a tag (e.g., `// TODO(@jaypatrick): ...` or `// TODO(#123): ...`). Bare `// TODO:` will fail CI.

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
- **Extensibility**: Design code to be open for extension and closed for modification — prefer interfaces and base classes over concrete implementations when adding new capabilities, so existing behavior is not disturbed

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

### Backend Development Commands (Deno)

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

# Run contract tests against the OpenAPI spec (requires live worker)
deno task test:contract

# Run end-to-end tests against the deployed worker
deno task test:e2e

# Run E2E API tests only
deno task test:e2e:api

# Run E2E WebSocket tests only
deno task test:e2e:ws

# Run benchmarks
deno task bench

# Validate OpenAPI spec
deno task openapi:validate

# Generate schema artifacts (run after any API change)
deno task schema:generate

# Check for drift between generated artifacts and committed files
deno task check:drift

# Orchestrate fmt:check → lint → check → openapi:validate → schema:generate → check:drift
deno task preflight

# Full preflight including all extended checks
deno task preflight:full
```

### Frontend Development Commands (Angular)

```bash
# Start Angular dev server
pnpm --filter adblock-compiler-frontend start

# Build Angular app
pnpm --filter adblock-compiler-frontend build

# Run Angular unit tests with Vitest
pnpm --filter adblock-compiler-frontend test

# Run tests in watch mode
pnpm --filter adblock-compiler-frontend test:watch

# Run tests with coverage
pnpm --filter adblock-compiler-frontend test:coverage

# Lint Angular code
pnpm --filter adblock-compiler-frontend lint
```

### Backend Testing Guidelines (Deno)

- **Always use Deno's built-in test framework** for all `src/` and `worker/` TypeScript code
- **Co-location**: Place tests next to source files (e.g., `MyClass.ts` and `MyClass.test.ts`)
- **Assertions**: Use `@std/assert` for assertions
- **Test structure**: Use descriptive test names with `Deno.test('should do X when Y', () => { ... })`
- **Coverage**: Aim for comprehensive test coverage, especially for transformations

### Frontend Testing Guidelines (Angular + Vitest)

- **Always use Vitest** (via `@analogjs/vitest-angular`) for all `frontend/` Angular code — never use Karma/Jasmine
- **Co-location**: Place spec files next to source files (e.g., `my.component.ts` and `my.component.spec.ts`)
- **Test utilities**: Use `@angular/core/testing` (`TestBed`, `ComponentFixture`) with Vitest's `describe`/`it`/`expect`
- **Signal testing**: Use `TestBed.flushEffects()` to flush pending signal effects before asserting
- **Zoneless**: Tests run in a zoneless context — use `fixture.detectChanges()` explicitly after state mutations
- **Test structure**:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MyComponent],
            providers: [provideZonelessChangeDetection()],
        }).compileComponents();
    });

    it('should render correctly', () => {
        const fixture = TestBed.createComponent(MyComponent);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('expected text');
    });
});
```

### Before Committing

1. Run `deno task preflight` (orchestrates fmt:check → lint → check → openapi:validate → schema:generate → check:drift) — or `deno task preflight:full` for all extended checks
2. Run `deno task test` to ensure backend tests pass
3. Run `pnpm --filter adblock-compiler-frontend lint` to lint Angular code
4. Run `pnpm --filter adblock-compiler-frontend test` to ensure frontend tests pass
5. After any API change, run `deno task schema:generate` and commit the updated `docs/api/cloudflare-schema.yaml`, `docs/postman/postman-collection.json`, and `docs/postman/postman-environment.json`
6. Run `deno task setup:hooks` once locally to install the pre-push hook that catches drift before pushing

## Angular Frontend (Angular 21)

The `frontend/` directory contains an Angular 21 web UI. Always use modern Angular 21 patterns — never use legacy NgModule-based patterns.

### Core Angular 21 Principles

- **Standalone components only**: Never use `NgModule`. Every component, directive, and pipe must be `standalone: true`
- **Signals for state**: Use `signal()`, `computed()`, `effect()` for reactive state — avoid `BehaviorSubject` for local component state
- **Zoneless change detection**: The app uses `provideZonelessChangeDetection()` — never import or rely on Zone.js
- **`inject()` function**: Use `inject()` for dependency injection inside functions, factories, and as a class field initializer — avoid constructor injection except when necessary
- **Modern control flow**: Use `@if`, `@for`, `@switch` — never use `*ngIf`, `*ngFor`, `*ngSwitch` structural directives

### Component Pattern

```typescript
import { Component, inject, signal, computed, input, output } from '@angular/core';

@Component({
    selector: 'app-my-component',
    standalone: true,
    imports: [/* only what this component needs */],
    template: `
        @if (isLoading()) {
            <mat-spinner />
        } @else {
            @for (item of items(); track item.id) {
                <div>{{ item.name }}</div>
            }
        }
    `,
})
export class MyComponent {
    private readonly myService = inject(MyService);

    // Signal inputs (preferred over @Input decorator)
    readonly title = input<string>('');
    readonly items = input.required<Item[]>();

    // Signal outputs (preferred over @Output decorator)
    readonly selected = output<Item>();

    // Local writable signal
    protected readonly isLoading = signal(false);

    // Computed signal derived from inputs/state
    protected readonly itemCount = computed(() => this.items().length);
}
```

### Service Pattern (Signal-based state)

```typescript
import { Injectable, signal, computed, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MyService {
    private readonly http = inject(HttpClient);

    // Private writable, public readonly computed
    private readonly _items = signal<Item[]>([]);
    readonly items = this._items.asReadonly();
    readonly count = computed(() => this._items().length);

    async loadItems(): Promise<void> {
        const data = await firstValueFrom(this.http.get<Item[]>('/api/items'));
        this._items.set(data);
    }
}
```

### Routing

- Use functional route guards (`CanActivateFn`) — never class-based guards
- Use `withComponentInputBinding()` to bind route params as signal inputs
- Lazy-load feature routes with `loadComponent` or `loadChildren`

```typescript
export const routes: Routes = [
    {
        path: 'compiler',
        loadComponent: () => import('./compiler/compiler.component').then(m => m.CompilerComponent),
        canActivate: [myFunctionalGuard],
    },
];
```

### Forms

- Use **typed reactive forms** — always provide explicit generic types to `FormControl<T>`, `FormGroup<T>`, `FormArray<T>`
- Never use `UntypedFormControl` or the `any` escape hatch

```typescript
const form = new FormGroup({
    url: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    enabled: new FormControl<boolean>(true, { nonNullable: true }),
});
```

### HTTP

- Use `HttpClient` with `withFetch()` (already configured in `app.config.ts`)
- Prefer `firstValueFrom()` / `lastValueFrom()` over `.subscribe()` for one-shot requests
- Use functional HTTP interceptors (`HttpInterceptorFn`) — never class-based interceptors

### SSR / Prerendering

- Use `inject(DOCUMENT)` for DOM access — never reference `document` directly (breaks SSR)
- Use `isPlatformBrowser(inject(PLATFORM_ID))` to guard browser-only code
- Render modes are defined in `app.routes.server.ts` — consult it before adding new routes

### Angular Material

- Import only the specific Material modules needed per component (tree-shakeable)
- Use `provideAnimationsAsync()` (already in `app.config.ts`) — never `BrowserAnimationsModule`

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

### OpenTelemetry / Tracing

- The codebase uses `@opentelemetry/api` for distributed tracing
- Call `createTracingContext()` when instantiating `WorkerCompiler` in new Worker handlers — every compilation endpoint must propagate a tracing context
- Pass the `tracingContext` option through to `WorkerCompiler` constructor options

### Request Deduplication

- `worker.ts` maintains an in-memory `pendingCompilations` Map keyed by cache key to deduplicate in-flight compilation requests
- When adding or modifying compilation handlers, preserve this deduplication pattern — do not bypass or duplicate it

### Async Queue Pattern (Cloudflare Queues)

- Long-running or batch operations use Cloudflare Queues via `/compile/async` and `/compile/batch/async` endpoints
- `processCompileMessage` and `updateQueueStats` handle async job processing
- When adding new long-running operations, prefer the async queue pattern over blocking HTTP responses

### Analytics Instrumentation

- The worker uses `AnalyticsService` to track compilation metrics to Cloudflare Analytics Engine
- Every new API endpoint must instrument relevant events via `AnalyticsService` for consistent observability

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

- **Single source of truth**: `src/version.ts` exports the canonical VERSION constant
- **Automatic bumping**: Version is automatically bumped based on Conventional Commits (feat, fix, perf)
- **Version sync**: Keep version consistent across `src/version.ts`, `deno.json`, `package.json`, and `wrangler.toml`
- **Worker imports**: All worker files import VERSION from `src/version.ts` as fallback for `env.COMPILER_VERSION`
- **Dynamic loading**: HTML files load version from `/api/version` endpoint at runtime
- **Documentation**: See `docs/reference/VERSION_MANAGEMENT.md` for manual update process and `docs/reference/AUTO_VERSION_BUMP.md` for automation details
- **Publishing**: CI/CD automatically publishes to JSR on version changes to master branch
- **Commit format**: Use conventional commits (e.g., `feat:`, `fix:`, `feat!:`) to trigger automatic version bumps
- **Version sync command**: After any manual version bump, run `deno task version:sync` to keep version consistent across `src/version.ts`, `deno.json`, `package.json`, and `wrangler.toml` — do not edit these files independently

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
- **Never commit placeholder binding IDs**: `wrangler.toml` binding IDs that are all-zeros are validated in CI — always use real resource IDs
- **Environment variables**: Always add new variables to `.env.example` with a comment stub. Do NOT add new variables to `wrangler.toml [vars]` — that section is only for Cloudflare-specific runtime bindings (KV/D1/R2 IDs, queue names) and truly static non-secret constants (`COMPILER_VERSION`). All local-dev configuration belongs in `.env.local` via the `.envrc`/direnv system.
- **Prisma / PostgreSQL database**: When modifying the Prisma schema, run `deno task db:migrate` to apply migrations and `deno task db:generate` to regenerate the Prisma client. Production uses Cloudflare Hyperdrive to connect to PostgreSQL (PlanetScale/Neon); CI runs migrations on deploy automatically.

### Docker

- Multi-stage builds using Deno and Node.js
- Configuration via `docker-compose.yml`
- Health checks included

## Database (Prisma / PostgreSQL via Hyperdrive)

The worker uses **Prisma** with a **PostgreSQL** database (PlanetScale or Neon) accessed through **Cloudflare Hyperdrive** in production. Local development uses a local PostgreSQL instance (Docker or native). D1/SQLite is a separate binding used only for legacy admin and migration endpoints — it is not the primary Prisma data source.

### Key Commands

```bash
# Generate Prisma client after schema changes
deno task db:generate

# Push schema changes to the local database
deno task db:push

# Run migrations
deno task db:migrate

# Open Prisma Studio
deno task db:studio
```

### Rules

- Always run `deno task db:generate` after modifying `prisma/schema.prisma`
- Always run `deno task db:migrate` before deploying schema changes — CI runs this automatically on deploy
- The Prisma schema uses the `postgresql` provider; configure `DATABASE_URL` as a Hyperdrive connection string in production (`wrangler secret put DATABASE_URL`) and as a local PostgreSQL URL in development

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

## Agent Routing (MCP / Playwright MCP)

The worker includes an MCP (Model Context Protocol) agent routing layer.

### Key Points

- `worker/worker.ts` imports `PlaywrightMcpAgent` from `worker/mcp-agent.ts` and `routeAgentRequest` from `worker/agent-routing.ts` (local worker modules, not an external library)
- All incoming requests are evaluated by `routeAgentRequest` before falling through to standard HTTP handlers
- When adding new agent-addressable capabilities, register them through the MCP agent routing layer rather than adding raw HTTP endpoints
- Do not remove or short-circuit the `routeAgentRequest` call in the worker fetch handler

## Resources

- **JSR Package**: https://jsr.io/@jk-com/adblock-compiler
- **Live Web UI**: https://adblock-compiler.jayson-knight.workers.dev/
- **AdGuard DNS Syntax**: https://adguard-dns.io/kb/general/dns-filtering-syntax/
- **Deno Manual**: https://deno.land/manual
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **Angular 21 Docs**: https://angular.dev
- **Angular Signals Guide**: https://angular.dev/guide/signals
- **Angular Material 21**: https://material.angular.io
- **Vitest**: https://vitest.dev
- **@analogjs/vitest-angular**: https://analogjs.org/docs/packages/vitest-angular/overview

## Don't Do

### Backend (Deno/TypeScript)

- Don't use Node.js-specific APIs (use Deno standard library instead)
- Don't use `npm:` imports unless absolutely necessary (prefer JSR)
- Don't use `any` types
- Don't create tests in a separate `test/` directory (co-locate with source)
- Don't commit without running formatting and type checking
- Don't introduce breaking changes to the public API without documentation
- Don't use `Function` constructor or `eval()` for security reasons
- Don't leave bare `// TODO:` comments — always tag them (e.g., `// TODO(@jaypatrick): ...`) or CI will fail
- Don't bump versions manually in individual files — run `deno task version:sync` to keep all files in sync
- Don't commit all-zeros placeholder binding IDs in `wrangler.toml`
- Don't skip `deno task schema:generate` after API changes — drift in generated artifacts will fail CI
- Don't add new environment variables to `wrangler.toml [vars]` — add them to `.env.example` and document them for `.env.local` via the direnv system

### Frontend (Angular)

- Don't use `NgModule` — all components, directives, and pipes must be standalone
- Don't use Zone.js or `NgZone` — the app uses `provideZonelessChangeDetection()`
- Don't use `*ngIf`, `*ngFor`, `*ngSwitch` — use `@if`, `@for`, `@switch` control flow
- Don't use `@Input()` / `@Output()` decorators for new components — use `input()` / `output()` signal APIs
- Don't use `@ViewChild` / `@ContentChild` decorators — use `viewChild()` / `contentChild()` signal queries
- Don't use `BehaviorSubject` for component or service state — use `signal()` and `computed()`
- Don't use `UntypedFormControl` or `any` in reactive forms — always use typed forms
- Don't reference `document` or `window` directly — use `inject(DOCUMENT)` and access `inject(DOCUMENT).defaultView` for SSR-safe window access
- Don't use class-based route guards or HTTP interceptors — use functional equivalents
- Don't use `BrowserAnimationsModule` — use `provideAnimationsAsync()` in `app.config.ts`
- Don't use Karma or Jasmine — use Vitest with `@analogjs/vitest-angular` for all frontend tests
- Don't import entire Angular Material modules — import only the specific modules needed per component

## Questions or Clarifications

When uncertain about:

- **Architecture decisions**: Refer to existing patterns in `src/compiler/` and `src/platform/`
- **Transformation logic**: Check existing transformations in `src/transformations/`
- **API design**: Review `src/types/index.ts` for interface definitions
- **Backend testing patterns**: Look at existing `*.test.ts` files in `src/`
- **Angular patterns**: Check `frontend/src/app/app.config.ts` and `frontend/src/app/app.component.ts` for Angular 21 examples
- **Angular testing patterns**: Look at existing `*.spec.ts` files in `frontend/src/app/`
- **Code quality**: Refer to `CODE_REVIEW.md` for best practices
- **Database patterns**: Check `prisma/schema.prisma` and existing D1 migration files in `prisma/migrations/`
- **Agent routing**: Check `worker/worker.ts` for the `routeAgentRequest` and `PlaywrightMcpAgent` usage
- **Tracing patterns**: Look for `createTracingContext()` calls in `worker/worker.ts`
- **Analytics patterns**: Look for `AnalyticsService` usage in `worker/worker.ts`
- **Benchmark baselines**: Check existing `*.bench.ts` files in `src/` for benchmarking patterns

## Summary

This is a mature, production-ready project with two main parts: a **Deno TypeScript compiler backend** and an **Angular 21 frontend**. For the backend, prioritize type safety, clean abstractions, and Deno-native testing. For the frontend, always use Angular 21 modern patterns (standalone, signals, zoneless, `@if`/`@for` control flow) and Vitest for tests. Follow the established patterns in each area and never mix the paradigms.