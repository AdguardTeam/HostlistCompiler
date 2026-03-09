# Adblock Compiler

<!-- CI/CD & Build Status -->

[![CI/CD Pipeline](https://github.com/jaypatrick/adblock-compiler/actions/workflows/ci.yml/badge.svg)](https://github.com/jaypatrick/adblock-compiler/actions/workflows/ci.yml)
[![Docker](https://github.com/jaypatrick/adblock-compiler/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/jaypatrick/adblock-compiler/actions/workflows/docker-publish.yml)
[![Build & Deploy mdBook](https://github.com/jaypatrick/adblock-compiler/actions/workflows/mdbook.yml/badge.svg)](https://github.com/jaypatrick/adblock-compiler/actions/workflows/mdbook.yml)
[![codecov](https://codecov.io/gh/jaypatrick/adblock-compiler/branch/main/graph/badge.svg?token=LC5EYHK71O)](https://codecov.io/gh/jaypatrick/adblock-compiler)

<!-- Package & Release -->

[![JSR](https://jsr.io/badges/@jk-com/adblock-compiler)](https://jsr.io/@jk-com/adblock-compiler)
[![JSR Score](https://jsr.io/badges/@jk-com/adblock-compiler/score)](https://jsr.io/@jk-com/adblock-compiler)
[![GitHub Release](https://img.shields.io/github/v/release/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/releases)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

<!-- Live Services & Deployment -->

[![Web UI](https://img.shields.io/badge/Web%20UI-Live-brightgreen?logo=cloudflare)](https://adblock-compiler.jayson-knight.workers.dev/)
[![API](https://img.shields.io/badge/API-Live-blue?logo=cloudflare)](https://adblock-compiler.jayson-knight.workers.dev/api)
[![Deployed on Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://adblock-compiler.jayson-knight.workers.dev/)
[![Docker Image](https://img.shields.io/badge/ghcr.io-adblock--compiler-2496ED?logo=docker&logoColor=white)](https://github.com/jaypatrick/adblock-compiler/pkgs/container/adblock-compiler)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0.3-6BA539?logo=openapiinitiative&logoColor=white)](docs/api/openapi.yaml)
[![mdBook Docs](https://img.shields.io/badge/docs-mdBook-blue?logo=mdBook)](https://adblock-compiler.jayson-knight.workers.dev/docs)

<!-- Technology -->

[![Deno](https://img.shields.io/badge/Deno-2.6.7+-black?logo=deno)](https://deno.land)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?logo=docker&logoColor=white)](#docker-deployment)

<!-- Security & Code Quality -->

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/jaypatrick/adblock-compiler/badge)](https://scorecard.dev/viewer/?uri=github.com/jaypatrick/adblock-compiler)
[![Last Commit](https://img.shields.io/github/last-commit/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/commits/main)
[![Repo Size](https://img.shields.io/github/repo-size/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler)
[![Top Language](https://img.shields.io/github/languages/top/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler)

<!-- Community -->

[![GitHub Stars](https://img.shields.io/github/stars/jaypatrick/adblock-compiler?style=social)](https://github.com/jaypatrick/adblock-compiler/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/jaypatrick/adblock-compiler?style=social)](https://github.com/jaypatrick/adblock-compiler/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/issues)
[![Discussions](https://img.shields.io/github/discussions/jaypatrick/adblock-compiler)](https://github.com/jaypatrick/adblock-compiler/discussions)
[![Changelog](https://img.shields.io/badge/Changelog-CHANGELOG.md-blue)](CHANGELOG.md)

**Compiler-as-a-Service** for adblock filter lists. Transform, optimize, and combine filter lists from multiple sources with real-time progress tracking.

🌐 **[Try the Admin Dashboard](https://adblock-compiler.jayson-knight.workers.dev/)** | 🔧 **[Compiler UI](https://adblock-compiler.jayson-knight.workers.dev/compiler.html)** | 🚀 **[API Endpoint](https://adblock-compiler.jayson-knight.workers.dev/api)** | 📚 **[Documentation](docs/api/README.md)**

> **Note:** This is a Deno-native rewrite of the original [@adguard/hostlist-compiler](https://www.npmjs.com/package/@adguard/hostlist-compiler). The package provides more functionality with improved performance and no Node.js dependencies.

## 🎉 New in v0.30.x

- **🎯 Angular 21 SPA** — Production Angular frontend with zoneless change detection, Angular Material 3, SSR, and Cloudflare Workers deployment ([docs](frontend/README.md))
- **🎨 Tailwind CSS v4** — Migrated from Tailwind v3 to v4 across all legacy UI pages ([docs](docs/frontend/TAILWIND_CSS.md))
- **📱 Mobile Responsive** — Comprehensive responsive layout improvements across all UI pages
- **📖 Styled API Docs** — HTML documentation page served at the `/api` endpoint
- **🔧 IBasicLogger Injection** — Structured error logging injected into `CompilerEventEmitter`, `AnalyticsService`, and `CloudflareQueueProvider`

## ✨ Features

- **🎯 Multi-Source Compilation** - Combine filter lists from URLs, files, or inline rules
- **⚡ Performance** - Gzip compression (70-80% cache reduction), request deduplication, smart caching
- **🔄 Circuit Breaker** - Automatic retry with exponential backoff for unreliable sources
- **📊 Visual Diff** - See what changed between compilations
- **🎪 Batch Processing** - Compile up to 10 lists in parallel
- **📡 Real-time Updates** - Server-Sent Events (SSE) and WebSocket support
- **🔔 Async Notifications** - Get notified when background jobs complete
- **🌐 Admin Dashboard** - Monitor metrics, queue depth, and system health
- **📖 OpenAPI 3.0 Specification** - Full API documentation with contract tests
- **🌍 Universal** - Works in Deno, Node.js, Cloudflare Workers, browsers
- **🖥️ Angular 21 SPA** - Production frontend with zoneless change detection, Material Design 3, and SSR
- **🎨 11 Transformations** - Deduplicate, compress, validate, and more
- **📝 Structured Logging** - Production-ready JSON logs for observability (CloudWatch, Datadog, Splunk)
- **🚨 Error Reporting** - Centralized error tracking with Sentry and Cloudflare Analytics Engine
- **✅ Zod Validation** - Runtime schema validation for all configurations and API inputs
- **🧩 AST Rule Parsing** - Full abstract syntax tree parsing via @adguard/agtree
- **⚙️ Cloudflare Workflows** - Durable execution for long-running and background compilations

## 📚 Documentation

Full documentation is available at **[adblock-compiler.jayson-knight.workers.dev/docs](https://adblock-compiler.jayson-knight.workers.dev/docs)** and in the [`/docs`](docs/README.md) directory.

## 🚀 Quick Start

### Installation

Run directly without installation:

```bash
deno run --allow-read --allow-write --allow-net jsr:@jk-com/adblock-compiler -c config.json -o output.txt
```

Or install globally:

```bash
deno install --allow-read --allow-write --allow-net -n adblock-compiler jsr:@jk-com/adblock-compiler/cli
```

Or run with Docker:

```bash
docker compose up -d
```

Access the web UI at http://localhost:8787

📚 **[Quick Start Guide](docs/guides/quick-start.md)** | 📚 **[Docker Deployment Guide](docs/deployment/docker.md)**

### Basic Usage

**Quick hosts conversion**

```bash
adblock-compiler -i hosts.txt -i hosts2.txt -o output.txt
```

**Build a configurable blocklist from multiple sources**

```bash
adblock-compiler -c configuration.json -o output.txt
```

### CLI Options

```
Usage: adblock-compiler [options]

General:
  -c, --config <file>          Path to the compiler configuration file
  -i, --input <source>         URL or file path to convert (repeatable)
  -t, --input-type <type>      Input format: hosts|adblock [default: hosts]
  -v, --verbose                Enable verbose logging
  -b, --benchmark              Show performance benchmark report
  -q, --use-queue              Use asynchronous queue-based compilation
      --priority <level>       Queue priority: standard|high [default: standard]
      --version                Show version number
  -h, --help                   Show help

Output:
  -o, --output <file>          Path to the output file [required unless --stdout]
      --stdout                 Write output to stdout instead of a file
      --append                 Append to output file instead of overwriting
      --format <format>        Output format
      --name <file>            Compare output against existing file and print diff
      --max-rules <n>          Truncate output to at most <n> rules

Transformations:
      --no-deduplicate         Skip the Deduplicate transformation
      --no-validate            Skip the Validate transformation
      --no-compress            Skip the Compress transformation
      --no-comments            Skip the RemoveComments transformation
      --invert-allow           Apply the InvertAllow transformation
      --remove-modifiers       Apply the RemoveModifiers transformation
      --allow-ip               Use ValidateAllowIp instead of Validate
      --convert-to-ascii       Apply the ConvertToAscii transformation
      --transformation <name>  Explicit transformation pipeline (repeatable,
                               overrides all other transformation flags)

Filtering:
      --exclude <pattern>      Exclude rules matching pattern (repeatable)
      --exclude-from <file>    Load exclusions from file (repeatable)
      --include <file>         Load inclusions from file (repeatable)

Networking:
      --timeout <ms>           HTTP request timeout in milliseconds
      --retries <n>            Number of HTTP retry attempts
      --user-agent <string>    Custom HTTP User-Agent header

Examples:
  adblock-compiler -c config.json -o output.txt
      compile a blocklist and write the output to output.txt

  adblock-compiler -i hosts.txt -i hosts2.txt --stdout
      compile from multiple inputs and stream to stdout

  adblock-compiler -c config.json -o output.txt --no-compress --allow-ip
      compile without compression, keeping IP-address rules

  adblock-compiler -i https://example.org/hosts.txt -o output.txt \
      --transformation RemoveComments --transformation Deduplicate
      compile with an explicit transformation pipeline
```

> 📚 See the [CLI Reference](docs/usage/CLI.md) for the full flag reference and advanced examples.

## 📖 Further Reading

| Topic | Doc |
|---|---|
| CLI reference | [docs/usage/CLI.md](docs/usage/CLI.md) |
| Configuration reference | [docs/usage/CONFIGURATION.md](docs/usage/CONFIGURATION.md) |
| Transformations reference | [docs/usage/TRANSFORMATIONS.md](docs/usage/TRANSFORMATIONS.md) |
| TypeScript API & Zod validation | [docs/api/README.md](docs/api/README.md) |
| OpenAPI specification | [docs/api/OPENAPI_TOOLING.md](docs/api/OPENAPI_TOOLING.md) |
| Platform support & custom fetchers | [docs/api/PLATFORM_SUPPORT.md](docs/api/PLATFORM_SUPPORT.md) |
| Extensibility | [docs/development/EXTENSIBILITY.md](docs/development/EXTENSIBILITY.md) |
| Structured logging & OpenTelemetry | [docs/development/LOGGING.md](docs/development/LOGGING.md) |
| Error reporting | [docs/development/ERROR_REPORTING.md](docs/development/ERROR_REPORTING.md) |
| Docker deployment | [docs/deployment/docker.md](docs/deployment/docker.md) |
| Cloudflare Workers deployment | [docs/deployment/cloudflare-pages.md](docs/deployment/cloudflare-pages.md) |
| Angular frontend | [frontend/README.md](frontend/README.md) |

## 🔧 Development

### Prerequisites

- [Deno](https://deno.land/) 2.0 or later

### Available tasks

> **Note:** Always use `deno task test` instead of `deno test` directly. The tests require specific permissions (`--allow-read`, `--allow-write`, `--allow-net`, `--allow-env`) that are configured in the task.

```bash
# Run in development mode with watch
deno task dev

# Run the compiler
deno task compile

# Build standalone executable
deno task build

# Run tests (all tests co-located with source files in src/)
deno task test

# Run tests in watch mode
deno task test:watch

# Run tests with coverage
deno task test:coverage

# Run specific test file (with required permissions)
deno test --allow-read --allow-write --allow-net --allow-env src/cli/ArgumentParser.test.ts

# Lint code
deno task lint

# Format code
deno task fmt

# Check formatting
deno task fmt:check

# Type check
deno task check

# Cache dependencies
deno task cache

# Generate the TypeScript API reference (into book/api-reference/)
deno task docs:api

# Build the full mdBook site + API reference (requires mdBook CLI installed)
deno task docs:build

# Live-preview the mdBook (does not include API reference; requires mdBook CLI installed)
deno task docs:serve
```

### Angular Frontend Development

The primary frontend is an Angular 21 SPA in `frontend/`. It uses:

- **Angular 21** with zoneless change detection, signals, `rxResource`, `linkedSignal`
- **Angular Material 3** for UI components and theming
- **SSR** via `@angular/ssr` on Cloudflare Workers
- **Vitest** for unit testing

```bash
# Development server (http://localhost:4200)
pnpm --filter adblock-compiler-frontend run start

# Production build
pnpm --filter adblock-compiler-frontend run build

# Run tests
pnpm --filter adblock-compiler-frontend run test
```

For full-stack local development:

```bash
deno task wrangler:dev        # Worker on :8787
pnpm --filter adblock-compiler-frontend run start  # Angular on :4200 → proxies /api to :8787
```

**Pages:**

- Dashboard — live metrics from `/api/metrics` and `/api/health`
- Compiler — filter list compilation with JSON and SSE streaming modes, drag-and-drop
- Performance — real-time compilation latency and throughput
- Validation — AGTree-powered filter rule validation
- API Docs — HTTP endpoint reference
- Admin — KV/R2/D1 storage management (requires admin key)

The `public/` directory contains the original vanilla HTML frontend. It will be removed once the Angular migration is complete.

📄 **[SPA Benefits Analysis](docs/frontend/SPA_BENEFITS.md)** - Analysis of SPA benefits for this application

### Project structure

```
src/
├── cli/           # Command-line interface (with *.test.ts files)
├── compiler/      # Core compilation logic (with *.test.ts files)
├── configuration/ # Configuration validation (with *.test.ts files)
├── downloader/    # Filter list downloading (with *.test.ts files)
├── platform/      # Platform abstraction layer (with *.test.ts files)
├── transformations/ # Rule transformations (with *.test.ts files)
├── types/         # TypeScript type definitions
├── utils/         # Utility functions (with *.test.ts files)
├── index.ts       # Main library exports
└── mod.ts         # Deno module exports

Note: All tests are co-located with source files (*.test.ts next to *.ts)

worker/            # Cloudflare Worker implementation (production-ready)
├── worker.ts      # Main worker with API endpoints
└── html.ts        # Fallback HTML templates

frontend/          # Angular 21 SPA (replaces public/)
├── src/app/       # Components, services, guards, interceptors
├── src/index.html # Root HTML with Cloudflare analytics
└── angular.json   # Build configuration (SSR + browser)

public/            # Legacy static web UI (to be removed)

examples/
└── cloudflare-worker/  # Legacy deployment reference
```

### Publishing to JSR

```bash
# Dry run to verify everything is correct
deno publish --dry-run

# Publish to JSR
deno publish
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

1. Fork and clone the repository
2. Make your changes following our [commit message guidelines](CONTRIBUTING.md#commit-message-guidelines)
3. Use conventional commits: `feat:`, `fix:`, `docs:`, etc.
4. Submit a pull request

**Automatic Version Bumping**: When your PR is merged, the version will be automatically bumped based on your commit messages. See [docs/reference/AUTO_VERSION_BUMP.md](docs/reference/AUTO_VERSION_BUMP.md) for details.

## 📄 License

GPL-3.0 - See [LICENSE](LICENSE) for details.
