# AdBlock Compiler Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **frontend**: Integrate TailwindCSS v4 with Angular Material Design 3 via `@theme inline` bridge — maps key `--mat-sys-*` role tokens to semantic Tailwind utilities (`bg-surface-variant`, `text-primary`, etc.); dark mode handled automatically through CSS variable swapping; see `docs/frontend/TAILWIND_CSS.md`
- **frontend**: Add `scripts/postbuild.js` and `npm postbuild` lifecycle hook — copies `index.csr.html` → `index.html` after `ng build` so the Cloudflare Worker `ASSETS` binding and Cloudflare Pages serve the Angular SPA shell correctly when `RenderMode.Client` routes are used
- **frontend**: Add `src/_redirects` with `/* /index.html 200` for Cloudflare Pages SPA routing fallback; include in Angular build via `assets` array in `angular.json`
- **config**: Expand Zod validation coverage — add `SourceSchema`, `ConfigurationSchema`, `BenchmarkMetricsSchema`, `CompileRequestSchema`, and related schemas to `src/configuration/schemas.ts`; integrate schema validation into `ArgumentParser` and `CliApp`; export all schemas from `src/index.ts`; see `docs/api/ZOD_VALIDATION.md`
- Integrate framework PoCs (React, Vue 3, Angular, Svelte) into the main project as alpha/experimental code: served under `/poc/` in the production build, linked from the admin dashboard with an ⚗️ Alpha label, and documented in `docs/FRAMEWORK_POCS.md`
- Documentation: Add missing v0.16.0 release notes for centralized error reporting (Sentry, Cloudflare Analytics Engine, and console backends)
- Documentation: Add missing v0.16.0 release notes for Zod schema validation for configuration objects and API request bodies
- Documentation: Add missing v0.16.0 release notes for ConfigurationValidator refactor to use Zod
- Inject optional `IBasicLogger` into `CompilerEventEmitter` / `createEventEmitter` for structured error logging when event handlers throw
- Inject optional `IBasicLogger` into `AnalyticsService` to route Analytics Engine write failures through the logger instead of `console.warn`
- Inject optional `IBasicLogger` into `CloudflareQueueProvider` / `createCloudflareQueueProvider` to route queue processing errors through the logger instead of `console.error`
- Add `CloudflareQueueProvider.test.ts` with full test coverage including logger injection tests
- **frontend**: Add `AppTitleStrategy` — custom Angular `TitleStrategy` that formats every page title as `"<Route> | Adblock Compiler"` (WCAG 2.4.2 Page Titled, Level A)
- **frontend**: WCAG 2.1 accessibility improvements — skip navigation link, single `<h1>` per page, `aria-live` toast container, `aria-hidden` on decorative icons, `.visually-hidden` utility class, `prefers-reduced-motion` support
- **frontend**: Angular SPA routing fallback in Cloudflare Worker — extensionless paths not handled by the API are served the Angular shell (`index.html`) for client-side navigation
- **worker**: Add `SPA_SERVER_PREFIXES` constant to prevent API routes from being masked by the Angular SPA fallback

### Changed

- **frontend**: Migrate all Cloudflare Workers API/asset URLs from `*.workers.dev` development domains to the production domain `adblock.jaysonknight.com` across all documentation, examples, Postman collections, and OpenAPI specs
- **worker**: Update `serveStaticAsset()` to try `index.html` first (served by postbuild), falling back to `index.csr.html` defensively if the postbuild step was skipped
- Migrate `zod` from npm to JSR (`jsr:@zod/zod@^4.3.6`)
- Migrate `@opentelemetry/api` from npm to JSR (`jsr:@opentelemetry/api@^1.9.0`)
- Improve Deno-native architecture by reducing npm dependencies where JSR alternatives are available
- Replace `console.*` calls in `EventEmitter`, `AnalyticsService`, and `CloudflareQueueProvider` with `IBasicLogger` dependency injection, defaulting to `silentLogger` for backward compatibility
- **frontend**: Add async/batch compilation modes, queue stats panel, and supporting services (QueueService, NotificationService, CompilerService extensions, CompilerComponent updates)
- **frontend**: Add structured logging (LogService) to QueueService, NotificationService, and CompilerService
- **frontend**: Expand API Docs with missing endpoints (batch, AST parse, queue management, workflow) and embedded API tester
- **frontend**: Switch `home` and `compiler` routes to `RenderMode.Client` to prevent SSR crash caused by `MatSlideToggle.writeValue()` accessing the DOM during server rendering
- **frontend**: Use `inject()` function throughout Angular services and components in place of constructor parameter injection (`@angular-eslint/prefer-inject`)
- **docs**: Update `ANGULAR_FRONTEND.md` — Routing section (short route titles + `TitleStrategy` docs), SSR render mode table and code example, new Accessibility section

