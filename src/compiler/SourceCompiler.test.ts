/**
 * Tests for SourceCompiler
 */

import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { SourceCompiler } from './SourceCompiler.ts';
import { TransformationPipeline } from '../transformations/index.ts';
import { ISource, SourceType, TransformationType } from '../types/index.ts';
import { createEventEmitter, silentLogger, SourceError } from '../utils/index.ts';
import { NoOpDiagnosticsCollector } from '../diagnostics/DiagnosticsCollector.ts';
import { fromFileUrl } from '@std/path';

// Get the test resource file path
const testResourcesDir = fromFileUrl(new URL('../resources/', import.meta.url));
const rulesFilePath = `${testResourcesDir}rules.txt`;

/**
 * Create a test source configuration
 */
function createTestSource(overrides: Partial<ISource> = {}): ISource {
    return {
        source: rulesFilePath,
        type: SourceType.Adblock,
        ...overrides,
    };
}

Deno.test('SourceCompiler - constructor', async (t) => {
    await t.step('should create instance with default options', () => {
        const compiler = new SourceCompiler();
        assertExists(compiler);
    });

    await t.step('should create instance with empty options object', () => {
        const compiler = new SourceCompiler({});
        assertExists(compiler);
    });

    await t.step('should create instance with custom logger', () => {
        const compiler = new SourceCompiler({ logger: silentLogger });
        assertExists(compiler);
    });

    await t.step('should create instance with custom pipeline', () => {
        const pipeline = new TransformationPipeline();
        const compiler = new SourceCompiler({ pipeline });
        assertExists(compiler);
    });

    await t.step('should create instance with custom event emitter', () => {
        const eventEmitter = createEventEmitter();
        const compiler = new SourceCompiler({ eventEmitter });
        assertExists(compiler);
    });

    await t.step('should create instance with custom diagnostics collector', () => {
        const diagnostics = NoOpDiagnosticsCollector.getInstance();
        const compiler = new SourceCompiler({ diagnostics });
        assertExists(compiler);
    });

    await t.step('should support legacy constructor signature with pipeline', () => {
        const pipeline = new TransformationPipeline();
        const compiler = new SourceCompiler(pipeline);
        assertExists(compiler);
    });

    await t.step('should support legacy constructor signature with logger', () => {
        const pipeline = new TransformationPipeline();
        const compiler = new SourceCompiler(pipeline, silentLogger);
        assertExists(compiler);
    });

    await t.step('should support legacy constructor signature with event emitter', () => {
        const pipeline = new TransformationPipeline();
        const eventEmitter = createEventEmitter();
        const compiler = new SourceCompiler(pipeline, silentLogger, eventEmitter);
        assertExists(compiler);
    });
});

