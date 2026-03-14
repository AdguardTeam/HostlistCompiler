/**
 * Tests for PluginSystem
 */

import { assertEquals, assertExists, assertRejects } from '@std/assert';
import {
    CacheBackendPlugin,
    ConflictResolverPlugin,
    DiffReporterPlugin,
    DownloaderPlugin,
    EventHookPlugin,
    FormatterPlugin,
    HeaderGeneratorPlugin,
    ParsedNode,
    ParserPlugin,
    Plugin,
    PluginContext,
    PluginManifest,
    PluginRegistry,
    TransformationPlugin,
    ValidationPlugin,
} from './PluginSystem.ts';
import { silentLogger } from '../utils/index.ts';

// Test data
const createTestManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    ...overrides,
});

const createTestTransformation = (overrides: Partial<TransformationPlugin> = {}): TransformationPlugin => ({
    type: 'test-transform',
    name: 'Test Transformation',
    execute: (rules) => rules.map((r) => r.toUpperCase()),
    ...overrides,
});

const createTestDownloader = (overrides: Partial<DownloaderPlugin> = {}): DownloaderPlugin => ({
    schemes: ['test://'],
    download: async (_source: string) => ['||example.com^'],
    ...overrides,
});

Deno.test('PluginRegistry - constructor', () => {
    const registry = new PluginRegistry();
    assertExists(registry);
});

Deno.test('PluginRegistry - register', async (t) => {
    await t.step('should register a plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
        };

        await registry.register(plugin);

        const plugins = registry.getPlugins();
        assertEquals(plugins.length, 1);
        assertEquals(plugins[0].manifest.name, 'test-plugin');
    });

    await t.step('should register plugin with transformations', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            transformations: [createTestTransformation()],
        };

        await registry.register(plugin);

        const transformation = registry.getTransformation('test-transform');
        assertExists(transformation);
    });

    await t.step('should register plugin with downloaders', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [createTestDownloader()],
        };

        await registry.register(plugin);

        const downloader = registry.getDownloader('test://example.com');
        assertExists(downloader);
    });

    await t.step('should call plugin init function', async () => {
        const registry = new PluginRegistry(silentLogger);

        let initCalled = false;
        const plugin: Plugin = {
            manifest: createTestManifest(),
            init: () => {
                initCalled = true;
            },
        };

        await registry.register(plugin);

        assertEquals(initCalled, true);
    });

    await t.step('should throw error for duplicate plugin names', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin1: Plugin = {
            manifest: createTestManifest({ name: 'duplicate' }),
        };

        const plugin2: Plugin = {
            manifest: createTestManifest({ name: 'duplicate' }),
        };

        await registry.register(plugin1);

        await assertRejects(
            () => registry.register(plugin2),
            Error,
            'already registered',
        );
    });

    await t.step('should throw error for duplicate transformation types', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin1: Plugin = {
            manifest: createTestManifest({ name: 'plugin1' }),
            transformations: [createTestTransformation({ type: 'duplicate-transform' })],
        };

        const plugin2: Plugin = {
            manifest: createTestManifest({ name: 'plugin2' }),
            transformations: [createTestTransformation({ type: 'duplicate-transform' })],
        };

        await registry.register(plugin1);

        await assertRejects(
            () => registry.register(plugin2),
            Error,
            'already registered',
        );
    });

    await t.step('should throw error for duplicate downloader schemes', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin1: Plugin = {
            manifest: createTestManifest({ name: 'plugin1' }),
            downloaders: [createTestDownloader({ schemes: ['s3://'] })],
        };

        const plugin2: Plugin = {
            manifest: createTestManifest({ name: 'plugin2' }),
            downloaders: [createTestDownloader({ schemes: ['s3://'] })],
        };

        await registry.register(plugin1);

        await assertRejects(
            () => registry.register(plugin2),
            Error,
            'already registered',
        );
    });
});

