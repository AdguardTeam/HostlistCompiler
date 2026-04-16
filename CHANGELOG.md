# Hostlist Compiler Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-04-16

### Added

- `ValidateAllowIpAndPublicSuffix` validation that keeps both IP address rules and rules matching whole public suffixes (e.g. `||185.149.120.173^`, `.org^`). [#126]

### Changed

`ValidateAllowIp` now normalizes incomplete IP rules to the safe format `||ip^`. [#127]
    - 4-octet IPs without proper separators (e.g. `1.2.3.4`, `1.2.3.4^`, `|1.2.3.4^`) are normalized to `||1.2.3.4^`
    - 3-octet subnet wildcards (e.g. `192.168.1.`, `192.168.1.*`) are allowed with `||` prefix
    - 3-octet patterns with `^` are rejected (e.g. `192.168.1^`, `||192.168.1^`)
    - 3-octet patterns without trailing dot/wildcard are rejected (e.g. `192.168.1`, `||192.168.1`)
    - 1-2 octet patterns are rejected (too wide, use regex instead)
    - Normalization (`ip-normalize.js`) is now purely a normalization step: it only rewrites valid patterns to canonical form and passes everything else through unchanged. Rejection of invalid patterns is the responsibility of the validator (`validate.js`), eliminating double-rejection.

### Fixed

- `ValidateAllowPublicSuffix` was letting through terminated ICANN TLDs (e.g. `xn--jlq61u9w7b`) because `tldts` v5.x had stale Public Suffix List data. Updated `tldts` from v5 to v7 which has the current PSL. [#128]
- Hardened `validHostname()` to reject hostnames that do not contain any alphanumeric character (e.g. `..`), covering a behavioral change in `tldts` v7.

[2.1.0]: https://github.com/AdguardTeam/HostlistCompiler/compare/v2.0.0...v2.1.0
[#126]: https://github.com/AdguardTeam/HostlistCompiler/issues/126
[#127]: https://github.com/AdguardTeam/HostlistCompiler/issues/127
[#128]: https://github.com/AdguardTeam/HostlistCompiler/issues/128

## [2.0.0] - 2026-04-02

### Added

- `ValidateAllowPublicSuffix` transformation option that allows rules matching whole public suffixes (e.g. `||hl.cn^`, `||org^`). [#124]

### Changed

- `Validate` now rejects rules matching whole public suffixes consistently across syntactic variants such as `||org^`, `||*.org^`, `.org^`, and `*.org^`. Use `ValidateAllowPublicSuffix` if you need to keep such rules.
- The compiler now warns when incompatible validation transformations are combined at runtime, and configuration validation rejects combining `Validate`, `ValidateAllowIp`, and `ValidateAllowPublicSuffix` in the same transformations list.

[2.0.0]: https://github.com/AdguardTeam/HostlistCompiler/compare/v1.0.39...v2.0.0
[#124]: https://github.com/AdguardTeam/HostlistCompiler/issues/124


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
