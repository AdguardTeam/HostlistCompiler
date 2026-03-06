/**
 * Tests for Zod schemas used in request validation
 */

import { assertEquals } from '@std/assert';
import {
    AdblockRuleSchema,
    BatchRequestAsyncSchema,
    BatchRequestSyncSchema,
    BenchmarkMetricsSchema,
    CliArgumentsSchema,
    CompilationResultSchema,
    CompileRequestSchema,
    ConfigurationSchema,
    EnvironmentSchema,
    EtcHostsRuleSchema,
    HttpFetcherOptionsSchema,
    PlatformCompilerOptionsSchema,
    SourceSchema,
    ValidationErrorSchema,
    ValidationErrorTypeSchema,
    ValidationReportSchema,
    ValidationResultSchema,
    ValidationSeveritySchema,
    WorkerCompilationResultSchema,
} from './schemas.ts';
import { SourceType, TransformationType } from '../types/index.ts';

// SourceSchema tests
Deno.test('SourceSchema - should validate minimal source', () => {
    const source = { source: 'https://example.com/list.txt' };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, true);
});

Deno.test('SourceSchema - should validate full source', () => {
    const source = {
        source: 'https://example.com/list.txt',
        name: 'Example List',
        type: SourceType.Adblock,
        transformations: [TransformationType.RemoveComments],
    };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, true);
});

Deno.test('SourceSchema - should reject whitespace-only source', () => {
    const source = { source: '   ' };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, false);
});

Deno.test('SourceSchema - should reject empty source string', () => {
    const source = { source: '' };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, false);
});

Deno.test('SourceSchema - should reject unknown property', () => {
    const source = {
        source: 'https://example.com/list.txt',
        unknownProp: 'value',
    };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, false);
});

// ConfigurationSchema tests
Deno.test('ConfigurationSchema - should validate minimal configuration', () => {
    const config = {
        name: 'Test Config',
        sources: [{ source: 'https://example.com/list.txt' }],
    };
    const result = ConfigurationSchema.safeParse(config);
    assertEquals(result.success, true);
});

Deno.test('ConfigurationSchema - should reject empty sources', () => {
    const config = {
        name: 'Test Config',
        sources: [],
    };
    const result = ConfigurationSchema.safeParse(config);
    assertEquals(result.success, false);
});

// CompileRequestSchema tests
Deno.test('CompileRequestSchema - should validate request', () => {
    const request = {
        configuration: {
            name: 'Test',
            sources: [{ source: 'https://example.com/list.txt' }],
        },
    };
    const result = CompileRequestSchema.safeParse(request);
    assertEquals(result.success, true);
});

Deno.test('CompileRequestSchema - should validate with all fields', () => {
    const request = {
        configuration: {
            name: 'Test',
            sources: [{ source: 'https://example.com/list.txt' }],
        },
        preFetchedContent: { 'https://example.com/list.txt': 'content' },
        benchmark: true,
        priority: 'high' as const,
        turnstileToken: 'token123',
    };
    const result = CompileRequestSchema.safeParse(request);
    assertEquals(result.success, true);
});

// BatchRequestSyncSchema tests
Deno.test('BatchRequestSyncSchema - should validate batch with unique IDs', () => {
    const batch = {
        requests: [
            { id: '1', configuration: { name: 'Test', sources: [{ source: 'https://example.com/1.txt' }] } },
            { id: '2', configuration: { name: 'Test', sources: [{ source: 'https://example.com/2.txt' }] } },
        ],
    };
    const result = BatchRequestSyncSchema.safeParse(batch);
    assertEquals(result.success, true);
});

Deno.test('BatchRequestSyncSchema - should reject duplicate IDs', () => {
    const batch = {
        requests: [
            { id: '1', configuration: { name: 'Test', sources: [{ source: 'https://example.com/1.txt' }] } },
            { id: '1', configuration: { name: 'Test', sources: [{ source: 'https://example.com/2.txt' }] } },
        ],
    };
    const result = BatchRequestSyncSchema.safeParse(batch);
    assertEquals(result.success, false);
});