Deno.test('PluginRegistry - unregister', async (t) => {
    await t.step('should unregister a plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest({ name: 'to-remove' }),
        };

        await registry.register(plugin);
        await registry.unregister('to-remove');

        const plugins = registry.getPlugins();
        assertEquals(plugins.length, 0);
    });

    await t.step('should call plugin cleanup function', async () => {
        const registry = new PluginRegistry(silentLogger);

        let cleanupCalled = false;
        const plugin: Plugin = {
            manifest: createTestManifest(),
            cleanup: () => {
                cleanupCalled = true;
            },
        };

        await registry.register(plugin);
        await registry.unregister('test-plugin');

        assertEquals(cleanupCalled, true);
    });

    await t.step('should remove plugin transformations', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            transformations: [createTestTransformation()],
        };

        await registry.register(plugin);
        await registry.unregister('test-plugin');

        const transformation = registry.getTransformation('test-transform');
        assertEquals(transformation, undefined);
    });

    await t.step('should remove plugin downloaders', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [createTestDownloader()],
        };

        await registry.register(plugin);
        await registry.unregister('test-plugin');

        const downloader = registry.getDownloader('test://example.com');
        assertEquals(downloader, undefined);
    });

    await t.step('should not throw for non-existent plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        // Should not throw
        await registry.unregister('nonexistent');
    });
});

Deno.test('PluginRegistry - getPlugin', async (t) => {
    await t.step('should get registered plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest({ name: 'my-plugin' }),
        };

        await registry.register(plugin);

        const retrieved = registry.getPlugin('my-plugin');
        assertEquals(retrieved?.manifest.name, 'my-plugin');
    });

    await t.step('should return undefined for non-existent plugin', () => {
        const registry = new PluginRegistry(silentLogger);

        const retrieved = registry.getPlugin('nonexistent');
        assertEquals(retrieved, undefined);
    });
});

Deno.test('PluginRegistry - getPlugins', async (t) => {
    await t.step('should return all registered plugins', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({ manifest: createTestManifest({ name: 'plugin1' }) });
        await registry.register({ manifest: createTestManifest({ name: 'plugin2' }) });
        await registry.register({ manifest: createTestManifest({ name: 'plugin3' }) });

        const plugins = registry.getPlugins();
        assertEquals(plugins.length, 3);
    });

    await t.step('should return empty array when no plugins', () => {
        const registry = new PluginRegistry(silentLogger);

        const plugins = registry.getPlugins();
        assertEquals(plugins.length, 0);
    });
});

Deno.test('PluginRegistry - getTransformation', async (t) => {
    await t.step('should get transformation by type', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            transformations: [
                createTestTransformation({ type: 'my-transform', name: 'My Transformation' }),
            ],
        };

        await registry.register(plugin);

        const transformation = registry.getTransformation('my-transform');
        assertEquals(transformation?.name, 'My Transformation');
    });

    await t.step('should return undefined for non-existent transformation', () => {
        const registry = new PluginRegistry(silentLogger);

        const transformation = registry.getTransformation('nonexistent');
        assertEquals(transformation, undefined);
    });
});

Deno.test('PluginRegistry - getDownloader', async (t) => {
    await t.step('should get downloader by URL scheme', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [createTestDownloader({ schemes: ['s3://'] })],
        };

        await registry.register(plugin);

        const downloader = registry.getDownloader('s3://bucket/file.txt');
        assertExists(downloader);
    });

    await t.step('should return undefined for non-matching scheme', () => {
        const registry = new PluginRegistry(silentLogger);

        const downloader = registry.getDownloader('http://example.com');
        assertEquals(downloader, undefined);
    });

    await t.step('should match longest scheme prefix', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [
                createTestDownloader({ schemes: ['s3://'] }),
                createTestDownloader({ schemes: ['s3://special/'] }),
            ],
        };

        await registry.register(plugin);

        const downloader1 = registry.getDownloader('s3://bucket/file.txt');
        const downloader2 = registry.getDownloader('s3://special/file.txt');

        assertExists(downloader1);
        assertExists(downloader2);
    });
});

Deno.test('PluginRegistry - hasTransformation', async (t) => {
    await t.step('should return true for registered transformation', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            transformations: [createTestTransformation({ type: 'my-transform' })],
        };

        await registry.register(plugin);

        assertEquals(registry.hasTransformation('my-transform'), true);
    });

    await t.step('should return false for non-existent transformation', () => {
        const registry = new PluginRegistry(silentLogger);

        assertEquals(registry.hasTransformation('nonexistent'), false);
    });
});

