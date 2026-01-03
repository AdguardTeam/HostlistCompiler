import { assertEquals, assertRejects, assertExists } from '@std/assert';
import { ConfigurationLoader } from './ConfigurationLoader.ts';
import type { IFileSystem, IConfiguration } from '../types/index.ts';

// Mock file system
class MockFileSystem implements IFileSystem {
    private files: Map<string, string> = new Map();

    setFile(path: string, content: string) {
        this.files.set(path, content);
    }

    async readTextFile(path: string): Promise<string> {
        const content = this.files.get(path);
        if (content === undefined) {
            const error = new Error(`File not found: ${path}`);
            (error as any).name = 'NotFound';
            throw error;
        }
        return content;
    }

    async writeTextFile(_path: string, _content: string): Promise<void> {
        // Not needed for tests
    }

    async exists(path: string): Promise<boolean> {
        return this.files.has(path);
    }
}

Deno.test('ConfigurationLoader - should load valid configuration from file', async () => {
    const mockFs = new MockFileSystem();
    const config = {
        name: 'Test List',
        sources: [
            { source: 'https://example.com/list.txt' },
        ],
    };
    mockFs.setFile('/config.json', JSON.stringify(config));

    const loader = new ConfigurationLoader(mockFs);
    const loaded = await loader.loadFromFile('/config.json');

    assertEquals(loaded.name, 'Test List');
    assertEquals(loaded.sources.length, 1);
    assertEquals(loaded.sources[0].source, 'https://example.com/list.txt');
});

Deno.test('ConfigurationLoader - should throw on missing file', async () => {
    const mockFs = new MockFileSystem();
    const loader = new ConfigurationLoader(mockFs);

    await assertRejects(
        async () => await loader.loadFromFile('/nonexistent.json'),
        Error,
        'Failed to load configuration: File not found',
    );
});

Deno.test('ConfigurationLoader - should throw on invalid JSON', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setFile('/invalid.json', '{ invalid json }');

    const loader = new ConfigurationLoader(mockFs);

    await assertRejects(
        async () => await loader.loadFromFile('/invalid.json'),
        Error,
        'Invalid JSON',
    );
});

Deno.test('ConfigurationLoader - should create configuration from inputs with hosts type', () => {
    const loader = new ConfigurationLoader();
    const inputs = ['https://example.com/hosts.txt', '/local/hosts.txt'];

    const config = loader.createFromInputs(inputs, 'hosts');

    assertEquals(config.name, 'Blocklist');
    assertEquals(config.sources.length, 2);
    assertEquals(config.sources[0].source, 'https://example.com/hosts.txt');
    assertEquals(config.sources[0].type, 'hosts');
    assertEquals(config.sources[1].source, '/local/hosts.txt');
    assertEquals(config.sources[1].type, 'hosts');
    assertExists(config.transformations);
});

Deno.test('ConfigurationLoader - should create configuration from inputs with adblock type', () => {
    const loader = new ConfigurationLoader();
    const inputs = ['https://example.com/filter.txt'];

    const config = loader.createFromInputs(inputs, 'adblock');

    assertEquals(config.sources.length, 1);
    assertEquals(config.sources[0].type, 'adblock');
});

Deno.test('ConfigurationLoader - should default to hosts type', () => {
    const loader = new ConfigurationLoader();
    const inputs = ['https://example.com/list.txt'];

    const config = loader.createFromInputs(inputs);

    assertEquals(config.sources[0].type, 'hosts');
});

Deno.test('ConfigurationLoader - should include default transformations', () => {
    const loader = new ConfigurationLoader();
    const inputs = ['https://example.com/list.txt'];

    const config = loader.createFromInputs(inputs);

    assertExists(config.transformations);
    assertEquals(Array.isArray(config.transformations), true);
    assertEquals((config.transformations as string[]).includes('RemoveComments'), true);
    assertEquals((config.transformations as string[]).includes('Deduplicate'), true);
    assertEquals((config.transformations as string[]).includes('Validate'), true);
});

Deno.test('ConfigurationLoader - should validate configuration with valid structure', () => {
    const loader = new ConfigurationLoader();
    const config: IConfiguration = {
        name: 'Test List',
        sources: [
            { source: 'https://example.com/list.txt' },
        ],
    };

    const error = loader.validateBasicStructure(config);
    assertEquals(error, null);
});

Deno.test('ConfigurationLoader - should reject configuration without name', () => {
    const loader = new ConfigurationLoader();
    const config = {
        sources: [{ source: 'https://example.com/list.txt' }],
    } as unknown as IConfiguration;

    const error = loader.validateBasicStructure(config);
    assertEquals(error, 'Configuration must have a "name" field');
});

Deno.test('ConfigurationLoader - should reject configuration without sources', () => {
    const loader = new ConfigurationLoader();
    const config = {
        name: 'Test',
    } as unknown as IConfiguration;

    const error = loader.validateBasicStructure(config);
    assertEquals(error, 'Configuration must have a "sources" array');
});

Deno.test('ConfigurationLoader - should reject configuration with empty sources', () => {
    const loader = new ConfigurationLoader();
    const config: IConfiguration = {
        name: 'Test',
        sources: [],
    };

    const error = loader.validateBasicStructure(config);
    assertEquals(error, 'Configuration must have at least one source');
});

Deno.test('ConfigurationLoader - should reject source without source field', () => {
    const loader = new ConfigurationLoader();
    const config = {
        name: 'Test',
        sources: [{ name: 'Invalid' }],
    } as unknown as IConfiguration;

    const error = loader.validateBasicStructure(config);
    assertEquals(error?.includes('must have a "source" field'), true);
});

Deno.test('ConfigurationLoader - should validate multiple sources', () => {
    const loader = new ConfigurationLoader();
    const config: IConfiguration = {
        name: 'Test',
        sources: [
            { source: 'https://example.com/1.txt' },
            { source: 'https://example.com/2.txt' },
            { source: 'https://example.com/3.txt' },
        ],
    };

    const error = loader.validateBasicStructure(config);
    assertEquals(error, null);
});

Deno.test('ConfigurationLoader - should handle complex configuration', async () => {
    const mockFs = new MockFileSystem();
    const config = {
        name: 'Complex List',
        description: 'A complex filter list',
        version: '1.0.0',
        homepage: 'https://example.com',
        license: 'MIT',
        sources: [
            {
                name: 'Source 1',
                source: 'https://example.com/1.txt',
                type: 'hosts',
            },
            {
                name: 'Source 2',
                source: 'https://example.com/2.txt',
                type: 'adblock',
            },
        ],
        transformations: ['RemoveComments', 'Deduplicate'],
    };
    mockFs.setFile('/complex.json', JSON.stringify(config));

    const loader = new ConfigurationLoader(mockFs);
    const loaded = await loader.loadFromFile('/complex.json');

    assertEquals(loaded.name, 'Complex List');
    assertEquals(loaded.description, 'A complex filter list');
    assertEquals(loaded.version, '1.0.0');
    assertEquals(loaded.sources.length, 2);
    assertEquals(loaded.transformations?.length, 2);
});