Deno.test('BatchRequestSyncSchema - should reject more than 10 requests', () => {
    const requests = Array.from({ length: 11 }, (_, i) => ({
        id: String(i),
        configuration: { name: 'Test', sources: [{ source: `https://example.com/${i}.txt` }] },
    }));
    const batch = { requests };
    const result = BatchRequestSyncSchema.safeParse(batch);
    assertEquals(result.success, false);
});

Deno.test('BatchRequestSyncSchema - should accept 10 requests', () => {
    const requests = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        configuration: { name: 'Test', sources: [{ source: `https://example.com/${i}.txt` }] },
    }));
    const batch = { requests };
    const result = BatchRequestSyncSchema.safeParse(batch);
    assertEquals(result.success, true);
});

// BatchRequestAsyncSchema tests
Deno.test('BatchRequestAsyncSchema - should reject more than 100 requests', () => {
    const requests = Array.from({ length: 101 }, (_, i) => ({
        id: String(i),
        configuration: { name: 'Test', sources: [{ source: `https://example.com/${i}.txt` }] },
    }));
    const batch = { requests };
    const result = BatchRequestAsyncSchema.safeParse(batch);
    assertEquals(result.success, false);
});

Deno.test('BatchRequestAsyncSchema - should accept 100 requests', () => {
    const requests = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        configuration: { name: 'Test', sources: [{ source: `https://example.com/${i}.txt` }] },
    }));
    const batch = { requests };
    const result = BatchRequestAsyncSchema.safeParse(batch);
    assertEquals(result.success, true);
});

Deno.test('BatchRequestAsyncSchema - should validate with priority', () => {
    const batch = {
        requests: [
            { id: '1', configuration: { name: 'Test', sources: [{ source: 'https://example.com/1.txt' }] } },
        ],
        priority: 'high' as const,
    };
    const result = BatchRequestAsyncSchema.safeParse(batch);
    assertEquals(result.success, true);
});

// HttpFetcherOptionsSchema tests
Deno.test('HttpFetcherOptionsSchema - should validate empty options', () => {
    const options = {};
    const result = HttpFetcherOptionsSchema.safeParse(options);
    assertEquals(result.success, true);
});

Deno.test('HttpFetcherOptionsSchema - should validate full options', () => {
    const options = {
        timeout: 5000,
        userAgent: 'Mozilla/5.0',
        allowEmptyResponse: true,
        headers: {
            'Authorization': 'Bearer token',
            'Accept': 'text/plain',
        },
    };
    const result = HttpFetcherOptionsSchema.safeParse(options);
    assertEquals(result.success, true);
});

Deno.test('HttpFetcherOptionsSchema - should reject negative timeout', () => {
    const options = { timeout: -1000 };
    const result = HttpFetcherOptionsSchema.safeParse(options);
    assertEquals(result.success, false);
});

Deno.test('HttpFetcherOptionsSchema - should reject non-integer timeout', () => {
    const options = { timeout: 1500.5 };
    const result = HttpFetcherOptionsSchema.safeParse(options);
    assertEquals(result.success, false);
});

// PlatformCompilerOptionsSchema tests
Deno.test('PlatformCompilerOptionsSchema - should validate empty options', () => {
    const options = {};
    const result = PlatformCompilerOptionsSchema.safeParse(options);
    assertEquals(result.success, true);
});

Deno.test('PlatformCompilerOptionsSchema - should validate with preFetchedContent as Record', () => {
    const options = {
        preFetchedContent: {
            'https://example.com/list.txt': '||ads.com^\n||tracker.com^',
        },
    };
    const result = PlatformCompilerOptionsSchema.safeParse(options);
    assertEquals(result.success, true);
});