Deno.test('PluginRegistry - plugin lifecycle', async (t) => {
    await t.step('should handle async init function', async () => {
        const registry = new PluginRegistry(silentLogger);

        let initComplete = false;
        const plugin: Plugin = {
            manifest: createTestManifest(),
            init: async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                initComplete = true;
            },
        };

        await registry.register(plugin);

        assertEquals(initComplete, true);
    });

    await t.step('should handle async cleanup function', async () => {
        const registry = new PluginRegistry(silentLogger);

        let cleanupComplete = false;
        const plugin: Plugin = {
            manifest: createTestManifest(),
            cleanup: async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                cleanupComplete = true;
            },
        };

        await registry.register(plugin);
        await registry.unregister('test-plugin');

        assertEquals(cleanupComplete, true);
    });

    await t.step('should provide context to init function', async () => {
        const registry = new PluginRegistry(silentLogger);

        let receivedContext: PluginContext | undefined;
        const plugin: Plugin = {
            manifest: createTestManifest(),
            init: (context) => {
                receivedContext = context;
            },
        };

        await registry.register(plugin);

        assertExists(receivedContext);
        assertEquals(receivedContext.registry, registry);
        assertExists(receivedContext.logger);
        assertExists(receivedContext.compilerVersion);
    });
});

Deno.test('PluginRegistry - edge cases', async (t) => {
    await t.step('should handle plugin with no transformations or downloaders', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
        };

        await registry.register(plugin);

        const plugins = registry.getPlugins();
        assertEquals(plugins.length, 1);
    });

    await t.step('should handle multiple transformations from same plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            transformations: [
                createTestTransformation({ type: 'transform1' }),
                createTestTransformation({ type: 'transform2' }),
                createTestTransformation({ type: 'transform3' }),
            ],
        };

        await registry.register(plugin);

        assertEquals(registry.hasTransformation('transform1'), true);
        assertEquals(registry.hasTransformation('transform2'), true);
        assertEquals(registry.hasTransformation('transform3'), true);
    });

    await t.step('should handle multiple downloaders from same plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [
                createTestDownloader({ schemes: ['s3://'] }),
                createTestDownloader({ schemes: ['gcs://'] }),
                createTestDownloader({ schemes: ['azure://'] }),
            ],
        };

        await registry.register(plugin);

        assertExists(registry.getDownloader('s3://bucket/file'));
        assertExists(registry.getDownloader('gcs://bucket/file'));
        assertExists(registry.getDownloader('azure://container/file'));
    });

    await t.step('should handle downloader with multiple schemes', async () => {
        const registry = new PluginRegistry(silentLogger);

        const downloader = createTestDownloader({ schemes: ['s3://', 'gcs://', 'azure://'] });

        const plugin: Plugin = {
            manifest: createTestManifest(),
            downloaders: [downloader],
        };

        await registry.register(plugin);

        assertEquals(registry.getDownloader('s3://file'), downloader);
        assertEquals(registry.getDownloader('gcs://file'), downloader);
        assertEquals(registry.getDownloader('azure://file'), downloader);
    });
});

// ── Helper factories for new plugin types ──────────────────────────

const createTestFormatterPlugin = (overrides: Partial<FormatterPlugin> = {}): FormatterPlugin => ({
    format: 'test-format',
    formatterClass: class {
        format(_rules: string[]): string {
            return _rules.join('\n');
        }
    } as unknown as FormatterPlugin['formatterClass'],
    description: 'A test formatter',
    ...overrides,
});

const createTestValidationPlugin = (overrides: Partial<ValidationPlugin> = {}): ValidationPlugin => ({
    name: 'test-validator',
    description: 'A test validator',
    validate: (_config) => ({ valid: true, errorsText: null }),
    ...overrides,
});

const createTestParserPlugin = (overrides: Partial<ParserPlugin> = {}): ParserPlugin => ({
    name: 'test-parser',
    description: 'A test parser',
    supportedSyntaxes: ['adblock', 'hosts'],
    parse: (input) => ({ type: 'Rule', raw: input }),
    serialize: (node) => (node as ParsedNode & { raw: string }).raw ?? '',
    walk: (node, visitor) => {
        const nodes = Array.isArray(node) ? node : [node];
        for (const n of nodes) visitor(n);
    },
    ...overrides,
});

const createTestDiffReporterPlugin = (overrides: Partial<DiffReporterPlugin> = {}): DiffReporterPlugin => ({
    name: 'test-reporter',
    description: 'A test reporter',
    format: (report) => `Added: ${report.summary.addedCount}, Removed: ${report.summary.removedCount}`,
    ...overrides,
});

