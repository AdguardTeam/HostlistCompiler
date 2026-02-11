# Bugs and Feature Requests

This document tracks identified bugs and feature requests for the adblock-compiler project.

Last Updated: 2026-02-11

---

## 🐛 Bugs

### Critical

#### BUG-002: No request body size limits

**Impact**: Potential DoS via large payloads
**Location**: `worker/handlers/compile.ts`, `worker/middleware/index.ts`
**Fix**: Add max body size validation (1MB default)

#### BUG-010: No CSRF protection

**Impact**: Vulnerability to CSRF attacks
**Location**: Worker POST endpoints
**Fix**: Add CSRF token validation

#### BUG-012: No SSRF protection for source URLs

**Impact**: Internal network access via malicious source URLs
**Location**: `src/downloader/FilterDownloader.ts`
**Fix**: Validate URLs to block private IPs and non-HTTP protocols

### High

#### BUG-001: Direct console.log/console.error usage bypasses logger

**Impact**: Inconsistent logging
**Locations**:

- `src/diagnostics/DiagnosticsCollector.ts:90-92, 128-130`
- `src/utils/EventEmitter.ts`
- `src/queue/CloudflareQueueProvider.ts`
- `src/services/AnalyticsService.ts`
  **Fix**: Replace all console.* calls with logger methods

#### BUG-003: Weak type validation in compile handler

**Impact**: Invalid data could pass through
**Location**: `worker/handlers/compile.ts:85-95`
**Fix**: Use runtime validation before type assertion

#### BUG-006: Diagnostics events stored only in memory

**Impact**: Events not exported for analysis
**Location**: `src/diagnostics/DiagnosticsCollector.ts`
**Fix**: Add event export mechanism

#### BUG-011: Missing security headers

**Impact**: Reduced security posture
**Location**: Worker responses
**Fix**: Add X-Content-Type-Options, X-Frame-Options, CSP, HSTS

### Medium

#### BUG-004: Silent error swallowing in FilterService

**Impact**: Failed downloads return empty strings
**Location**: `src/services/FilterService.ts:44`
**Fix**: Let errors propagate or return Result type

#### BUG-007: No distributed trace ID propagation

**Impact**: Difficult to correlate logs across async operations
**Location**: Worker handlers
**Fix**: Extract and propagate trace IDs from headers

### Low

#### BUG-005: Database errors not wrapped with custom types

**Impact**: Inconsistent error handling
**Location**: `src/storage/PrismaAdapter.ts`, `src/storage/D1Adapter.ts`
**Fix**: Wrap with `StorageError`

#### BUG-008: No public coverage reports

**Impact**: Unknown test coverage
**Fix**: Add Codecov integration

#### BUG-009: E2E tests require running server

**Impact**: Manual test setup required
**Location**: `worker/api.e2e.test.ts`, `worker/websocket.e2e.test.ts`
**Fix**: Add test server lifecycle management

---

## 🚀 Feature Requests

### Critical

#### FEATURE-001: Add structured JSON logging

**Why**: Production log aggregation requires structured format
**Implementation**: Add StructuredLogger class with JSON output

#### FEATURE-004: Add Zod schema validation

**Why**: Type-safe runtime validation
**Implementation**: Replace manual validation with Zod schemas

#### FEATURE-006: Centralized error reporting service

**Why**: Production error tracking (Sentry, Datadog)
**Implementation**: ErrorReporter interface with Sentry/console implementations

#### FEATURE-008: Add circuit breaker pattern

**Why**: Prevent cascading failures
**Implementation**: CircuitBreaker class for source downloads

#### FEATURE-009: Add OpenTelemetry integration

**Why**: Industry-standard distributed tracing
**Implementation**: OpenTelemetry spans for compilation operations

#### FEATURE-014: Add rate limiting per endpoint

**Why**: Different endpoints have different resource costs
**Implementation**: Per-endpoint rate limit configuration

#### FEATURE-016: Add health check endpoint enhancements

**Why**: Monitor dependencies, not just uptime
**Implementation**: Health checks for database, cache, sources

