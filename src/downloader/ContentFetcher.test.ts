import { assertEquals, assertRejects } from '@std/assert';
import { ContentFetcher } from './ContentFetcher.ts';
import type { IFileSystem, IHttpClient } from '../types/index.ts';

// Mock logger
const mockLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
};

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

// Mock HTTP client
class MockHttpClient implements IHttpClient {
    private responses: Map<string, { status: number; text: string }> = new Map();

    setResponse(url: string, status: number, text: string) {
        this.responses.set(url, { status, text });
    }

    async fetch(url: string, _options?: RequestInit): Promise<Response> {
        const response = this.responses.get(url);
        if (!response) {
            throw new Error(`No mock response for ${url}`);
        }

        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.status === 200 ? 'OK' : 'Error',
            text: async () => response.text,
        } as Response;
    }
}

Deno.test('ContentFetcher - should fetch from local file', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setFile('/path/to/file.txt', 'test content');

    const fetcher = new ContentFetcher(mockLogger, {}, mockFs);
    const content = await fetcher.fetch('/path/to/file.txt');

    assertEquals(content, 'test content');
});

Deno.test('ContentFetcher - should fetch from HTTP URL', async () => {
    const mockHttp = new MockHttpClient();
    mockHttp.setResponse('http://example.com/list.txt', 200, 'http content');

    const fetcher = new ContentFetcher(mockLogger, {}, undefined, mockHttp);
    const content = await fetcher.fetch('http://example.com/list.txt');

    assertEquals(content, 'http content');
});

Deno.test('ContentFetcher - should fetch from HTTPS URL', async () => {
    const mockHttp = new MockHttpClient();
    mockHttp.setResponse('https://example.com/list.txt', 200, 'https content');

    const fetcher = new ContentFetcher(mockLogger, {}, undefined, mockHttp);
    const content = await fetcher.fetch('https://example.com/list.txt');

    assertEquals(content, 'https content');
});

Deno.test('ContentFetcher - should throw on file not found', async () => {
    const mockFs = new MockFileSystem();
    const fetcher = new ContentFetcher(mockLogger, {}, mockFs);

    await assertRejects(
        async () => await fetcher.fetch('/nonexistent/file.txt'),
        Error,
        'File not found',
    );
});

Deno.test('ContentFetcher - should throw on HTTP error', async () => {
    const mockHttp = new MockHttpClient();
    mockHttp.setResponse('http://example.com/notfound', 404, 'Not Found');

    const fetcher = new ContentFetcher(mockLogger, {}, undefined, mockHttp);

    await assertRejects(
        async () => await fetcher.fetch('http://example.com/notfound'),
        Error,
        'HTTP 404',
    );
});

Deno.test('ContentFetcher - should throw on empty content by default', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setFile('/path/to/empty.txt', '');

    const fetcher = new ContentFetcher(mockLogger, {}, mockFs);

    await assertRejects(
        async () => await fetcher.fetch('/path/to/empty.txt'),
        Error,
        'Empty content',
    );
});

Deno.test('ContentFetcher - should allow empty content when configured', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setFile('/path/to/empty.txt', '');

    const fetcher = new ContentFetcher(mockLogger, { allowEmptyResponse: true }, mockFs);
    const content = await fetcher.fetch('/path/to/empty.txt');

    assertEquals(content, '');
});

Deno.test('ContentFetcher - should resolve relative file path', () => {
    const resolved = ContentFetcher.resolveIncludePath(
        'included.txt',
        '/path/to/main.txt',
    );
    assertEquals(resolved, '/path/to/included.txt');
});

Deno.test('ContentFetcher - should resolve relative URL', () => {
    const resolved = ContentFetcher.resolveIncludePath(
        'included.txt',
        'http://example.com/lists/main.txt',
    );
    assertEquals(resolved, 'http://example.com/lists/included.txt');
});

Deno.test('ContentFetcher - should handle absolute file path', () => {
    const resolved = ContentFetcher.resolveIncludePath(
        '/absolute/path.txt',
        '/other/base.txt',
    );
    assertEquals(resolved, '/absolute/path.txt');
});

Deno.test('ContentFetcher - should handle absolute URL', () => {
    const resolved = ContentFetcher.resolveIncludePath(
        'http://other.com/file.txt',
        'http://example.com/base.txt',
    );
    assertEquals(resolved, 'http://other.com/file.txt');
});

Deno.test('ContentFetcher - should handle Windows paths', () => {
    const resolved = ContentFetcher.resolveIncludePath(
        'included.txt',
        'C:\\path\\to\\main.txt',
    );
    assertEquals(resolved, 'C:\\path\\to\\included.txt');
});

Deno.test('ContentFetcher - should handle Windows absolute paths', () => {
    const resolved = ContentFetcher.resolveIncludePath(
        'D:\\absolute\\path.txt',
        'C:\\other\\base.txt',
    );
    assertEquals(resolved, 'D:\\absolute\\path.txt');
});

Deno.test('ContentFetcher - should resolve subdirectory in URL', () => {
    const resolved = ContentFetcher.resolveIncludePath(
        'subdir/included.txt',
        'http://example.com/lists/main.txt',
    );
    assertEquals(resolved, 'http://example.com/lists/subdir/included.txt');
});

Deno.test('ContentFetcher - should resolve parent directory in URL', () => {
    const resolved = ContentFetcher.resolveIncludePath(
        '../other.txt',
        'http://example.com/lists/main.txt',
    );
    assertEquals(resolved, 'http://example.com/other.txt');
});
