# Contributing to Adblock Compiler

Thank you for your interest in contributing to the Adblock Compiler project! This guide will help you get started.

## Development Setup

1. **Prerequisites**
   - [Deno](https://deno.land/) 2.x or higher
   - [Node.js](https://nodejs.org/) 22.x or higher (for Angular frontend)
   - Git

2. **Clone and Setup**
   ```bash
   git clone https://github.com/jaypatrick/adblock-compiler.git
   cd adblock-compiler
   deno cache src/index.ts
   pnpm install                    # Install Angular frontend dependencies
   ```

3. **Run Tests**
   ```bash
   deno task test                                       # Backend tests (Deno)
   pnpm --filter adblock-compiler-frontend run test     # Frontend tests (Vitest)
   ```

## Commit Message Guidelines

We use **Conventional Commits** for automatic version bumping and changelog generation.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

### Types

- `feat:` - New feature (triggers **minor** version bump: 0.12.0 → 0.13.0)
- `fix:` - Bug fix (triggers **patch** version bump: 0.12.0 → 0.12.1)
- `perf:` - Performance improvement (triggers **patch** version bump)
- `docs:` - Documentation changes (no version bump)
- `style:` - Code style changes (no version bump)
- `refactor:` - Code refactoring (no version bump)
- `test:` - Adding or updating tests (no version bump)
- `chore:` - Maintenance tasks (no version bump)
- `ci:` - CI/CD changes (no version bump)

### Breaking Changes

For breaking changes, add `!` after type or include `BREAKING CHANGE:` in footer:

```bash
# Option 1: Using !
feat!: change API to async-only

# Option 2: Using footer
feat: migrate to new configuration format

BREAKING CHANGE: Configuration schema has changed.
Old format is no longer supported.
```

This triggers a **major** version bump: 0.12.0 → 1.0.0

### Examples

✅ **Good Examples:**

```bash
feat: add WebSocket support for real-time compilation
feat(worker): implement queue-based processing
fix: resolve memory leak in rule parser
fix(validation): handle edge case for IPv6 addresses
perf: optimize deduplication algorithm by 50%
docs: add API documentation for streaming endpoint
test: add integration tests for batch compilation
chore: update dependencies to latest versions
```

❌ **Bad Examples:**

```bash
added feature              # Missing type prefix
Fix bug                    # Incorrect capitalization
feat add new feature       # Missing colon
update code                # Too vague, missing type
```

## Pull Request Process

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make Your Changes**
   - Write code following the project's style guide
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   # Backend
   deno task test           # Run tests
   deno task fmt            # Format code
   deno task lint           # Lint code
   deno task check          # Type check

   # Frontend (Angular)
   pnpm --filter adblock-compiler-frontend run test     # Vitest unit tests
   pnpm --filter adblock-compiler-frontend run lint     # ESLint
   pnpm --filter adblock-compiler-frontend run build    # Production build
   ```

4. **Commit with Conventional Format**
   ```bash
   git add .
   git commit -m "feat: add new transformation for rule validation"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a Pull Request on GitHub

6. **Automatic Version Bump**
   - When your PR is merged to `main`, the version will be automatically bumped based on your commit message
   - `feat:` commits → minor version bump
   - `fix:` or `perf:` commits → patch version bump
   - Breaking changes → major version bump

## Code Style

- **Indentation**: 4 spaces (not tabs)
- **Line width**: 180 characters maximum
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **TypeScript**: Strict typing, no `any` types

Run `deno task fmt` to automatically format your code.

## Testing

- **Location**: Co-locate tests with source files (`*.test.ts`)
- **Framework**: Use Deno's built-in test framework
- **Coverage**: Aim for comprehensive test coverage
- **Commands**:
  ```bash
  deno task test              # Run all tests
  deno task test:watch        # Watch mode
  deno task test:coverage     # With coverage
  ```

## Documentation

- Update README.md for user-facing changes
- Update relevant docs in `docs/` directory
- Add JSDoc comments to public APIs
- Include examples for complex features

## Project Structure

```
src/
├── cli/              # Command-line interface
├── compiler/         # Core compilation logic
├── configuration/    # Configuration validation
├── downloader/       # Filter list downloading
├── platform/         # Platform abstraction (Worker, Node)
├── transformations/  # Rule transformation implementations
├── types/            # TypeScript type definitions
└── utils/            # Utility functions

worker/               # Cloudflare Worker implementation
frontend/             # Angular 21 frontend (Material Design 3, SSR, Zoneless)
├── src/app/
│   ├── home/         # Dashboard with rxResource-based live stats
│   ├── compiler/     # Compiler form (SSE streaming, linkedSignal presets)
│   ├── performance/  # Metrics & endpoint breakdown
│   ├── validation/   # Filter rule validation
│   ├── api-docs/     # API reference
│   ├── admin/        # Storage admin (auth-gated)
│   ├── services/     # MetricsService, SseService, CompilerService, etc.
│   ├── interceptors/ # HTTP error interceptor (401/429/5xx)
│   └── guards/       # Admin route guard
docs/                 # Documentation (organized by category)
├── api/              # REST API reference, OpenAPI, streaming, validation
├── cloudflare/       # Cloudflare-specific features (Queues, D1, Workflows)
├── database-setup/   # Database architecture and local dev setup
├── deployment/       # Docker and Cloudflare deployment guides
├── development/      # Architecture, extensibility, diagnostics
├── frontend/         # Angular SPA, Vite, Tailwind CSS
├── guides/           # Getting started, migration, troubleshooting
├── postman/          # Postman collection and environment files
├── reference/        # Version management, environment config
├── releases/         # Release notes and announcements
├── testing/          # Testing guides and E2E documentation
└── workflows/        # GitHub Actions CI/CD workflows
examples/             # Example implementations
```

## Angular Frontend Development

The frontend is an Angular 21 app in `frontend/` using:

- **Zoneless change detection** (`provideZonelessChangeDetection()`)
- **Material Design 3** with M3 theme tokens
- **SSR** on Cloudflare Workers via `@angular/ssr`
- **Vitest** for unit testing (not Jest)
- **Signal-first architecture**: `rxResource`, `linkedSignal`, `toSignal`, `viewChild()`

### Running Locally

```bash
pnpm --filter adblock-compiler-frontend run start    # Angular dev server (http://localhost:4200)
deno task wrangler:dev                               # Worker API (http://localhost:8787)
```

The Angular dev server proxies `/api` requests to the Worker.

### SSE Integration Pattern

The compiler supports real-time Server-Sent Events (SSE) streaming. The `SseService` (`frontend/src/app/services/sse.service.ts`) wraps the native `EventSource` API and exposes each connection as a signal-based `SseConnection` object:

```typescript
// SseService.connect() returns an SseConnection with:
//   .events()   — Signal<SseEvent[]> — accumulated events
//   .status()   — Signal<'connecting' | 'open' | 'error' | 'closed'>
//   .isActive() — Signal<boolean>
//   .close()    — Closes the EventSource

const conn = this.sseService.connect('/compile/stream', request);
this.sseConnection.set(conn);

// In the template, consume signals directly:
// conn.events(), conn.status(), conn.isActive()
```

This pattern avoids manual Observable subscriptions—the component template reads signals reactively, and the connection auto-cleans via `DestroyRef.onDestroy()`.

## Questions or Help?

- Create an issue on GitHub
- Check existing documentation in `docs/`
- Review the [README.md](README.md)

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## Additional Resources

- [VERSION_MANAGEMENT.md](docs/reference/VERSION_MANAGEMENT.md) - Version synchronization details
- [docs/reference/AUTO_VERSION_BUMP.md](docs/reference/AUTO_VERSION_BUMP.md) - Automatic version bumping
- [Conventional Commits](https://www.conventionalcommits.org/) - Official specification
- [Semantic Versioning](https://semver.org/) - SemVer specification