const createTestCacheBackendPlugin = (overrides: Partial<CacheBackendPlugin> = {}): CacheBackendPlugin => ({
    name: 'test-cache',
    description: 'A test cache backend',
    createAdapter: () => ({
        open: async () => {},
        close: async () => {},
        isOpen: () => true,
        get: async () => null,
        set: async () => true,
        delete: async () => true,
        list: async () => [],
        has: async () => false,
        clear: async () => {},
        getStats: async () => ({ totalEntries: 0, totalSize: 0, oldestEntry: null, newestEntry: null }),
        getCacheEntry: async () => null,
        setCacheEntry: async () => true,
        getMetadata: async () => null,
        setMetadata: async () => true,
    } as unknown as ReturnType<CacheBackendPlugin['createAdapter']>),
    ...overrides,
});

const createTestHeaderGeneratorPlugin = (overrides: Partial<HeaderGeneratorPlugin> = {}): HeaderGeneratorPlugin => ({
    name: 'test-header-gen',
    description: 'A test header generator',
    generate: (_config, _options) => ['! X-Plugin: test-header-gen'],
    ...overrides,
});

const createTestConflictResolverPlugin = (overrides: Partial<ConflictResolverPlugin> = {}): ConflictResolverPlugin => ({
    name: 'test-resolver',
    description: 'A test conflict resolver',
    resolve: (conflicts, _options) => ({
        conflicts,
        rulesAnalyzed: 0,
        blockingRules: 0,
        exceptionRules: 0,
    }),
    ...overrides,
});

const createTestEventHookPlugin = (overrides: Partial<EventHookPlugin> = {}): EventHookPlugin => ({
    name: 'test-event-hooks',
    description: 'A test event hook plugin',
    hooks: {
        onCompilationStart: () => {},
        onCompilationComplete: () => {},
    },
    ...overrides,
});

// ── Formatter Plugin Tests ─────────────────────────────────────────

Deno.test('PluginRegistry - FormatterPlugin', async (t) => {
    await t.step('should register and retrieve a formatter plugin', async () => {
        const registry = new PluginRegistry(silentLogger);
        const formatter = createTestFormatterPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'fmt-plugin' }),
            formatters: [formatter],
        });

        assertEquals(registry.getFormatter('test-format'), formatter);
        assertEquals(registry.listFormatters(), ['test-format']);
    });

    await t.step('should reject duplicate formatter format', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'fmt-a' }),
            formatters: [createTestFormatterPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'fmt-b' }),
                    formatters: [createTestFormatterPlugin()],
                }),
            Error,
            'Formatter for format "test-format" is already registered',
        );
    });

    await t.step('should unregister formatter when plugin is removed', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'fmt-plugin' }),
            formatters: [createTestFormatterPlugin()],
        });

        assertEquals(registry.getFormatter('test-format') !== undefined, true);

        await registry.unregister('fmt-plugin');
        assertEquals(registry.getFormatter('test-format'), undefined);
        assertEquals(registry.listFormatters().length, 0);
    });

    await t.step('should support multiple formatters per plugin', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'multi-fmt' }),
            formatters: [
                createTestFormatterPlugin({ format: 'rpz' }),
                createTestFormatterPlugin({ format: 'bind' }),
            ],
        });

        assertExists(registry.getFormatter('rpz'));
        assertExists(registry.getFormatter('bind'));
        assertEquals(registry.listFormatters().length, 2);
    });
});

// ── Validation Plugin Tests ────────────────────────────────────────

Deno.test('PluginRegistry - ValidationPlugin', async (t) => {
    await t.step('should register and retrieve validators', async () => {
        const registry = new PluginRegistry(silentLogger);
        const validator = createTestValidationPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'val-plugin' }),
            validators: [validator],
        });

        assertEquals(registry.getValidator('test-validator'), validator);
        assertEquals(registry.getValidators().length, 1);
    });

    await t.step('should reject duplicate validator name', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'val-a' }),
            validators: [createTestValidationPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'val-b' }),
                    validators: [createTestValidationPlugin()],
                }),
            Error,
            'Validator "test-validator" is already registered',
        );
    });

    await t.step('should unregister validators', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'val-plugin' }),
            validators: [createTestValidationPlugin()],
        });

        await registry.unregister('val-plugin');
        assertEquals(registry.getValidator('test-validator'), undefined);
        assertEquals(registry.getValidators().length, 0);
    });

    await t.step('should execute validator logic', async () => {
        const validator = createTestValidationPlugin({
            validate: (config) => ({
                valid: config.sources.length > 0,
                errorsText: config.sources.length === 0 ? 'No sources' : null,
            }),
        });

        const result = validator.validate({
            name: 'test',
            sources: [],
        });

        assertEquals(result, { valid: false, errorsText: 'No sources' });
    });
});