Deno.test('PlatformCompilerOptionsSchema - should validate with preFetchedContent as Map', () => {
    const options = {
        preFetchedContent: new Map([
            ['https://example.com/list.txt', '||ads.com^\n||tracker.com^'],
        ]),
    };
    const result = PlatformCompilerOptionsSchema.safeParse(options);
    assertEquals(result.success, true);
});

Deno.test('PlatformCompilerOptionsSchema - should validate with httpOptions', () => {
    const options = {
        httpOptions: {
            timeout: 10000,
            userAgent: 'Custom User Agent',
        },
    };
    const result = PlatformCompilerOptionsSchema.safeParse(options);
    assertEquals(result.success, true);
});

Deno.test('PlatformCompilerOptionsSchema - should allow customFetcher through passthrough', () => {
    const options = {
        customFetcher: {
            fetch: async () => 'content',
            canHandle: () => true,
        },
    };
    const result = PlatformCompilerOptionsSchema.safeParse(options);
    assertEquals(result.success, true);
});

// ValidationErrorTypeSchema tests
Deno.test('ValidationErrorTypeSchema - should validate all error types', () => {
    const errorTypes = [
        'parse_error',
        'syntax_error',
        'unsupported_modifier',
        'invalid_hostname',
        'ip_not_allowed',
        'pattern_too_short',
        'public_suffix_match',
        'invalid_characters',
        'cosmetic_not_supported',
        'modifier_validation_failed',
    ];

    for (const type of errorTypes) {
        const result = ValidationErrorTypeSchema.safeParse(type);
        assertEquals(result.success, true, `Failed to validate error type: ${type}`);
    }
});

Deno.test('ValidationErrorTypeSchema - should reject invalid error type', () => {
    const result = ValidationErrorTypeSchema.safeParse('invalid_type');
    assertEquals(result.success, false);
});

// ValidationSeveritySchema tests
Deno.test('ValidationSeveritySchema - should validate all severity levels', () => {
    const severities = ['error', 'warning', 'info'];

    for (const severity of severities) {
        const result = ValidationSeveritySchema.safeParse(severity);
        assertEquals(result.success, true, `Failed to validate severity: ${severity}`);
    }
});

Deno.test('ValidationSeveritySchema - should reject invalid severity', () => {
    const result = ValidationSeveritySchema.safeParse('critical');
    assertEquals(result.success, false);
});

// ValidationErrorSchema tests
Deno.test('ValidationErrorSchema - should validate minimal error', () => {
    const error = {
        type: 'parse_error',
        severity: 'error',
        ruleText: '||invalid rule',
        message: 'Failed to parse rule',
    };
    const result = ValidationErrorSchema.safeParse(error);
    assertEquals(result.success, true);
});

Deno.test('ValidationErrorSchema - should validate full error', () => {
    const error = {
        type: 'unsupported_modifier',
        severity: 'error',
        ruleText: '||example.com^$popup',
        lineNumber: 42,
        message: 'Unsupported modifier: popup',
        details: 'Supported modifiers: important, ~important, ctag, dnstype, dnsrewrite',
        sourceName: 'Custom Filter',
    };
    const result = ValidationErrorSchema.safeParse(error);
    assertEquals(result.success, true);
});

Deno.test('ValidationErrorSchema - should reject invalid line number', () => {
    const error = {
        type: 'parse_error',
        severity: 'error',
        ruleText: '||invalid',
        lineNumber: -1, // Invalid negative line number
        message: 'Failed to parse',
    };
    const result = ValidationErrorSchema.safeParse(error);
    assertEquals(result.success, false);
});

// ValidationReportSchema tests
Deno.test('ValidationReportSchema - should validate empty report', () => {
    const report = {
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        errors: [],
        totalRules: 100,
        validRules: 100,
        invalidRules: 0,
    };
    const result = ValidationReportSchema.safeParse(report);
    assertEquals(result.success, true);
});

