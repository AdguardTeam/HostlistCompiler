import { assertEquals, assertExists } from '@std/assert';
import { HeaderGenerator } from './HeaderGenerator.ts';
import { SourceType, type IConfiguration, type ISource } from '../types/index.ts';

Deno.test('HeaderGenerator - should generate basic list header', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test Filter List',
        sources: [],
    };
    
    const header = generator.generateListHeader(config);
    
    assertExists(header);
    assertEquals(header.some(line => line.includes('Title: Test Filter List')), true);
    assertEquals(header.some(line => line.includes('Last modified:')), true);
    assertEquals(header.some(line => line.includes('Compiled by')), true);
});

Deno.test('HeaderGenerator - should include description when provided', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        description: 'This is a test description',
        sources: [],
    };
    
    const header = generator.generateListHeader(config);
    
    assertEquals(header.some(line => line.includes('Description: This is a test description')), true);
});

Deno.test('HeaderGenerator - should include version when provided', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        version: '1.2.3',
        sources: [],
    };
    
    const header = generator.generateListHeader(config);
    
    assertEquals(header.some(line => line.includes('Version: 1.2.3')), true);
});

Deno.test('HeaderGenerator - should include homepage when provided', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        homepage: 'https://example.com',
        sources: [],
    };
    
    const header = generator.generateListHeader(config);
    
    assertEquals(header.some(line => line.includes('Homepage: https://example.com')), true);
});

Deno.test('HeaderGenerator - should include license when provided', () => {
    const generator = new HeaderGenerator();
    const config: IConfiguration = {
        name: 'Test List',
        license: 'MIT',
        sources: [],
    };
    
    const header = generator.generateListHeader(config);
    
    assertEquals(header.some(line => line.includes('License: MIT')), true);
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
    
    assertEquals(header.some(line => line.includes('Title: Complete Test List')), true);
    assertEquals(header.some(line => line.includes('Description: A comprehensive test list')), true);
    assertEquals(header.some(line => line.includes('Version: 2.0.0')), true);
    assertEquals(header.some(line => line.includes('Homepage: https://example.org')), true);
    assertEquals(header.some(line => line.includes('License: GPL-3.0')), true);
    assertEquals(header.some(line => line.includes('Last modified:')), true);
    assertEquals(header.some(line => line.includes('Compiled by')), true);
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
    assertEquals(header.some(line => line.includes('Source: https://example.com/list.txt')), true);
});

Deno.test('HeaderGenerator - should include source name when provided', () => {
    const generator = new HeaderGenerator();
    const source: ISource = {
        name: 'Example List',
        source: 'https://example.com/list.txt',
    };
    
    const header = generator.generateSourceHeader(source);
    
    assertEquals(header.some(line => line.includes('Source name: Example List')), true);
    assertEquals(header.some(line => line.includes('Source: https://example.com/list.txt')), true);
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
    
    const timestampLine = header.find(line => line.includes('Last modified:'));
    assertExists(timestampLine);
    
    // Extract timestamp and verify it's valid ISO format
    const timestamp = timestampLine!.replace('! Last modified: ', '');
    const date = new Date(timestamp);
    assertEquals(isNaN(date.getTime()), false);
});