// ── Parser Plugin Tests ────────────────────────────────────────────

Deno.test('PluginRegistry - ParserPlugin', async (t) => {
    await t.step('should register and retrieve a parser', async () => {
        const registry = new PluginRegistry(silentLogger);
        const parser = createTestParserPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'parser-plugin' }),
            parsers: [parser],
        });

        assertEquals(registry.getParser('test-parser'), parser);
        assertEquals(registry.listParsers(), ['test-parser']);
    });

    await t.step('should find parsers by syntax', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'parser-plugin' }),
            parsers: [
                createTestParserPlugin({ name: 'p1', supportedSyntaxes: ['adblock'] }),
                createTestParserPlugin({ name: 'p2', supportedSyntaxes: ['hosts'] }),
                createTestParserPlugin({ name: 'p3', supportedSyntaxes: ['adblock', 'ublock'] }),
            ],
        });

        const adblockParsers = registry.getParsersForSyntax('adblock');
        assertEquals(adblockParsers.length, 2);

        const hostsParsers = registry.getParsersForSyntax('hosts');
        assertEquals(hostsParsers.length, 1);

        const noneParsers = registry.getParsersForSyntax('unknown');
        assertEquals(noneParsers.length, 0);
    });

    await t.step('should reject duplicate parser name', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'pa' }),
            parsers: [createTestParserPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'pb' }),
                    parsers: [createTestParserPlugin()],
                }),
            Error,
            'Parser "test-parser" is already registered',
        );
    });

    await t.step('should unregister parsers', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'parser-plugin' }),
            parsers: [createTestParserPlugin()],
        });

        await registry.unregister('parser-plugin');
        assertEquals(registry.getParser('test-parser'), undefined);
    });

    await t.step('should execute parse/serialize/walk', () => {
        const parser = createTestParserPlugin();
        const node = parser.parse('||example.com^') as ParsedNode;
        assertEquals(node.type, 'Rule');
        assertEquals(node.raw, '||example.com^');

        const serialized = parser.serialize!(node);
        assertEquals(serialized, '||example.com^');

        const visited: ParsedNode[] = [];
        parser.walk!(node, (n) => {
            visited.push(n);
        });
        assertEquals(visited.length, 1);
    });
});

// ── Diff Reporter Plugin Tests ─────────────────────────────────────

Deno.test('PluginRegistry - DiffReporterPlugin', async (t) => {
    await t.step('should register and retrieve a diff reporter', async () => {
        const registry = new PluginRegistry(silentLogger);
        const reporter = createTestDiffReporterPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'diff-plugin' }),
            diffReporters: [reporter],
        });

        assertEquals(registry.getDiffReporter('test-reporter'), reporter);
        assertEquals(registry.listDiffReporters(), ['test-reporter']);
    });

    await t.step('should reject duplicate diff reporter name', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'da' }),
            diffReporters: [createTestDiffReporterPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'db' }),
                    diffReporters: [createTestDiffReporterPlugin()],
                }),
            Error,
            'Diff reporter "test-reporter" is already registered',
        );
    });

    await t.step('should unregister diff reporters', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'diff-plugin' }),
            diffReporters: [createTestDiffReporterPlugin()],
        });

        await registry.unregister('diff-plugin');
        assertEquals(registry.getDiffReporter('test-reporter'), undefined);
    });
});

// ── Cache Backend Plugin Tests ─────────────────────────────────────