### Fixed

- **frontend**: `REQUEST` injection token imported from `@angular/core` (not `@angular/ssr`) — fixes `TS2305` build error that broke the Docker CI pipeline
- **worker**: Remove dead `hasFileExtension` function and stale `async serveWebUI(env)` overload that referenced a non-existent `serveStaticFile` helper — fixes `TS2393`/`TS6133` type-check failures in CI






























## [0.40.0] - 2026-03-07

### Added- add Cloudflare Pipelines and log sink integrations (#710) (#749)


## [0.39.0] - 2026-03-07

### Added- add Angular frontend CI gate, artifact reuse, and change detection (#615)

### Fixed

- **ci**: pass needs JSON via env var to fix ci-gate Python heredoc stdin conflict
- address review comments on CI workflow - Python heredoc, detect-changes simplification


## [0.38.0] - 2026-03-07

### Added- integrate Codecov for frontend vitest coverage
- integrate mdBook for project documentation site (#728)

### Fixed

- exclude mdBook content from deno fmt check (#734)
- gate frontend Codecov upload to main pushes only
- exclude README.md from deno fmt check (#732)
- apply PR review feedback for mdBook integration


## [0.37.6] - 2026-03-07

### Added### Fixed

- add trailing newline to DESCRIPTION.md to pass deno fmt check (#726)


## [0.37.5] - 2026-03-07

### Added### Fixed

- address PR review comments — validate endpoint fixes and queue service URL corrections
- update queue.service.spec.ts to use correct URL paths after queue service refactor
- normalize /api prefix in worker to resolve frontend API 404s (#721)


## [0.37.4] - 2026-03-06

### Fixed

- use deno task wrangler:deploy to resolve missing esbuild module


## [0.37.3] - 2026-03-06

### Fixed

- resolve CI #1526 stuck deployment — remove invalid --env=\"\" from wrangler deploy and add timeout


## [0.37.2] - 2026-03-06

### Fixed

- update deno.lock for wrangler 4.71.0, add workerd@1.20260305.0 to allowScripts, pin npx wrangler@4.71.0 in CI
- update wrangler to 4.71.0, fix esbuild allowScripts, fix wrangler.toml environments and CI deploy command


## [0.37.1] - 2026-03-06

### Fixed

- **fmt**: exclude issues/ directory from deno fmt check
- add missing npm deps (zod, @opentelemetry/api, @adguard/agtree) so wrangler can bundle the worker
- use regex to parse HTTP status code from D1 error message for precise permission error detection
- remove dangling git submodule, improve deployment error handling, suppress wrangler Pages warning
- address code review feedback and prevent recurring Cloudflare deploy failure
- add explicit JSR type annotations to schemas to resolve slow types errors


## [0.37.0] - 2026-03-06

### Added

- integrate TailwindCSS v4 with Angular Material Design via `@theme inline` bridge
- expand Zod validation coverage with new schemas and integrations

### Fixed

- resolve CI failures — fmt GRAPHQL_INTEGRATION.md and regen cloudflare schema
- address review feedback on postbuild script and worker asset fetching
- apply PR review suggestions from review thread #3900928199
- resolve dashboard not displaying by generating index.html from index.csr.html
- remove duplicate dev server entry in openapi.yaml and fix README badge link path
- move Deduplicate before Compress in ConfigurationValidator test to satisfy ordering validation
- align markdown table columns in src/storage/README.md for deno fmt
- resolve CI failures - type error in refine path and deno fmt violations


## [0.36.0] - 2026-03-05

### Added

- add automated branch cleanup GitHub Actions workflow


## [0.35.0] - 2026-03-05

### Added

- add PostgreSQL admin endpoints and backend health check (#587)
- add D1 to PostgreSQL migration handler (#587)
- add API key authentication via Hyperdrive (#587)
- add HyperdriveStorageAdapter for PlanetScale PostgreSQL (#587)
- add Zod validation schemas for database models (#587)
- Phase 1 PlanetScale PostgreSQL setup (#587)

### Fixed

- resolve CI failures - format 7 files and fix RFC 4122 UUID in schema tests
- resolve CI format check and test failures
- address PR review comments for Phase 1 PostgreSQL + Hyperdrive setup
- **frontend**: resolve all Angular ESLint warnings for architecture modernization


## [0.34.0] - 2026-03-05

### Added

- **frontend**: Redesign with Deep Ink + Electric Amber design system
- Add SEO and AEO optimizations for frontend

### Fixed

- **tests**: align SSE spec API_BASE_URL with production browser config ('/api')
- **frontend**: tighten dark-theme selectors, fix shadow token, improve SSE test cleanup
- align index.html meta description with home route metaDescription
- **tests**: clear fake timers before restoring real timers in sse.service.spec afterEach
- **frontend**: apply PR review feedback - favicon, CSS tokens, fonts, theme, spinner
- address PR review feedback on SEO/AEO optimizations
- address test mock/timer leaks and SSE URL contract issues
- use RenderMode.Client for home and compiler routes to prevent SSR crash


## [0.33.2] - 2026-03-05

### Added### Fixed

- use inject() function in AppTitleStrategy to satisfy prefer-inject lint rule
- remove dead hasFileExtension and duplicate serveWebUI overload in worker
- import REQUEST from @angular/core not @angular/ssr
- merge main into branch to resolve conflicts
- remove unused _env param from serveWebUI
- merge main, resolve conflicts, consolidate env.ASSETS into serveStaticAsset()
- WCAG accessibility improvements across Angular SSR frontend
- remove unused hasFileExtension function and fix spelling
- resolve merge conflicts between fix/api-html-404 and main
- remove unused API_DOCS_REDIRECT import from worker/router.ts
- remove unused API_DOCS_REDIRECT import from router.ts
- hoist SPA_SERVER_PREFIXES to module constant, use Boolean(env.ASSETS) for explicit boolean
- narrow /admin SPA exclusion, clean router.ts redirect, update JSDoc, add routing E2E tests
- apply review feedback for /api redirect, SPA fallback, and router.ts sync
- scope SPA fallback, gate handleInfo redirect on ASSETS, sync router.ts
- resolve landing page issues #622 #623 #624
- redirect /api to Angular /api-docs route and add SPA fallback
- add tests for API_BASE_URL factory and extract hasFileExtension helper
- address review comments on SPA fallback and SSR API base URL
- restore Angular routing on Cloudflare Workers deployment


## [0.33.1] - 2026-03-04

### Fixed

- apply deno fmt to failing markdown files


## [0.33.0] - 2026-03-04

### Added

- Incorporate Angular Material Design into 4 Angular frontend components (`SkeletonCardComponent`, `SkeletonTableComponent`, `SparklineComponent`, `TurnstileComponent`) — all now use `mat-card appearance="outlined"` wrappers; skeleton components add a `mat-progress-bar` in buffer mode as a loading indicator

### Fixed

- add standalone: true to SparklineComponent, SkeletonTableComponent, TurnstileComponent


## [0.32.2] - 2026-03-04

### Fixed

- apply PR review suggestions — required BootstrapContext, remove MatToolbarModule, add aria attrs
- configure MatIconRegistry to use material-symbols-outlined font set
- change Docker cache mode from max to min to fix 502 on layer blob write
- restore original design — gradient theme, horizontal nav, white card layout
- pass BootstrapContext to bootstrapApplication in main.server.ts


## [0.32.1] - 2026-03-04

### Fixed

- exclude skills/ and .claude/ from deno fmt and deno lint


## [0.32.0] - 2026-03-04

### Added

- **compiler**: Complete phases 6-8 — API docs, logging wiring, and changelog
- **compiler**: Add async/batch compilation modes, queue stats panel, and supporting services

### Fixed

- **review**: apply 7 PR review comments — QueueJobStatus, TERMINAL_JOB_STATUSES, not_found grace, cancelled handling, API path alignment
- **specs**: update service specs to match main's refactored service APIs
- **api-docs**: add MatFormFieldModule and MatInputModule to fix mat-form-field control error in tests
- **api-docs**: fix FormsModule wrong import and update spec assertions for Phase 6 endpoint groups
- **compiler**: address PR review comments — lint error, mat-card structure, chip color, test assertions, and not_found grace period


## [0.31.0] - 2026-03-03

### Added

- Add exception handling, validation, logging & diagnostics

### Fixed

- apply review feedback - logging, SSE, tsconfig, standalone, SQL guard
- align rxResource API, TypeScript types, and siteKey input with main
- rename rxResource loader to stream for Angular 21 compatibility


## [0.30.0] - 2026-03-03

### Added

- **frontend**: Implement 14 enhancement items with CI/Docker updates
- complete Angular migration gaps - MetricsService, a11y, animations, cleanup
- **frontend**: Phases 3-7 — additional pages, services, responsive sidenav, CI, docs
- **frontend**: Phase 2 — core pages with live data, SSE streaming, drag-and-drop
- Phase 1 - scaffold Angular frontend migration (#559)

### Fixed

- remove step-level secrets check from Claude workflows, fix version-bump branch conflict
- add push trigger to Claude workflows to prevent validation errors
- resolve CI workflow failures for Cloudflare deploy
- exclude frontend/ from deno lint/fmt, remove missing public/ from Dockerfile
- resolve all CI failures — exclude frontend from deno lint/fmt, fix Dockerfile, sync package-lock, add cov_profile to gitignore
- remove cov_profile artifacts and fix Dockerfile .npmrc baking


## [0.29.2] - 2026-03-03

### Fixed

- correct deno fmt indentation in src/plugins/index.ts
- address PR review feedback on PluginLoader and loadPlugin stubs
- move loadPlugin to PluginLoader.deno.ts to fix JSR deployment error


## [0.29.1] - 2026-03-03

### Fixed

- correct CHANGELOG.md formatting for 0.29.0 and 0.28.0 entries


## [0.29.0] - 2026-03-03

### Added

- **angular-poc**: Replace Express with Cloudflare Workers + Vitest
- **angular-poc**: Implement all Angular 21 modernizations

### Fixed

- **angular-poc**: Address all automated PR review comments


## [0.28.0] - 2026-03-02

### Added

- Apply styling to /api endpoint with HTML documentation page


## [0.27.0] - 2026-03-02

### Added

- Add comprehensive mobile responsive improvements across all UI pages

### Fixed

- Add missing closing style tags in test.html and e2e-tests.html
- Add retry logic to deno install steps to prevent transient worker build failures


## [0.26.0] - 2026-03-02

### Added

- Migrate Tailwind CSS v3 to v4


## [0.25.3] - 2026-02-27

### Performance

- web performance audit improvements


## [0.25.2] - 2026-02-24

### Fixed

- address CHANGELOG formatting and sync version to HTML/package-lock


## [0.25.1] - 2026-02-24

### Added

### Fixed

- **angular-poc**: readonly availableTransformations and @if-as alias for error signal
- **angular-poc**: safe error message extraction and @if-as alias for results signal

## [0.24.1] - 2026-02-23

### Fixed

- add --allow-write flag to generate-deployment-version.ts deno run commands


## [0.24.0] - 2026-02-22

### Added

- Generate Cloudflare Web Assets schema from OpenAPI spec


## [0.23.2] - 2026-02-22

### Fixed

- sync HTML version fallbacks to 0.23.1 and extend version:sync script


## [0.23.1] - 2026-02-22

### Added

### Fixed

- correct malformed ### Added section header in CHANGELOG.md [0.23.0]
- remove double blank lines in CHANGELOG.md to pass deno fmt check

## [0.23.0] - 2026-02-22

### Added

- add PoC Overview back-navigation links to React and Vue PoC pages

### Fixed

- remove double blank lines in CHANGELOG.md to pass deno fmt check

## [0.22.1] - 2026-02-22

### Added

### Fixed

- correct Zod v4 type annotations in schemas.ts to fix CI type check failures
- add explicit type annotations to all Zod schemas to fix JSR slow types error
- add --allow-slow-types to deno publish to fix JSR deployment error

## [0.22.0] - 2026-02-21

### Added

- Improve openapi.yaml for Cloudflare Web Assets Schema Validation
- Update openapi.yaml - add all missing endpoints and custom domain server

## [0.21.2] - 2026-02-21

### Added

### Fixed

- split malformed markdown headers in CHANGELOG.md 0.21.1 and 0.21.0 sections
- remove double blank lines in CHANGELOG.md to pass deno fmt check

## [0.21.1] - 2026-02-21

### Added

### Fixed

- remove double blank lines in CHANGELOG.md and trailing spaces in README.md to pass deno fmt check

## [0.21.0] - 2026-02-21

### Added

- integrate framework PoCs as experimental/alpha-level code

### Fixed

- remove double blank lines in CHANGELOG.md to pass deno fmt check

## [0.20.0] - 2026-02-21

### Added

- Add PoC project links and Svelte 5 demo client

### Fixed

- remove extra blank lines in CHANGELOG.md to pass deno fmt check

## [0.19.1] - 2026-02-21

### Fixed

- include poc/ directory in dist build and fix redirect handling for /poc route

## [0.19.0] - 2026-02-21

### Added

- inject IBasicLogger into EventEmitter, AnalyticsService, and CloudflareQueueProvider

## [0.18.0] - 2026-02-21

### Added

- centralize version management with scripts/sync-version.ts

### Fixed

- use single quotes in sync-version.ts to pass deno fmt check

## [0.17.0] - 2026-02-20

### Added

- create proof of concept for React, Vue, and Angular framework evaluation

### Fixed

- address PR review comments - Angular 19 naming, RxJS leak, missing files, React CDN warning
- apply deno fmt to fix CI format check failure (18 files)
- upgrade Angular PoC deps from 17.1.0 to 19.2.18 to fix security vulnerabilities
- add validation for changelog line number in version-bump workflow
- make changelog insertion more robust in version-bump workflow

## [0.16.2] - 2026-02-18

### Notes

- No user-facing changes. Internal release and tooling updates only.

## [0.16.1] - 2026-02-16

### Fixed

- update OpenAPI path references after root directory reorganization

## [0.16.0] - 2026-02-15

### Added

- Add circuit breaker pattern for unreliable source downloads

## [0.15.0] - 2026-02-13

### Added

- Add OpenTelemetry integration for distributed tracing

### Fixed

- Correct context usage in OpenTelemetry example
- Fix TypeScript errors in OpenTelemetry implementation

## [0.14.0] - 2026-02-13

### Added

- Add per-module log level configuration

### Fixed

- Address code review feedback

## [0.13.0] - 2026-02-13

### Added

- Implement StructuredLogger for production observability

## [0.12.1] - 2026-02-12

### Fixed

- add pull-requests permission and null check to auto-version-bump workflow
- modify auto-version-bump to create PR instead of direct push
- correct markdown formatting in VERSION_MANAGEMENT.md

### BREAKING CHANGES

- feat!/fix!/BREAKING CHANGE: → major bump (0.12.0 → 1.0.0)

Co-authored-by: jaypatrick <1800595+jaypatrick@users.noreply.github.com>

Add comprehensive version management documentation

- Create VERSION_MANAGEMENT.md with detailed sync process
- Document single source of truth pattern (src/version.ts)
- Add version update checklist
- Include troubleshooting guide
- Update copilot instructions with version management reference

## [0.9.1] - 2026-01-31

### Added

- **@adguard/agtree Integration** - Robust AST-based rule parsing
  - New `AGTreeParser` wrapper module for type-safe rule parsing
  - Type guards for all rule types (network, host, cosmetic, comments)
  - Property extraction methods for structured rule data
  - Modifier utilities (find, check, get value)
  - Validation helpers
  - Syntax detection (AdGuard, uBlock Origin, ABP)

### Changed

- **Refactored `RuleUtils`** to use AGTree internally
  - `isComment()`, `isAllowRule()`, `isEtcHostsRule()` now use AST parsing
  - `loadAdblockRuleProperties()`, `loadEtcHostsRuleProperties()` use AGTree parsing
  - New methods: `parseToAST()`, `isValidRule()`, `isNetworkRule()`, `isCosmeticRule()`, `detectSyntax()`
- **Updated `ValidateTransformation`** for AST-based validation
  - Parse-once, validate-many pattern for better performance
  - Proper handling of all rule categories
  - Better error context with structured errors

### Improved

- Rule parsing moved from regex-based to full AST with location info
- Extended syntax support from basic adblock to AdGuard, uBlock Origin, and Adblock Plus
- Modifier validation now uses compatibility tables instead of hardcoded lists
- Error handling upgraded from string matching to structured errors with positions
- Rule type support expanded to include all cosmetic rules, network rules, and comments
- Maintainability improved through upstream library updates instead of manual regex maintenance

## [0.8.8] - 2026-01-27

### Fixed

- Workflow and build issues
  - Added compiled binaries to `.gitignore` to prevent accidental commits
  - Fixed Workers build by removing undefined PlaywrightMCP Durable Object

## [0.8.0] - 2025-01-14

🎉 **Major Release - Admin Dashboard & Enhanced User Experience**

This release transforms the Adblock Compiler into a comprehensive, user-friendly platform with an intuitive admin dashboard, real-time notifications, and streamlined project organization.

### Added

- **🎯 Admin Dashboard** - New landing page (`/`) showcasing the power of Adblock Compiler
  - Real-time metrics display (requests, queue depth, cache hit rate, response time)
  - Interactive queue depth visualization with Chart.js
  - Quick navigation to all tools and test pages
  - Responsive design with modern UI/UX
  - Auto-refresh every 30 seconds
  - Quick action panel for common tasks

- **🔔 Notification System** for async operations
  - Browser/OS notifications when compilation jobs complete
  - In-page toast notifications with multiple styles (success, error, warning, info)
  - Persistent job tracking across page refreshes via LocalStorage
  - Automatic cleanup of old jobs (1 hour retention)
  - Polling for job completion every 10 seconds
  - Toggle to enable/disable notifications with permission management

- **📚 Enhanced Documentation**
  - New `docs/ADMIN_DASHBOARD.md` - Comprehensive dashboard guide
  - WebSocket usage explanations and comparisons
  - Endpoint selection guide (JSON vs SSE vs WebSocket vs Queue)
  - Benchmark information and instructions
  - Notification system documentation

- **🎨 UI/UX Improvements**
  - Renamed `/index.html` → `/compiler.html` (compilation UI)
  - New `/index.html` as admin dashboard (landing page)
  - Clear visual hierarchy with card-based navigation
  - Informative descriptions for each tool
  - "Why WebSocket?" educational content
  - Endpoint comparison with use case guidance

### Changed

- **📂 Project Organization** - Cleaner root directory
  - Moved `postman-collection.json` → `docs/tools/postman-collection.json`
  - Moved `postman-environment.json` → `docs/tools/postman-environment.json`
  - Moved `prisma.config.ts` → `prisma/prisma.config.ts`
  - Updated all documentation references to new file locations

- **🗑️ Removed Outdated Files**
  - Deleted `CODE_REVIEW.old.md` (superseded by `CODE_REVIEW.md`)
  - Deleted `REVIEW_SUMMARY.md` (info consolidated in `CODE_REVIEW.md`)
  - Added `coverage.lcov` to `.gitignore` (build artifact)

- **📄 Documentation Updates**
  - Updated `docs/POSTMAN_TESTING.md` with new file paths
  - Updated `docs/api/QUICK_REFERENCE.md` with new file paths
  - Updated `docs/OPENAPI_TOOLING.md` with new file paths

### Highlights

This release focuses on **showcasing the power and versatility** of Adblock Compiler:

- **User-Friendly**: New admin dashboard makes it easy to discover features
- **Real-time**: Live metrics and notifications keep users informed
- **Educational**: Built-in guidance on when to use each endpoint
- **Professional**: Polished UI demonstrates production-ready quality
- **Organized**: Clean project structure improves maintainability

## [Unreleased]

### Added

- **Priority Queue Support** for async compilation
  - Two-tier queue system: standard and high priority
  - Separate queues with optimized settings for different priority levels
  - High-priority queue has smaller batch size (5) and shorter timeout (2s) for faster processing
  - Standard priority queue maintains larger batches (10) and normal timeout (5s) for throughput
  - Optional `priority` field in async API endpoints (`/compile/async`, `/compile/batch/async`)
  - Automatic routing to appropriate queue based on priority level
  - Premium users and urgent compilations can use high-priority processing
  - Updated documentation with priority queue examples and deployment instructions
- **Cloudflare Tail Worker** for advanced logging and observability
  - Real-time log capture from main worker (console logs, exceptions, errors)
  - Optional KV storage for log persistence with configurable TTL
  - Webhook integration for forwarding critical errors to external services
  - Support for Slack, Discord, Datadog, Sentry, and custom endpoints
  - Structured event formatting for external log management systems
  - Comprehensive documentation and quick start guide
  - Example integrations for popular monitoring services
  - Unit tests for tail worker logic
- npm scripts for tail worker deployment and management (`tail:deploy`, `tail:dev`, `tail:logs`)
- GitHub Actions workflow for automated testing
- Performance monitoring and analytics integration

## [0.6.0] - 2026-01-01

### Added

- **Gzip Compression** for cache storage (70-80% size reduction)
- **Circuit Breaker** with automatic retry (3 attempts) and exponential backoff for external sources
- **Batch Processing API** (`POST /compile/batch`) for compiling up to 10 lists in parallel
- **Request Deduplication** for concurrent identical requests
- **Visual Diff** component in Web UI showing changes between compilations
- npm package.json for Node.js compatibility
- Comprehensive API documentation in `docs/api/README.md`
- Client library examples for Python, TypeScript/JavaScript, and Go
- Performance features section in documentation
- Status badges in README (JSR, Web UI, API, Deno, License)

### Changed

- Updated JSR package name to `@jk-com/adblock-compiler`
- Improved Web UI with batch endpoint and performance features documentation
- Enhanced README with deployment badges and feature highlights
- Renamed repository to `adblock-compiler` on GitHub
- Updated documentation to emphasize Compiler-as-a-Service model

### Fixed

- Variable scoping issue with `previousCachedVersion`
- Cache decompression error handling
- Rate limiting headers (429 with Retry-After)

## [2.0.0] - 2024-12-15

### Added

- Initial production release as AdBlock Compiler
- Cloudflare Workers deployment support
- Server-Sent Events (SSE) for real-time progress tracking
- Web UI with Simple Mode, Advanced Mode, and Examples
- Rate limiting (10 requests per minute per IP)
- KV caching with 1-hour TTL
- Event pipeline with 9 event types
- Interactive API documentation tab

### Changed

- Complete Deno-native rewrite from @adguard/hostlist-compiler
- Zero Node.js dependencies
- Platform-agnostic design (Deno, Node.js, Cloudflare Workers, browsers)

---

## Legacy Releases (Original @adguard/hostlist-compiler)

## [1.0.39] - 2025-03-13

### Changed

- Updated [@adguard/filters-downloader] to 2.3.1. This version handles empty sources correctly. [#85]

[1.0.39]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.38...v1.0.39
[#85]: https://github.com/AdguardTeam/HostlistCompiler/issues/85

## [1.0.38] - 2025-03-06

### Changed

- Updated [@adguard/filters-downloader] to 2.3.0.

### Fixed

- Path determination issue. [#82]

[1.0.38]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.37...v1.0.38
[#82]: https://github.com/AdguardTeam/HostlistCompiler/issues/82

## [1.0.37] - 2025-02-28

### Added

- Resolving the `!#include` directive by using `@adguard/filters-downloader`. [#78]

[1.0.37]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.35...v1.0.37
[#78]: https://github.com/AdguardTeam/HostlistCompiler/issues/78

## [1.0.35] - 2025-02-07

### Added

- `ConvertToAscii` transformation option [#62]

[1.0.35]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.34...v1.0.35
[#62]: https://github.com/AdguardTeam/HostlistCompiler/issues/62

## [1.0.34] - 2025-01-10

### Removed

- Calculation of checksum for filters. [#76]

[1.0.34]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.33...v1.0.34

## [1.0.33] - 2024-12-27

### Fixed

- Bug with checksum calculation. Leave blank lines when counting. [#76]

[1.0.33]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.32...v1.0.33

## [1.0.32] - 2024-12-27

### Fixed

- Bug with checksum calculation. Additional line start. [#76]

[1.0.32]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.31...v1.0.32

## [1.0.31] - 2024-12-23

### Fixed

- Validation of TLD domains [#63]

### Added

- Calculation of checksum for filters and `! Checksum` string to the filter list meta [#76]

[1.0.31]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.29...v1.0.31
[#63]: https://github.com/AdguardTeam/HostlistCompiler/issues/63
[#76]: https://github.com/AdguardTeam/HostlistCompiler/issues/76

## [1.0.29] - 2024-09-26

### Added

- `$network` modifier removing during `RemoveModifiers` transformation [#72]

[1.0.29]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.28...v1.0.29
[#72]: https://github.com/AdguardTeam/FiltersCompiler/issues/72

## [1.0.28] - 2024-09-25

### Fix

- add `ValidateAllowIp` to validate configuration schema [#69]

[1.0.28]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.27...v1.0.28

## [1.0.27] - 2024-09-25

### Added

- `ValidateAllowIp` transformation option [#69]

[1.0.27]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.26...v1.0.27
[#69]: https://github.com/AdguardTeam/FiltersCompiler/issues/69
[@adguard/filters-downloader]: https://github.com/AdguardTeam/FiltersDownloader/blob/main/CHANGELOG.md