Deno.test('ValidationReportSchema - should validate report with errors', () => {
    const report = {
        errorCount: 2,
        warningCount: 1,
        infoCount: 0,
        errors: [
            {
                type: 'parse_error',
                severity: 'error',
                ruleText: '||invalid1',
                message: 'Parse error 1',
            },
            {
                type: 'syntax_error',
                severity: 'error',
                ruleText: '||invalid2',
                message: 'Syntax error 2',
            },
            {
                type: 'modifier_validation_failed',
                severity: 'warning',
                ruleText: '||example.com^$important',
                message: 'Modifier warning',
            },
        ],
        totalRules: 100,
        validRules: 97,
        invalidRules: 3,
    };
    const result = ValidationReportSchema.safeParse(report);
    assertEquals(result.success, true);
});

Deno.test('ValidationReportSchema - should reject negative counts', () => {
    const report = {
        errorCount: -1, // Invalid negative count
        warningCount: 0,
        infoCount: 0,
        errors: [],
        totalRules: 100,
        validRules: 100,
        invalidRules: 0,
    };
    const result = ValidationReportSchema.safeParse(report);
    assertEquals(result.success, false);
});

// ValidationResultSchema tests
Deno.test('ValidationResultSchema - should validate result with empty rules', () => {
    const result = {
        rules: [],
        validation: {
            errorCount: 0,
            warningCount: 0,
            infoCount: 0,
            errors: [],
            totalRules: 0,
            validRules: 0,
            invalidRules: 0,
        },
    };
    const parseResult = ValidationResultSchema.safeParse(result);
    assertEquals(parseResult.success, true);
});

Deno.test('ValidationResultSchema - should validate result with rules and errors', () => {
    const result = {
        rules: ['||example.com^', '||ads.com^'],
        validation: {
            errorCount: 1,
            warningCount: 0,
            infoCount: 0,
            errors: [
                {
                    type: 'parse_error',
                    severity: 'error',
                    ruleText: '||invalid',
                    message: 'Parse failed',
                },
            ],
            totalRules: 3,
            validRules: 2,
            invalidRules: 1,
        },
    };
    const parseResult = ValidationResultSchema.safeParse(result);
    assertEquals(parseResult.success, true);
});

// SourceSchema transformation ordering tests
Deno.test('SourceSchema - should reject Compress without Deduplicate', () => {
    const source = {
        source: 'https://example.com/list.txt',
        transformations: [TransformationType.Compress],
    };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, false);
});

Deno.test('SourceSchema - should accept Compress with Deduplicate before it', () => {
    const source = {
        source: 'https://example.com/list.txt',
        transformations: [TransformationType.Deduplicate, TransformationType.Compress],
    };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, true);
});

Deno.test('SourceSchema - should reject Compress before Deduplicate (wrong ordering)', () => {
    const source = {
        source: 'https://example.com/list.txt',
        transformations: [TransformationType.Compress, TransformationType.Deduplicate],
    };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, false);
});

Deno.test('SourceSchema - should accept neither Compress nor Deduplicate', () => {
    const source = {
        source: 'https://example.com/list.txt',
        transformations: [TransformationType.RemoveComments],
    };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, true);
});

Deno.test('SourceSchema - should trim source URL whitespace via transform', () => {
    const source = { source: '  https://example.com/list.txt  ' };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.source, 'https://example.com/list.txt');
    }
});

Deno.test('SourceSchema - should trim name whitespace via transform', () => {
    const source = { source: 'https://example.com/list.txt', name: '  My List  ' };
    const result = SourceSchema.safeParse(source);
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.name, 'My List');
    }
});

// ConfigurationSchema transformation ordering tests
Deno.test('ConfigurationSchema - should reject Compress without Deduplicate', () => {
    const config = {
        name: 'Test',
        sources: [{ source: 'https://example.com/list.txt' }],
        transformations: [TransformationType.Compress],
    };
    const result = ConfigurationSchema.safeParse(config);
    assertEquals(result.success, false);
});

Deno.test('ConfigurationSchema - should accept Compress with Deduplicate before it', () => {
    const config = {
        name: 'Test',
        sources: [{ source: 'https://example.com/list.txt' }],
        transformations: [TransformationType.Deduplicate, TransformationType.Compress],
    };
    const result = ConfigurationSchema.safeParse(config);
    assertEquals(result.success, true);
});

