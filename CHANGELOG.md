# AdBlock Compiler Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- Custom domain setup guide (`CLOUDFLARE_PAGES_DOMAIN_SETUP.md`)
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
