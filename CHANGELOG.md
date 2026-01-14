# AdBlock Compiler Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
[@adguard/filters-downloader]: https://github.com/AdguardTeam/FiltersDownloader/blob/master/CHANGELOG.md