Deno.test('ConfigurationSchema - should reject Compress before Deduplicate (wrong ordering)', () => {
    const config = {
        name: 'Test',
        sources: [{ source: 'https://example.com/list.txt' }],
        transformations: [TransformationType.Compress, TransformationType.Deduplicate],
    };
    const result = ConfigurationSchema.safeParse(config);
    assertEquals(result.success, false);
});

// preFetchedContent URL key validation tests
Deno.test('CompileRequestSchema - should accept valid URL keys in preFetchedContent', () => {
    const request = {
        configuration: {
            name: 'Test',
            sources: [{ source: 'https://example.com/list.txt' }],
        },
        preFetchedContent: { 'https://example.com/list.txt': 'content' },
    };
    const result = CompileRequestSchema.safeParse(request);
    assertEquals(result.success, true);
});

Deno.test('CompileRequestSchema - should accept arbitrary string keys in preFetchedContent', () => {
    const request = {
        configuration: {
            name: 'Test',
            sources: [{ source: 'https://example.com/list.txt' }],
        },
        preFetchedContent: { 'bench-test': 'content', 'source-1': 'more content' },
    };
    const result = CompileRequestSchema.safeParse(request);
    assertEquals(result.success, true);
});

// CompilationResultSchema tests
Deno.test('CompilationResultSchema - should validate valid result', () => {
    const result = { rules: ['||ads.com^', '||tracker.com^'], ruleCount: 2 };
    const parseResult = CompilationResultSchema.safeParse(result);
    assertEquals(parseResult.success, true);
});

Deno.test('CompilationResultSchema - should validate empty rules array', () => {
    const result = { rules: [], ruleCount: 0 };
    const parseResult = CompilationResultSchema.safeParse(result);
    assertEquals(parseResult.success, true);
});

Deno.test('CompilationResultSchema - should reject negative ruleCount', () => {
    const result = { rules: [], ruleCount: -1 };
    const parseResult = CompilationResultSchema.safeParse(result);
    assertEquals(parseResult.success, false);
});

// WorkerCompilationResultSchema tests
Deno.test('WorkerCompilationResultSchema - should validate result without metrics', () => {
    const result = { rules: ['||ads.com^'], ruleCount: 1 };
    const parseResult = WorkerCompilationResultSchema.safeParse(result);
    assertEquals(parseResult.success, true);
});

Deno.test('WorkerCompilationResultSchema - should validate result with full metrics', () => {
    const result = {
        rules: ['||ads.com^'],
        ruleCount: 1,
        metrics: {
            totalDurationMs: 250,
            stages: [{ name: 'fetch', durationMs: 100 }, { name: 'transform', durationMs: 50 }],
            sourceCount: 1,
            ruleCount: 5,
            outputRuleCount: 1,
        },
    };
    const parseResult = WorkerCompilationResultSchema.safeParse(result);
    assertEquals(parseResult.success, true);
});

Deno.test('WorkerCompilationResultSchema - should validate result with undefined metrics', () => {
    const result = { rules: [], ruleCount: 0, metrics: undefined };
    const parseResult = WorkerCompilationResultSchema.safeParse(result);
    assertEquals(parseResult.success, true);
});

// BenchmarkMetricsSchema tests
Deno.test('BenchmarkMetricsSchema - should validate full metrics', () => {
    const metrics = {
        totalDurationMs: 500,
        stages: [
            { name: 'fetch', durationMs: 200, itemCount: 3, itemsPerSecond: 15 },
            { name: 'transform', durationMs: 100 },
        ],
        sourceCount: 3,
        ruleCount: 1000,
        outputRuleCount: 42,
    };
    const result = BenchmarkMetricsSchema.safeParse(metrics);
    assertEquals(result.success, true);
});

