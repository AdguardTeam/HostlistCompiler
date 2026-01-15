import { assertEquals, assertExists } from '@std/assert';
import { HeaderGenerator } from './HeaderGenerator.ts';
import { type IConfiguration, type ISource, SourceType } from '../types/index.ts';

Deno.test('HeaderGenerator - should generate basic list header', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test Filter List',
        sources: [],
    };

    const header = generator.generateListHeader(config);

    assertExists(header);
    assertEquals(header.some((line) => line.includes('Title: Test Filter List')), true);
    assertEquals(header.some((line) => line.includes('Last modified:')), true);
    assertEquals(header.some((line) => line.includes('Compiled by')), true);
});

Deno.test('HeaderGenerator - should include description when provided', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        description: 'This is a test description',
        sources: [],
    };

    const header = generator.generateListHeader(config);

    assertEquals(header.some((line) => line.includes('Description: This is a test description')), true);
});

Deno.test('HeaderGenerator - should include version when provided', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        version: '1.2.3',
        sources: [],
    };

    const header = generator.generateListHeader(config);

    assertEquals(header.some((line) => line.includes('Version: 1.2.3')), true);
});

Deno.test('HeaderGenerator - should include homepage when provided', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        homepage: 'https://example.com',
        sources: [],
    };

    const header = generator.generateListHeader(config);

    assertEquals(header.some((line) => line.includes('Homepage: https://example.com')), true);
});

Deno.test('HeaderGenerator - should include license when provided', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        license: 'MIT',
        sources: [],
    };

    const header = generator.generateListHeader(config);

    assertEquals(header.some((line) => line.includes('License: MIT')), true);
});

Deno.test('HeaderGenerator - should generate complete header with all fields', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Complete Test List',
        description: 'A comprehensive test list',
        version: '2.0.0',
        homepage: 'https://example.org',
        license: 'GPL-3.0',
        sources: [],
    };

    const header = generator.generateListHeader(config);

    assertEquals(header.some((line) => line.includes('Title: Complete Test List')), true);
    assertEquals(header.some((line) => line.includes('Description: A comprehensive test list')), true);
    assertEquals(header.some((line) => line.includes('Version: 2.0.0')), true);
    assertEquals(header.some((line) => line.includes('Homepage: https://example.org')), true);
    assertEquals(header.some((line) => line.includes('License: GPL-3.0')), true);
    assertEquals(header.some((line) => line.includes('Last modified:')), true);
    assertEquals(header.some((line) => line.includes('Compiled by')), true);
});

Deno.test('HeaderGenerator - header should start and end with comment markers', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        sources: [],
    };

    const header = generator.generateListHeader(config);

    assertEquals(header[0], '!');
    assertEquals(header[header.length - 1], '!');
});

Deno.test('HeaderGenerator - should generate basic source header', () => {
    const generator = new HeaderGenerator();
    const source: ISource = {
        source: 'https://example.com/list.txt',
    };

    const header = generator.generateSourceHeader(source);

    assertExists(header);
    assertEquals(header.some((line) => line.includes('Source: https://example.com/list.txt')), true);
});

Deno.test('HeaderGenerator - should include source name when provided', () => {
    const generator = new HeaderGenerator();
    const source: ISource = {
        name: 'Example List',
        source: 'https://example.com/list.txt',
    };

    const header = generator.generateSourceHeader(source);

    assertEquals(header.some((line) => line.includes('Source name: Example List')), true);
    assertEquals(header.some((line) => line.includes('Source: https://example.com/list.txt')), true);
});

Deno.test('HeaderGenerator - source header should start and end with comment markers', () => {
    const generator = new HeaderGenerator();
    const source: ISource = {
        source: 'https://example.com/list.txt',
    };

    const header = generator.generateSourceHeader(source);

    assertEquals(header[0], '!');
    assertEquals(header[header.length - 1], '!');
});

Deno.test('HeaderGenerator - source header without name should only have source line', () => {
    const generator = new HeaderGenerator();
    const source: ISource = {
        source: 'https://example.com/list.txt',
        type: SourceType.Hosts,
    };

    const header = generator.generateSourceHeader(source);

    assertEquals(header.length, 3); // !, Source: ..., !
    assertEquals(header[0], '!');
    assertEquals(header[1], '! Source: https://example.com/list.txt');
    assertEquals(header[2], '!');
});

Deno.test('HeaderGenerator - source header with name should have name and source', () => {
    const generator = new HeaderGenerator();
    const source: ISource = {
        name: 'My List',
        source: 'https://example.com/list.txt',
    };

    const header = generator.generateSourceHeader(source);

    assertEquals(header.length, 4); // !, Source name: ..., Source: ..., !
    assertEquals(header[0], '!');
    assertEquals(header[1], '! Source name: My List');
    assertEquals(header[2], '! Source: https://example.com/list.txt');
    assertEquals(header[3], '!');
});

Deno.test('HeaderGenerator - header should contain valid ISO timestamp', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        sources: [],
    };

    const header = generator.generateListHeader(config);

    const timestampLine = header.find((line) => line.includes('Last modified:'));
    assertExists(timestampLine);

    // Extract timestamp and verify it's valid ISO format
    const timestamp = timestampLine!.replace('! Last modified: ', '');
    const date = new Date(timestamp);
    assertEquals(isNaN(date.getTime()), false);
});