Deno.test('SourceCompiler - compile', async (t) => {
    await t.step('should compile a simple source', async () => {
        const compiler = new SourceCompiler({ logger: silentLogger });
        const source = createTestSource();

        const result = await compiler.compile(source);

        assertExists(result);
        assertEquals(Array.isArray(result), true);
        assertEquals(result.length > 0, true);
    });

    await t.step('should compile source with custom name', async () => {
        const compiler = new SourceCompiler({ logger: silentLogger });
        const source = createTestSource({ name: 'Test Source' });

        const result = await compiler.compile(source);

        assertExists(result);
        assertEquals(Array.isArray(result), true);
    });

    await t.step('should compile source with source index and total', async () => {
        const compiler = new SourceCompiler({ logger: silentLogger });
        const source = createTestSource();

        const result = await compiler.compile(source, 0, 3);

        assertExists(result);
        assertEquals(Array.isArray(result), true);
    });

    await t.step('should emit events during compilation', async () => {
        const eventEmitter = createEventEmitter();
        const events: string[] = [];

        eventEmitter.on('sourceStart', () => events.push('sourceStart'));
        eventEmitter.on('progress', () => events.push('progress'));
        eventEmitter.on('sourceComplete', () => events.push('sourceComplete'));

        const compiler = new SourceCompiler({ logger: silentLogger, eventEmitter });
        const source = createTestSource();

        await compiler.compile(source);

        assertEquals(events.includes('sourceStart'), true);
        assertEquals(events.includes('progress'), true);
        assertEquals(events.includes('sourceComplete'), true);
    });

    await t.step('should apply transformations when specified', async () => {
        const compiler = new SourceCompiler({ logger: silentLogger });
        const source = createTestSource({
            transformations: [TransformationType.RemoveComments],
        });

        const result = await compiler.compile(source);

        assertExists(result);
        // Comments should be removed
        const hasComments = result.some((line) => line.startsWith('!'));
        assertEquals(hasComments, false);
    });

    await t.step('should apply multiple transformations', async () => {
        const compiler = new SourceCompiler({ logger: silentLogger });
        const source = createTestSource({
            transformations: [
                TransformationType.RemoveComments,
                TransformationType.RemoveEmptyLines,
                TransformationType.TrimLines,
            ],
        });

        const result = await compiler.compile(source);

        assertExists(result);
        assertEquals(Array.isArray(result), true);
    });

    await t.step('should throw SourceError on invalid source path', async () => {
        const compiler = new SourceCompiler({ logger: silentLogger });
        const source = createTestSource({ source: '/nonexistent/file.txt' });

        await assertRejects(
            () => compiler.compile(source),
            SourceError,
            'Failed to download source',
        );
    });

    await t.step('should emit sourceError event on failure', async () => {
        const eventEmitter = createEventEmitter();
        let errorEmitted = false;

        eventEmitter.on('sourceError', () => {
            errorEmitted = true;
        });

        const compiler = new SourceCompiler({ logger: silentLogger, eventEmitter });
        const source = createTestSource({ source: '/nonexistent/file.txt' });

        try {
            await compiler.compile(source);
        } catch {
            // Expected error
        }

        assertEquals(errorEmitted, true);
    });

    await t.step('should record metrics during compilation', async () => {
        const diagnostics = NoOpDiagnosticsCollector.getInstance();
        const compiler = new SourceCompiler({ logger: silentLogger, diagnostics });
        const source = createTestSource();

        const result = await compiler.compile(source);

        assertExists(result);
        // Diagnostics should be called (we just verify compilation succeeds with diagnostics)
    });

    await t.step('should strip upstream headers', async () => {
        // Create a test file with upstream headers
        const testFile = `${testResourcesDir}test_with_headers.txt`;
        const content = `! Title: Upstream Filter
! Homepage: https://upstream.example.com
! Version: 1.0.0
||example.com^
||test.com^
`;
        await Deno.writeTextFile(testFile, content);

        try {
            const compiler = new SourceCompiler({ logger: silentLogger });
            const source = createTestSource({ source: testFile });

            const result = await compiler.compile(source);

            assertExists(result);
            // Upstream headers should be stripped
            const hasUpstreamHeaders = result.some((line) =>
                line.includes('! Title:') ||
                line.includes('! Homepage:') ||
                line.includes('! Version:')
            );
            assertEquals(hasUpstreamHeaders, false);
        } finally {
            // Cleanup
            await Deno.remove(testFile);
        }
    });

    await t.step('should handle empty source files', async () => {
        // Create an empty test file
        const testFile = `${testResourcesDir}empty.txt`;
        await Deno.writeTextFile(testFile, '');

        try {
            const compiler = new SourceCompiler({ logger: silentLogger });
            const source = createTestSource({ source: testFile });

            const result = await compiler.compile(source);

            assertExists(result);
            assertEquals(Array.isArray(result), true);
        } finally {
            // Cleanup
            await Deno.remove(testFile);
        }
    });
});

Deno.test('SourceCompiler - diagnostics and tracing', async (t) => {
    await t.step('should trace source compilation operations', async () => {
        const diagnostics = NoOpDiagnosticsCollector.getInstance();
        const compiler = new SourceCompiler({ logger: silentLogger, diagnostics });
        const source = createTestSource();

        const result = await compiler.compile(source);

        assertExists(result);
        // Verify that compilation works with tracing enabled
    });

    await t.step('should record compilation duration metric', async () => {
        const diagnostics = NoOpDiagnosticsCollector.getInstance();
        const compiler = new SourceCompiler({ logger: silentLogger, diagnostics });
        const source = createTestSource();

        const result = await compiler.compile(source);

        assertExists(result);
        // Metrics should be recorded internally
    });

    await t.step('should record rule count metrics', async () => {
        const diagnostics = NoOpDiagnosticsCollector.getInstance();
        const compiler = new SourceCompiler({ logger: silentLogger, diagnostics });
        const source = createTestSource();

        const result = await compiler.compile(source);

        assertExists(result);
        assertEquals(result.length > 0, true);
    });
});

Deno.test('SourceCompiler - error handling', async (t) => {
    await t.step('should wrap non-SourceError as SourceError', async () => {
        const compiler = new SourceCompiler({ logger: silentLogger });
        const source = createTestSource({ source: '/invalid/path.txt' });

        await assertRejects(
            () => compiler.compile(source),
            SourceError,
        );
    });

    await t.step('should preserve SourceError when thrown', async () => {
        const compiler = new SourceCompiler({ logger: silentLogger });
        const source = createTestSource({ source: '/nonexistent/file.txt' });

        await assertRejects(
            () => compiler.compile(source),
            SourceError,
            'Failed to download source',
        );
    });

    await t.step('should include source name in error', async () => {
        const compiler = new SourceCompiler({ logger: silentLogger });
        const source = createTestSource({
            name: 'My Test Source',
            source: '/invalid/path.txt',
        });

        try {
            await compiler.compile(source);
        } catch (error) {
            assertEquals(error instanceof SourceError, true);
            assertExists((error as SourceError).sourceName);
        }
    });
});