Deno.test('BenchmarkMetricsSchema - should validate minimal metrics', () => {
    const metrics = { totalDurationMs: 100, stages: [], sourceCount: 0, ruleCount: 0, outputRuleCount: 0 };
    const result = BenchmarkMetricsSchema.safeParse(metrics);
    assertEquals(result.success, true);
});

Deno.test('BenchmarkMetricsSchema - should reject undefined (not optional by itself)', () => {
    const result = BenchmarkMetricsSchema.safeParse(undefined);
    assertEquals(result.success, false);
});

Deno.test('BenchmarkMetricsSchema - should reject negative duration', () => {
    const metrics = { totalDurationMs: -100, stages: [], sourceCount: 0, ruleCount: 0, outputRuleCount: 0 };
    const result = BenchmarkMetricsSchema.safeParse(metrics);
    assertEquals(result.success, false);
});

// CliArgumentsSchema tests
Deno.test('CliArgumentsSchema - should validate with config and output', () => {
    const args = { config: 'config.json', output: 'output.txt' };
    const result = CliArgumentsSchema.safeParse(args);
    assertEquals(result.success, true);
});

Deno.test('CliArgumentsSchema - should validate with input and output', () => {
    const args = { input: ['https://example.com/list.txt'], output: 'output.txt' };
    const result = CliArgumentsSchema.safeParse(args);
    assertEquals(result.success, true);
});

Deno.test('CliArgumentsSchema - should validate with all fields', () => {
    const args = {
        config: 'config.json',
        output: 'output.txt',
        inputType: 'adblock' as const,
        verbose: true,
        benchmark: true,
        useQueue: false,
        priority: 'high' as const,
    };
    const result = CliArgumentsSchema.safeParse(args);
    assertEquals(result.success, true);
});

Deno.test('CliArgumentsSchema - should pass when help is provided', () => {
    const args = { help: true };
    const result = CliArgumentsSchema.safeParse(args);
    assertEquals(result.success, true);
});

Deno.test('CliArgumentsSchema - should pass when version is provided', () => {
    const args = { version: true };
    const result = CliArgumentsSchema.safeParse(args);
    assertEquals(result.success, true);
});

Deno.test('CliArgumentsSchema - should fail when output is missing', () => {
    const args = { config: 'config.json' };
    const result = CliArgumentsSchema.safeParse(args);
    assertEquals(result.success, false);
    if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        assertEquals(messages.includes('--output is required'), true);
    }
});

Deno.test('CliArgumentsSchema - should fail when neither input nor config is provided', () => {
    const args = { output: 'output.txt' };
    const result = CliArgumentsSchema.safeParse(args);
    assertEquals(result.success, false);
    if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        assertEquals(messages.includes('Either --input or --config must be specified (or --help/--version)'), true);
    }
});

Deno.test('CliArgumentsSchema - should fail when both config and input are provided', () => {
    const args = { config: 'config.json', input: ['source.txt'], output: 'output.txt' };
    const result = CliArgumentsSchema.safeParse(args);
    assertEquals(result.success, false);
    if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        assertEquals(messages.includes('Cannot specify both config file (-c) and input sources (-i)'), true);
    }
});

// EnvironmentSchema tests
Deno.test('EnvironmentSchema - should validate empty environment', () => {
    const result = EnvironmentSchema.safeParse({});
    assertEquals(result.success, true);
});

Deno.test('EnvironmentSchema - should validate valid environment variables', () => {
    const env = {
        TURNSTILE_SECRET_KEY: 'secret-key',
        RATE_LIMIT_MAX_REQUESTS: '100',
        RATE_LIMIT_WINDOW_MS: '60000',
        CACHE_TTL: '3600',
        LOG_LEVEL: 'info',
    };
    const result = EnvironmentSchema.safeParse(env);
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.RATE_LIMIT_MAX_REQUESTS, 100);
        assertEquals(result.data.CACHE_TTL, 3600);
    }
});