Deno.test('HeaderGenerator - should generate section separator without title', () => {
    const generator = new HeaderGenerator();
    const separator = generator.generateSectionSeparator();

    assertEquals(separator.length, 1);
    assertEquals(separator[0], '!');
});

Deno.test('HeaderGenerator - should generate section separator with title', () => {
    const generator = new HeaderGenerator();
    const separator = generator.generateSectionSeparator('My Section');

    assertEquals(separator.length, 3);
    assertEquals(separator[0], '!');
    assertEquals(separator[1], '! ========== My Section ==========');
    assertEquals(separator[2], '!');
});

Deno.test('HeaderGenerator - should generate stats header', () => {
    const generator = new HeaderGenerator();
    const stats = {
        totalRules: 1500,
        sourceCount: 5,
        transformationCount: 3,
        compilationTimeMs: 125.5,
    };

    const header = generator.generateStatsHeader(stats);

    assertEquals(header.some((line) => line.includes('Total rules: 1500')), true);
    assertEquals(header.some((line) => line.includes('Sources: 5')), true);
    assertEquals(header.some((line) => line.includes('Transformations applied: 3')), true);
    assertEquals(header.some((line) => line.includes('Compilation time: 125.50ms')), true);
});

Deno.test('HeaderGenerator - should generate diff header without previous version', () => {
    const generator = new HeaderGenerator();
    const diff = {
        added: 100,
        removed: 50,
        unchanged: 1000,
    };

    const header = generator.generateDiffHeader(diff);

    assertEquals(header.some((line) => line.includes('Added: 100 rules')), true);
    assertEquals(header.some((line) => line.includes('Removed: 50 rules')), true);
    assertEquals(header.some((line) => line.includes('Unchanged: 1000 rules')), true);
    assertEquals(header.some((line) => line.includes('Previous version')), false);
});

Deno.test('HeaderGenerator - should generate diff header with previous version', () => {
    const generator = new HeaderGenerator();
    const diff = {
        added: 100,
        removed: 50,
        unchanged: 1000,
        previousVersion: '1.0.0',
    };

    const header = generator.generateDiffHeader(diff);

    assertEquals(header.some((line) => line.includes('Previous version: 1.0.0')), true);
    assertEquals(header.some((line) => line.includes('Added: 100 rules')), true);
});

Deno.test('HeaderGenerator - should parse header metadata', () => {
    const generator = new HeaderGenerator();
    const lines = [
        '!',
        '! Title: My Filter List',
        '! Description: A test list',
        '! Version: 1.0.0',
        '! Homepage: https://example.com',
        '!',
        '||example.org^',
    ];

    const metadata = generator.parseHeader(lines);

    assertEquals(metadata['title'], 'My Filter List');
    assertEquals(metadata['description'], 'A test list');
    assertEquals(metadata['version'], '1.0.0');
    assertEquals(metadata['homepage'], 'https://example.com');
});

Deno.test('HeaderGenerator - parseHeader should stop at non-comment line', () => {
    const generator = new HeaderGenerator();
    const lines = [
        '! Title: My List',
        '||example.org^',
        '! This should be ignored',
    ];

    const metadata = generator.parseHeader(lines);

    assertEquals(metadata['title'], 'My List');
    assertEquals(Object.keys(metadata).length, 1);
});

Deno.test('HeaderGenerator - parseHeader should handle empty header', () => {
    const generator = new HeaderGenerator();
    const lines = ['||example.org^'];

    const metadata = generator.parseHeader(lines);

    assertEquals(Object.keys(metadata).length, 0);
});

Deno.test('HeaderGenerator - should include custom lines when provided', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        sources: [],
    };
    const options = {
        customLines: ['Custom line 1', 'Custom line 2'],
    };

    const header = generator.generateListHeader(config, options);

    assertEquals(header.some((line) => line.includes('Custom line 1')), true);
    assertEquals(header.some((line) => line.includes('Custom line 2')), true);
});

Deno.test('HeaderGenerator - should use custom timestamp when provided', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        sources: [],
    };
    const customDate = new Date('2024-06-15T12:00:00.000Z');
    const options = {
        timestamp: customDate,
    };

    const header = generator.generateListHeader(config, options);

    assertEquals(header.some((line) => line.includes('2024-06-15T12:00:00.000Z')), true);
});

Deno.test('HeaderGenerator - static prepareHeader should work', () => {
    const config: IConfiguration = {
        name: 'Static Test',
        sources: [],
    };

    const header = HeaderGenerator.prepareHeader(config);

    assertEquals(header.some((line) => line.includes('Title: Static Test')), true);
});

Deno.test('HeaderGenerator - static prepareSourceHeader should work', () => {
    const source: ISource = {
        name: 'Test Source',
        source: 'https://example.com/list.txt',
    };

    const header = HeaderGenerator.prepareSourceHeader(source);

    assertEquals(header.some((line) => line.includes('Source name: Test Source')), true);
    assertEquals(header.some((line) => line.includes('Source: https://example.com/list.txt')), true);
});
