/**
 * Tests for PluginSystem
 */

import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { DownloaderPlugin, Plugin, PluginContext, PluginManifest, PluginRegistry, TransformationPlugin } from './PluginSystem.ts';
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
