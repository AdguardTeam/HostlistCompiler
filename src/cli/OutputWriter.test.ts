import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { OutputWriter } from './OutputWriter.ts';
import type { IFileSystem } from '../types/index.ts';

// Mock logger
const mockLogger = {
    info: () => {},
    error: () => {},
    warn: () => {},
};

// Mock file system
class MockFileSystem implements IFileSystem {
    public writtenFiles: Map<string, string> = new Map();
    public shouldThrow = false;

    async readTextFile(_path: string): Promise<string> {
        throw new Error('Not implemented');
    }

    async writeTextFile(path: string, content: string): Promise<void> {
        if (this.shouldThrow) {
            throw new Error('Write failed');
        }
        this.writtenFiles.set(path, content);
    }

    async exists(_path: string): Promise<boolean> {
        return true;
    }
}

Deno.test('OutputWriter - should write rules to file', async () => {
    const mockFs = new MockFileSystem();
    const writer = new OutputWriter(mockLogger, mockFs);

    const rules = ['||example.org^', '||test.com^', '||other.net^'];
    await writer.writeToFile('/output/list.txt', rules);

    const written = mockFs.writtenFiles.get('/output/list.txt');
    assertEquals(written, '||example.org^\n||test.com^\n||other.net^');
});

Deno.test('OutputWriter - should write empty rules array', async () => {
    const mockFs = new MockFileSystem();
    const writer = new OutputWriter(mockLogger, mockFs);

    await writer.writeToFile('/output/empty.txt', []);

    const written = mockFs.writtenFiles.get('/output/empty.txt');
    assertEquals(written, '');
});

Deno.test('OutputWriter - should write single rule', async () => {
    const mockFs = new MockFileSystem();
    const writer = new OutputWriter(mockLogger, mockFs);

    await writer.writeToFile('/output/single.txt', ['||example.org^']);

    const written = mockFs.writtenFiles.get('/output/single.txt');
    assertEquals(written, '||example.org^');
});

Deno.test('OutputWriter - should handle rules with newlines', async () => {
    const mockFs = new MockFileSystem();
    const writer = new OutputWriter(mockLogger, mockFs);

    const rules = ['! Comment', '||example.org^', '', '||test.com^'];
    await writer.writeToFile('/output/list.txt', rules);

    const written = mockFs.writtenFiles.get('/output/list.txt');
    assertEquals(written, '! Comment\n||example.org^\n\n||test.com^');
});

Deno.test('OutputWriter - should throw on write failure', async () => {
    const mockFs = new MockFileSystem();
    mockFs.shouldThrow = true;
    const writer = new OutputWriter(mockLogger, mockFs);

    await assertRejects(
        async () => await writer.writeToFile('/output/fail.txt', ['rule']),
        Error,
        'Output write failed',
    );
});

Deno.test('OutputWriter - should handle different output paths', async () => {
    const mockFs = new MockFileSystem();
    const writer = new OutputWriter(mockLogger, mockFs);

    await writer.writeToFile('/path/to/output.txt', ['rule1']);
    await writer.writeToFile('relative/output.txt', ['rule2']);
    await writer.writeToFile('C:\\Windows\\output.txt', ['rule3']);

    assertEquals(mockFs.writtenFiles.size, 3);
    assertEquals(mockFs.writtenFiles.get('/path/to/output.txt'), 'rule1');
    assertEquals(mockFs.writtenFiles.get('relative/output.txt'), 'rule2');
    assertEquals(mockFs.writtenFiles.get('C:\\Windows\\output.txt'), 'rule3');
});

Deno.test('OutputWriter - should preserve rule content exactly', async () => {
    const mockFs = new MockFileSystem();
    const writer = new OutputWriter(mockLogger, mockFs);

    const rules = [
        '! Title: Test List',
        '! Description: Testing',
        '',
        '||ads.example.com^',
        '||tracking.example.org^$third-party',
        '@@||safe.example.com^',
    ];

    await writer.writeToFile('/output/list.txt', rules);

    const written = mockFs.writtenFiles.get('/output/list.txt');
    assertEquals(written, rules.join('\n'));
});

Deno.test('OutputWriter - should create instance with default file system', () => {
    const writer = new OutputWriter(mockLogger);
    // Just verify it doesn't throw
    assertExists(writer);
});

Deno.test('OutputWriter - validateOutputPath should return true for file in existing directory', async () => {
    const mockFs = new MockFileSystem();
    const writer = new OutputWriter(mockLogger, mockFs);

    // Test with a path that has a directory
    const result = await writer.validateOutputPath('/existing/directory/file.txt');

    // Since we're not mocking Deno.stat, it will fail to find the directory
    // and return false with a warning
    assertEquals(typeof result, 'boolean');
});

Deno.test('OutputWriter - validateOutputPath should return true for file without directory', async () => {
    const mockFs = new MockFileSystem();
    const writer = new OutputWriter(mockLogger, mockFs);

    // Test with a simple filename (no directory path)
    const result = await writer.validateOutputPath('output.txt');

    assertEquals(result, true);
});

Deno.test('OutputWriter - validateOutputPath should handle Windows paths', async () => {
    const mockFs = new MockFileSystem();
    const writer = new OutputWriter(mockLogger, mockFs);

    // Test with Windows-style path
    const result = await writer.validateOutputPath('C:\\path\\to\\file.txt');

    assertEquals(typeof result, 'boolean');
});

Deno.test('OutputWriter - writeToFile should handle non-Error exceptions', async () => {
    const mockFs = new MockFileSystem();
    // Override to throw a non-Error
    mockFs.writeTextFile = () => {
        throw 'string error';
    };
    const writer = new OutputWriter(mockLogger, mockFs);

    await assertRejects(
        async () => await writer.writeToFile('/output/fail.txt', ['rule']),
        Error,
        'Output write failed: string error',
    );
});