Deno.test('EnvironmentSchema - should coerce numeric string values', () => {
    const env = { RATE_LIMIT_MAX_REQUESTS: '50', CACHE_TTL: '7200' };
    const result = EnvironmentSchema.safeParse(env);
    assertEquals(result.success, true);
    if (result.success) {
        assertEquals(result.data.RATE_LIMIT_MAX_REQUESTS, 50);
        assertEquals(result.data.CACHE_TTL, 7200);
    }
});

Deno.test('EnvironmentSchema - should reject invalid LOG_LEVEL', () => {
    const env = { LOG_LEVEL: 'verbose' };
    const result = EnvironmentSchema.safeParse(env);
    assertEquals(result.success, false);
});

Deno.test('EnvironmentSchema - should allow additional worker bindings via passthrough', () => {
    const env = { CUSTOM_BINDING: 'value' };
    const result = EnvironmentSchema.safeParse(env);
    assertEquals(result.success, true);
});

// AdblockRuleSchema tests
Deno.test('AdblockRuleSchema - should validate a basic adblock rule', () => {
    const rule = {
        ruleText: '||ads.example.com^',
        pattern: 'ads.example.com',
        whitelist: false,
        options: null,
        hostname: null,
    };
    const result = AdblockRuleSchema.safeParse(rule);
    assertEquals(result.success, true);
});

Deno.test('AdblockRuleSchema - should validate a rule with options and hostname', () => {
    const rule = {
        ruleText: '||ads.example.com^$important',
        pattern: 'ads.example.com',
        whitelist: false,
        options: [{ name: 'important', value: null }],
        hostname: 'ads.example.com',
    };
    const result = AdblockRuleSchema.safeParse(rule);
    assertEquals(result.success, true);
});

Deno.test('AdblockRuleSchema - should validate a whitelist rule with null options', () => {
    const rule = {
        ruleText: '@@||safe.example.com^',
        pattern: 'safe.example.com',
        whitelist: true,
        options: null,
        hostname: 'safe.example.com',
    };
    const result = AdblockRuleSchema.safeParse(rule);
    assertEquals(result.success, true);
});

Deno.test('AdblockRuleSchema - should reject rule with empty ruleText', () => {
    const rule = {
        ruleText: '',
        pattern: '',
        whitelist: false,
        options: null,
        hostname: null,
    };
    const result = AdblockRuleSchema.safeParse(rule);
    assertEquals(result.success, false);
});

Deno.test('AdblockRuleSchema - should reject rule with missing ruleText', () => {
    const rule = {
        pattern: 'ads.example.com',
        whitelist: false,
        options: null,
        hostname: null,
    };
    const result = AdblockRuleSchema.safeParse(rule);
    assertEquals(result.success, false);
});

// EtcHostsRuleSchema tests
Deno.test('EtcHostsRuleSchema - should validate a basic hosts rule', () => {
    const rule = {
        ruleText: '0.0.0.0 ads.example.com',
        hostnames: ['ads.example.com'],
    };
    const result = EtcHostsRuleSchema.safeParse(rule);
    assertEquals(result.success, true);
});

Deno.test('EtcHostsRuleSchema - should validate a hosts rule with multiple hostnames', () => {
    const rule = {
        ruleText: '0.0.0.0 ads.example.com tracker.example.com',
        hostnames: ['ads.example.com', 'tracker.example.com'],
    };
    const result = EtcHostsRuleSchema.safeParse(rule);
    assertEquals(result.success, true);
});

Deno.test('EtcHostsRuleSchema - should reject rule with empty hostnames array', () => {
    const rule = {
        ruleText: '0.0.0.0',
        hostnames: [],
    };
    const result = EtcHostsRuleSchema.safeParse(rule);
    assertEquals(result.success, false);
});

Deno.test('EtcHostsRuleSchema - should reject rule with empty ruleText', () => {
    const rule = {
        ruleText: '',
        hostnames: ['ads.example.com'],
    };
    const result = EtcHostsRuleSchema.safeParse(rule);
    assertEquals(result.success, false);
});
