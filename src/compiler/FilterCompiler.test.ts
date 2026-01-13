import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { compile, FilterCompiler } from '../../src/compiler/FilterCompiler.ts';
import { IConfiguration, SourceType, TransformationType } from '../../src/types/index.ts';
import { silentLogger } from '../../src/utils/index.ts';
import { fromFileUrl } from '@std/path';

// Get the test resource file path in a cross-platform way
const testResourcesDir = fromFileUrl(new URL('../resources/', import.meta.url));
const rulesFilePath = `${testResourcesDir}rules.txt`;

// Mock configuration for testing - must have at least one source to be valid
function createTestConfig(overrides: Partial<IConfiguration> = {}): IConfiguration {
    return {
        name: 'Test Filter List',
        sources: [
            {
                source: rulesFilePath,
                type: SourceType.Adblock,
            },
        ],
        ...overrides,
    };
}

// Test FilterCompiler basic functionality
Deno.test('FilterCompiler - should create instance with default logger', () => {
    const compiler = new FilterCompiler();
    assertExists(compiler);
});

Deno.test('FilterCompiler - should create instance with custom logger', () => {
    const compiler = new FilterCompiler(silentLogger);
    assertExists(compiler);
});

Deno.test('FilterCompiler - should compile minimal configuration', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const config = createTestConfig();

    const result = await compiler.compile(config);
    assertExists(result);
    assertEquals(Array.isArray(result), true);
    // Should contain header lines
    assertEquals(result.some((line) => line.includes('Title: Test Filter List')), true);
});

Deno.test('FilterCompiler - should add header with configuration metadata', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const config = createTestConfig({
        name: 'My Filter',
        description: 'A test filter list',
        homepage: 'https://example.org',
        license: 'MIT',
        version: '1.0.0',
    });

    const result = await compiler.compile(config);

    assertEquals(result.some((line) => line.includes('Title: My Filter')), true);
    assertEquals(result.some((line) => line.includes('Description: A test filter list')), true);
    assertEquals(result.some((line) => line.includes('Homepage: https://example.org')), true);
    assertEquals(result.some((line) => line.includes('License: MIT')), true);
    assertEquals(result.some((line) => line.includes('Version: 1.0.0')), true);
    assertEquals(result.some((line) => line.includes('Last modified:')), true);
    assertEquals(result.some((line) => line.includes('Compiled by')), true);
});

Deno.test('FilterCompiler - should reject invalid configuration', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const invalidConfig = { invalid: true } as unknown as IConfiguration;

    await assertRejects(
        () => compiler.compile(invalidConfig),
        Error,
        '/name: name is required and must be a non-empty string',
    );
});

Deno.test('FilterCompiler - should reject empty sources array', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const config = {
        name: 'Test',
        sources: [],
    };

    await assertRejects(
        () => compiler.compile(config),
        Error,
        '/sources: sources is required and must be a non-empty array',
    );
});

// Test compileWithMetrics
Deno.test('FilterCompiler.compileWithMetrics - should return rules without metrics when benchmark is false', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const config = createTestConfig();

    const result = await compiler.compileWithMetrics(config, false);

    assertExists(result.rules);
    assertEquals(Array.isArray(result.rules), true);
    assertEquals(result.metrics, undefined);
});

Deno.test('FilterCompiler.compileWithMetrics - should return rules with metrics when benchmark is true', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const config = createTestConfig();

    const result = await compiler.compileWithMetrics(config, true);

    assertExists(result.rules);
    assertExists(result.metrics);
    assertEquals(typeof result.metrics.totalDurationMs, 'number');
    assertEquals(result.metrics.sourceCount, 1);
    assertEquals(Array.isArray(result.metrics.stages), true);
});

Deno.test('FilterCompiler.compileWithMetrics - should track source and rule counts', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const config = createTestConfig();

    const result = await compiler.compileWithMetrics(config, true);

    assertExists(result.metrics);
    assertEquals(typeof result.metrics.sourceCount, 'number');
    assertEquals(typeof result.metrics.ruleCount, 'number');
    assertEquals(typeof result.metrics.outputRuleCount, 'number');
});

// Test compile convenience function
Deno.test('compile - convenience function should work', async () => {
    const config = createTestConfig();
    const result = await compile(config);

    assertExists(result);
    assertEquals(Array.isArray(result), true);
});

// Test with actual sources
Deno.test('FilterCompiler - should compile from file source', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const config = createTestConfig({
        sources: [
            {
                source: rulesFilePath,
                type: SourceType.Adblock,
            },
        ],
    });

    const result = await compiler.compile(config);

    assertExists(result);
    // Should have header + source header + rules
    assertEquals(result.length > 5, true);
});

// Test with transformations
Deno.test('FilterCompiler - should apply global transformations', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const config = createTestConfig({
        transformations: [
            TransformationType.Deduplicate,
            TransformationType.TrimLines,
        ],
    });

    const result = await compiler.compileWithMetrics(config, true);

    assertExists(result.rules);
    assertExists(result.metrics);
    // Should have transformation stage in metrics
    assertEquals(result.metrics.stages.some((s) => s.name.includes('transformation')), true);
});

// Test parallel source compilation
Deno.test('FilterCompiler - should compile multiple sources', async () => {
    const compiler = new FilterCompiler(silentLogger);

    const config = createTestConfig({
        sources: [
            {
                source: rulesFilePath,
                name: 'Source 1',
                type: SourceType.Adblock,
            },
            {
                source: rulesFilePath,
                name: 'Source 2',
                type: SourceType.Adblock,
            },
        ],
    });

    const result = await compiler.compileWithMetrics(config, true);

    assertExists(result.rules);
    assertExists(result.metrics);
    assertEquals(result.metrics.sourceCount, 2);
    // Should have source headers for both
    assertEquals(result.rules.filter((line) => line.includes('Source name:')).length, 2);
});

// Test source headers
Deno.test('FilterCompiler - should add source header for each source', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const config = createTestConfig({
        sources: [
            {
                source: rulesFilePath,
                name: 'Test Source',
                type: SourceType.Adblock,
            },
        ],
    });

    const result = await compiler.compile(config);

    assertEquals(result.some((line) => line.includes('Source name: Test Source')), true);
    assertEquals(result.some((line) => line.includes('Source:')), true);
});

// Test checksum generation
Deno.test('FilterCompiler - should add checksum to compiled output', async () => {
    const compiler = new FilterCompiler(silentLogger);
    const config = createTestConfig();

    const result = await compiler.compile(config);

    // Should have a checksum line
    assertEquals(result.some((line) => line.startsWith('! Checksum:')), true);

    // Checksum should be in the header section (before source headers)
    const checksumIndex = result.findIndex((line) => line.startsWith('! Checksum:'));
    const firstSourceIndex = result.findIndex((line) => line.includes('Source name:') || line.includes('! Source:'));
    assertEquals(checksumIndex > 0, true);
    // If there's a source header, checksum should be before it
    if (firstSourceIndex > 0) {
        assertEquals(checksumIndex < firstSourceIndex, true);
    }
});