Deno.test('PluginRegistry - CacheBackendPlugin', async (t) => {
    await t.step('should register and retrieve a cache backend', async () => {
        const registry = new PluginRegistry(silentLogger);
        const cache = createTestCacheBackendPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'cache-plugin' }),
            cacheBackends: [cache],
        });

        assertEquals(registry.getCacheBackend('test-cache'), cache);
        assertEquals(registry.listCacheBackends(), ['test-cache']);
    });

    await t.step('should reject duplicate cache backend name', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'ca' }),
            cacheBackends: [createTestCacheBackendPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'cb' }),
                    cacheBackends: [createTestCacheBackendPlugin()],
                }),
            Error,
            'Cache backend "test-cache" is already registered',
        );
    });

    await t.step('should unregister cache backends', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'cache-plugin' }),
            cacheBackends: [createTestCacheBackendPlugin()],
        });

        await registry.unregister('cache-plugin');
        assertEquals(registry.getCacheBackend('test-cache'), undefined);
    });

    await t.step('should create adapter via factory', () => {
        const cache = createTestCacheBackendPlugin();
        const adapter = cache.createAdapter();
        assertEquals(adapter.isOpen(), true);
    });
});

// ── Header Generator Plugin Tests ──────────────────────────────────

Deno.test('PluginRegistry - HeaderGeneratorPlugin', async (t) => {
    await t.step('should register and retrieve header generators', async () => {
        const registry = new PluginRegistry(silentLogger);
        const gen = createTestHeaderGeneratorPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'header-plugin' }),
            headerGenerators: [gen],
        });

        assertEquals(registry.getHeaderGenerator('test-header-gen'), gen);
        assertEquals(registry.getHeaderGenerators().length, 1);
    });

    await t.step('should reject duplicate header generator', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'ha' }),
            headerGenerators: [createTestHeaderGeneratorPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'hb' }),
                    headerGenerators: [createTestHeaderGeneratorPlugin()],
                }),
            Error,
            'Header generator "test-header-gen" is already registered',
        );
    });

    await t.step('should unregister header generators', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'header-plugin' }),
            headerGenerators: [createTestHeaderGeneratorPlugin()],
        });

        await registry.unregister('header-plugin');
        assertEquals(registry.getHeaderGenerator('test-header-gen'), undefined);
    });

    await t.step('should generate header lines', () => {
        const gen = createTestHeaderGeneratorPlugin();
        const lines = gen.generate({ name: 'test', sources: [] });
        assertEquals(lines, ['! X-Plugin: test-header-gen']);
    });
});

// ── Conflict Resolver Plugin Tests ─────────────────────────────────

Deno.test('PluginRegistry - ConflictResolverPlugin', async (t) => {
    await t.step('should register and retrieve conflict resolvers', async () => {
        const registry = new PluginRegistry(silentLogger);
        const resolver = createTestConflictResolverPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'resolver-plugin' }),
            conflictResolvers: [resolver],
        });

        assertEquals(registry.getConflictResolver('test-resolver'), resolver);
        assertEquals(registry.listConflictResolvers(), ['test-resolver']);
    });

    await t.step('should reject duplicate conflict resolver', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'ra' }),
            conflictResolvers: [createTestConflictResolverPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'rb' }),
                    conflictResolvers: [createTestConflictResolverPlugin()],
                }),
            Error,
            'Conflict resolver "test-resolver" is already registered',
        );
    });

    await t.step('should unregister conflict resolvers', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'resolver-plugin' }),
            conflictResolvers: [createTestConflictResolverPlugin()],
        });

        await registry.unregister('resolver-plugin');
        assertEquals(registry.getConflictResolver('test-resolver'), undefined);
    });
});

// ── Event Hook Plugin Tests ────────────────────────────────────────

Deno.test('PluginRegistry - EventHookPlugin', async (t) => {
    await t.step('should register and retrieve event hooks', async () => {
        const registry = new PluginRegistry(silentLogger);
        const hooks = createTestEventHookPlugin();

        await registry.register({
            manifest: createTestManifest({ name: 'hook-plugin' }),
            eventHooks: [hooks],
        });

        assertEquals(registry.getEventHook('test-event-hooks'), hooks);
        assertEquals(registry.getEventHooks().length, 1);
    });

    await t.step('should reject duplicate event hook name', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'ea' }),
            eventHooks: [createTestEventHookPlugin()],
        });

        await assertRejects(
            () =>
                registry.register({
                    manifest: createTestManifest({ name: 'eb' }),
                    eventHooks: [createTestEventHookPlugin()],
                }),
            Error,
            'Event hook "test-event-hooks" is already registered',
        );
    });

    await t.step('should unregister event hooks', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'hook-plugin' }),
            eventHooks: [createTestEventHookPlugin()],
        });

        await registry.unregister('hook-plugin');
        assertEquals(registry.getEventHook('test-event-hooks'), undefined);
    });
});