#### FEATURE-021: Add runbook for common operations

**Why**: Operators need incident procedures
**Implementation**: Create `docs/RUNBOOK.md`

### High

#### FEATURE-005: Add URL allowlist/blocklist

**Why**: Prevent SSRF attacks
**Implementation**: Domain-based URL filtering

#### FEATURE-017: Add metrics export endpoint

**Why**: Prometheus/Datadog integration
**Implementation**: `/metrics` endpoint with standard format

### Medium

#### FEATURE-002: Per-module log level configuration

**Why**: Verbose logging for specific modules
**Implementation**: Module-level log level overrides

#### FEATURE-007: Add error code documentation

**Why**: Developers need to understand error codes
**Implementation**: Create `docs/ERROR_CODES.md`

#### FEATURE-010: Add performance sampling

**Why**: Reduce tracing overhead at high volume
**Implementation**: Configurable sampling rate for diagnostics

#### FEATURE-011: Add request duration histogram

**Why**: Understand performance distribution
**Implementation**: Record durations in buckets (p50, p95, p99)

#### FEATURE-013: Add performance benchmarks

**Why**: Track performance regressions
**Implementation**: Benchmarks for compilation, transformations, cache

#### FEATURE-015: Add request signing for admin endpoints

**Why**: Prevent replay attacks
**Implementation**: HMAC-based request signing

#### FEATURE-019: Add configuration validation on startup

**Why**: Fail fast with missing environment variables
**Implementation**: Validate required config on startup

#### FEATURE-020: Add graceful shutdown

**Why**: Allow in-flight requests to complete
**Implementation**: SIGTERM handler with timeout

#### FEATURE-022: Add API documentation

**Why**: External users need API reference
**Implementation**: Generate HTML docs from OpenAPI spec

### Low

#### FEATURE-003: Log file output with rotation

**Why**: CLI could benefit from file logging
**Implementation**: Optional file appender with size-based rotation

#### FEATURE-012: Add mutation testing

**Why**: Verify test effectiveness
**Implementation**: Use Stryker or similar tool

#### FEATURE-018: Add dashboard for diagnostics

**Why**: Real-time system visibility
**Implementation**: Web UI for active compilations, errors, cache stats

---

## Quick Reference

### By Category

**Logging**: BUG-001, FEATURE-001, FEATURE-002, FEATURE-003

**Validation**: BUG-002, BUG-003, FEATURE-004, FEATURE-005, FEATURE-019

**Error Handling**: BUG-004, BUG-005, FEATURE-006, FEATURE-007, FEATURE-008

**Tracing/Diagnostics**: BUG-006, BUG-007, FEATURE-009, FEATURE-010, FEATURE-011, FEATURE-018

**Security**: BUG-010, BUG-011, BUG-012, FEATURE-014, FEATURE-015

**Observability**: FEATURE-016, FEATURE-017, FEATURE-021

**Testing**: BUG-008, BUG-009, FEATURE-012, FEATURE-013

**Operations**: FEATURE-020, FEATURE-022

### By Priority

**Critical**: BUG-002, BUG-010, BUG-012, FEATURE-001, FEATURE-004, FEATURE-006, FEATURE-008, FEATURE-009, FEATURE-014, FEATURE-016, FEATURE-021

**High**: BUG-001, BUG-003, BUG-006, BUG-011, FEATURE-005, FEATURE-017

**Medium**: BUG-004, BUG-007, FEATURE-002, FEATURE-007, FEATURE-010, FEATURE-011, FEATURE-013, FEATURE-015, FEATURE-019, FEATURE-020, FEATURE-022

**Low**: BUG-005, BUG-008, BUG-009, FEATURE-003, FEATURE-012, FEATURE-018

---

## Notes

- See `PRODUCTION_READINESS.md` for detailed analysis and implementation guidance
- All bugs and features include specific file locations and implementation recommendations
- Priority ratings based on production readiness requirements
- Estimated total effort: 8-12 weeks for all items