// ── Multi-Slot Plugin Tests ────────────────────────────────────────

Deno.test('PluginRegistry - multi-slot plugin', async (t) => {
    await t.step('should register a plugin with all slot types', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest({ name: 'mega-plugin' }),
            transformations: [createTestTransformation()],
            downloaders: [createTestDownloader()],
            formatters: [createTestFormatterPlugin()],
            validators: [createTestValidationPlugin()],
            parsers: [createTestParserPlugin()],
            diffReporters: [createTestDiffReporterPlugin()],
            cacheBackends: [createTestCacheBackendPlugin()],
            headerGenerators: [createTestHeaderGeneratorPlugin()],
            conflictResolvers: [createTestConflictResolverPlugin()],
            eventHooks: [createTestEventHookPlugin()],
        };

        await registry.register(plugin);

        // Verify every slot is populated
        assertExists(registry.getTransformation('test-transform'));
        assertExists(registry.getDownloader('test://foo'));
        assertExists(registry.getFormatter('test-format'));
        assertExists(registry.getValidator('test-validator'));
        assertExists(registry.getParser('test-parser'));
        assertExists(registry.getDiffReporter('test-reporter'));
        assertExists(registry.getCacheBackend('test-cache'));
        assertExists(registry.getHeaderGenerator('test-header-gen'));
        assertExists(registry.getConflictResolver('test-resolver'));
        assertExists(registry.getEventHook('test-event-hooks'));
    });

    await t.step('should clean up all slots on unregister', async () => {
        const registry = new PluginRegistry(silentLogger);

        const plugin: Plugin = {
            manifest: createTestManifest({ name: 'mega-plugin' }),
            transformations: [createTestTransformation()],
            downloaders: [createTestDownloader()],
            formatters: [createTestFormatterPlugin()],
            validators: [createTestValidationPlugin()],
            parsers: [createTestParserPlugin()],
            diffReporters: [createTestDiffReporterPlugin()],
            cacheBackends: [createTestCacheBackendPlugin()],
            headerGenerators: [createTestHeaderGeneratorPlugin()],
            conflictResolvers: [createTestConflictResolverPlugin()],
            eventHooks: [createTestEventHookPlugin()],
        };

        await registry.register(plugin);
        await registry.unregister('mega-plugin');

        assertEquals(registry.getTransformation('test-transform'), undefined);
        assertEquals(registry.getDownloader('test://foo'), undefined);
        assertEquals(registry.getFormatter('test-format'), undefined);
        assertEquals(registry.getValidator('test-validator'), undefined);
        assertEquals(registry.getParser('test-parser'), undefined);
        assertEquals(registry.getDiffReporter('test-reporter'), undefined);
        assertEquals(registry.getCacheBackend('test-cache'), undefined);
        assertEquals(registry.getHeaderGenerator('test-header-gen'), undefined);
        assertEquals(registry.getConflictResolver('test-resolver'), undefined);
        assertEquals(registry.getEventHook('test-event-hooks'), undefined);
        assertEquals(registry.size, 0);
    });

    await t.step('should handle clear() with all slot types', async () => {
        const registry = new PluginRegistry(silentLogger);

        await registry.register({
            manifest: createTestManifest({ name: 'p1' }),
            formatters: [createTestFormatterPlugin({ format: 'fmt-a' })],
        });

        await registry.register({
            manifest: createTestManifest({ name: 'p2' }),
            parsers: [createTestParserPlugin({ name: 'parser-b' })],
        });

        assertEquals(registry.size, 2);
        await registry.clear();
        assertEquals(registry.size, 0);
        assertEquals(registry.listFormatters().length, 0);
        assertEquals(registry.listParsers().length, 0);
    });
});

// ── Plugin Manifest Dependencies ───────────────────────────────────

Deno.test('PluginManifest - dependencies field', async () => {
    const registry = new PluginRegistry(silentLogger);

    const plugin: Plugin = {
        manifest: createTestManifest({
            name: 'dependent-plugin',
            dependencies: ['core-plugin', 'parser-plugin'],
        }),
    };

    await registry.register(plugin);

    const retrieved = registry.getPlugin('dependent-plugin');
    assertExists(retrieved);
    assertEquals(retrieved.manifest.dependencies, ['core-plugin', 'parser-plugin']);
});
