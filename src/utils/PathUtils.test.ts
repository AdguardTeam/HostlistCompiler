/**
 * Tests for PathUtils
 */

import { assertEquals } from '@std/assert';
import { PathUtils } from './PathUtils.ts';

// Tests for isUrl
Deno.test('PathUtils.isUrl - should return true for http URLs', () => {
    assertEquals(PathUtils.isUrl('http://example.com'), true);
});

Deno.test('PathUtils.isUrl - should return true for https URLs', () => {
    assertEquals(PathUtils.isUrl('https://example.com'), true);
});

Deno.test('PathUtils.isUrl - should return false for file paths', () => {
    assertEquals(PathUtils.isUrl('/path/to/file'), false);
});

Deno.test('PathUtils.isUrl - should return false for Windows paths', () => {
    assertEquals(PathUtils.isUrl('C:\\path\\to\\file'), false);
});

Deno.test('PathUtils.isUrl - should return false for relative paths', () => {
    assertEquals(PathUtils.isUrl('relative/path'), false);
});

Deno.test('PathUtils.isUrl - should return false for empty string', () => {
    assertEquals(PathUtils.isUrl(''), false);
});

// Tests for isAbsolutePath
Deno.test('PathUtils.isAbsolutePath - should return true for Unix absolute paths', () => {
    assertEquals(PathUtils.isAbsolutePath('/path/to/file'), true);
});

Deno.test('PathUtils.isAbsolutePath - should return true for Windows absolute paths (C:)', () => {
    assertEquals(PathUtils.isAbsolutePath('C:\\path\\to\\file'), true);
});

Deno.test('PathUtils.isAbsolutePath - should return true for Windows absolute paths (D:)', () => {
    assertEquals(PathUtils.isAbsolutePath('D:/path/to/file'), true);
});

Deno.test('PathUtils.isAbsolutePath - should return true for Windows absolute paths with forward slashes', () => {
    assertEquals(PathUtils.isAbsolutePath('C:/path/to/file'), true);
});

Deno.test('PathUtils.isAbsolutePath - should return false for relative paths', () => {
    assertEquals(PathUtils.isAbsolutePath('relative/path'), false);
});

Deno.test('PathUtils.isAbsolutePath - should return false for URLs', () => {
    assertEquals(PathUtils.isAbsolutePath('http://example.com'), false);
});

Deno.test('PathUtils.isAbsolutePath - should return false for empty string', () => {
    assertEquals(PathUtils.isAbsolutePath(''), false);
});

// Tests for isLocalPath
Deno.test('PathUtils.isLocalPath - should return true for Unix paths', () => {
    assertEquals(PathUtils.isLocalPath('/path/to/file'), true);
});

Deno.test('PathUtils.isLocalPath - should return true for Windows paths', () => {
    assertEquals(PathUtils.isLocalPath('C:\\path\\to\\file'), true);
});

Deno.test('PathUtils.isLocalPath - should return true for relative paths', () => {
    assertEquals(PathUtils.isLocalPath('relative/path'), true);
});

Deno.test('PathUtils.isLocalPath - should return false for http URLs', () => {
    assertEquals(PathUtils.isLocalPath('http://example.com'), false);
});

Deno.test('PathUtils.isLocalPath - should return false for https URLs', () => {
    assertEquals(PathUtils.isLocalPath('https://example.com'), false);
});

// Tests for resolveIncludePath
Deno.test('PathUtils.resolveIncludePath - should return absolute path as-is', () => {
    assertEquals(PathUtils.resolveIncludePath('/absolute/path', '/base/path'), '/absolute/path');
});

Deno.test('PathUtils.resolveIncludePath - should return URL as-is', () => {
    assertEquals(
        PathUtils.resolveIncludePath('https://example.com/file', '/base/path'),
        'https://example.com/file',
    );
});

Deno.test('PathUtils.resolveIncludePath - should resolve relative path against Unix base path', () => {
    assertEquals(
        PathUtils.resolveIncludePath('relative.txt', '/base/dir/file.txt'),
        '/base/dir/relative.txt',
    );
});

Deno.test('PathUtils.resolveIncludePath - should resolve relative path against Windows base path', () => {
    assertEquals(
        PathUtils.resolveIncludePath('relative.txt', 'C:\\base\\dir\\file.txt'),
        'C:\\base\\dir\\relative.txt',
    );
});

Deno.test('PathUtils.resolveIncludePath - should resolve relative URL against base URL', () => {
    assertEquals(
        PathUtils.resolveIncludePath('relative.txt', 'https://example.com/base/file.txt'),
        'https://example.com/base/relative.txt',
    );
});

Deno.test('PathUtils.resolveIncludePath - should handle base path without directory separator', () => {
    assertEquals(
        PathUtils.resolveIncludePath('relative.txt', 'file.txt'),
        'relative.txt',
    );
});

Deno.test('PathUtils.resolveIncludePath - should resolve relative URL with ../', () => {
    assertEquals(
        PathUtils.resolveIncludePath('../other.txt', 'https://example.com/base/dir/file.txt'),
        'https://example.com/base/other.txt',
    );
});

Deno.test('PathUtils.resolveIncludePath - should handle malformed base URL gracefully', () => {
    // When URL parsing fails, return the include path as-is
    const result = PathUtils.resolveIncludePath('relative.txt', 'http://[invalid');
    assertEquals(result, 'relative.txt');
});

// Tests for getDirectory
Deno.test('PathUtils.getDirectory - should extract directory from Unix path', () => {
    assertEquals(PathUtils.getDirectory('/path/to/file.txt'), '/path/to/');
});

Deno.test('PathUtils.getDirectory - should extract directory from Windows path', () => {
    assertEquals(PathUtils.getDirectory('C:\\path\\to\\file.txt'), 'C:\\path\\to\\');
});

Deno.test('PathUtils.getDirectory - should return empty string for path without directory', () => {
    assertEquals(PathUtils.getDirectory('file.txt'), '');
});

Deno.test('PathUtils.getDirectory - should handle root directory', () => {
    assertEquals(PathUtils.getDirectory('/file.txt'), '/');
});

// Tests for getFilename
Deno.test('PathUtils.getFilename - should extract filename from Unix path', () => {
    assertEquals(PathUtils.getFilename('/path/to/file.txt'), 'file.txt');
});

Deno.test('PathUtils.getFilename - should extract filename from Windows path', () => {
    assertEquals(PathUtils.getFilename('C:\\path\\to\\file.txt'), 'file.txt');
});

Deno.test('PathUtils.getFilename - should return full path if no directory separator', () => {
    assertEquals(PathUtils.getFilename('file.txt'), 'file.txt');
});

Deno.test('PathUtils.getFilename - should extract filename from URL', () => {
    assertEquals(PathUtils.getFilename('https://example.com/path/to/file.txt'), 'file.txt');
});

Deno.test('PathUtils.getFilename - should handle URL without path', () => {
    assertEquals(PathUtils.getFilename('https://example.com'), '');
});

Deno.test('PathUtils.getFilename - should handle URL with query parameters', () => {
    assertEquals(PathUtils.getFilename('https://example.com/file.txt?param=value'), 'file.txt');
});

Deno.test('PathUtils.getFilename - should handle malformed URL gracefully', () => {
    const malformed = 'http://[invalid';
    assertEquals(PathUtils.getFilename(malformed), malformed);
});

// Tests for normalize
Deno.test('PathUtils.normalize - should convert backslashes to forward slashes', () => {
    assertEquals(PathUtils.normalize('C:\\path\\to\\file'), 'C:/path/to/file');
});

Deno.test('PathUtils.normalize - should leave forward slashes unchanged', () => {
    assertEquals(PathUtils.normalize('/path/to/file'), '/path/to/file');
});

Deno.test('PathUtils.normalize - should handle mixed separators', () => {
    assertEquals(PathUtils.normalize('C:\\path/to\\file'), 'C:/path/to/file');
});

Deno.test('PathUtils.normalize - should handle empty string', () => {
    assertEquals(PathUtils.normalize(''), '');
});

// Tests for join
Deno.test('PathUtils.join - should join path segments', () => {
    assertEquals(PathUtils.join('path', 'to', 'file'), 'path/to/file');
});

Deno.test('PathUtils.join - should handle empty segments', () => {
    assertEquals(PathUtils.join('path', '', 'file'), 'path/file');
});

Deno.test('PathUtils.join - should normalize multiple slashes', () => {
    assertEquals(PathUtils.join('path/', '/to/', '/file'), 'path/to/file');
});

Deno.test('PathUtils.join - should handle single segment', () => {
    assertEquals(PathUtils.join('path'), 'path');
});

Deno.test('PathUtils.join - should handle no segments', () => {
    assertEquals(PathUtils.join(), '');
});

Deno.test('PathUtils.join - should handle all empty segments', () => {
    assertEquals(PathUtils.join('', '', ''), '');
});

// Tests for getHost
Deno.test('PathUtils.getHost - should extract host from http URL', () => {
    assertEquals(PathUtils.getHost('http://example.com/path'), 'example.com');
});

Deno.test('PathUtils.getHost - should extract host from https URL', () => {
    assertEquals(PathUtils.getHost('https://example.com/path'), 'example.com');
});

Deno.test('PathUtils.getHost - should extract host with port', () => {
    assertEquals(PathUtils.getHost('https://example.com:8080/path'), 'example.com:8080');
});

Deno.test('PathUtils.getHost - should return null for file paths', () => {
    assertEquals(PathUtils.getHost('/path/to/file'), null);
});

Deno.test('PathUtils.getHost - should return null for relative paths', () => {
    assertEquals(PathUtils.getHost('relative/path'), null);
});

Deno.test('PathUtils.getHost - should handle malformed URL gracefully', () => {
    assertEquals(PathUtils.getHost('http://[invalid'), null);
});

// Tests for sanitizeUrl
Deno.test('PathUtils.sanitizeUrl - should remove query parameters', () => {
    assertEquals(
        PathUtils.sanitizeUrl('https://example.com/path?secret=token'),
        'https://example.com/path?[QUERY]',
    );
});

Deno.test('PathUtils.sanitizeUrl - should preserve URL without query parameters', () => {
    assertEquals(
        PathUtils.sanitizeUrl('https://example.com/path'),
        'https://example.com/path',
    );
});

Deno.test('PathUtils.sanitizeUrl - should handle URL with hash', () => {
    assertEquals(
        PathUtils.sanitizeUrl('https://example.com/path#hash'),
        'https://example.com/path',
    );
});

Deno.test('PathUtils.sanitizeUrl - should handle URL with both query and hash', () => {
    assertEquals(
        PathUtils.sanitizeUrl('https://example.com/path?param=value#hash'),
        'https://example.com/path?[QUERY]',
    );
});

Deno.test('PathUtils.sanitizeUrl - should handle URL with port', () => {
    assertEquals(
        PathUtils.sanitizeUrl('https://example.com:8080/path?secret=token'),
        'https://example.com:8080/path?[QUERY]',
    );
});

Deno.test('PathUtils.sanitizeUrl - should return [INVALID_URL] for malformed URL', () => {
    assertEquals(PathUtils.sanitizeUrl('not a url'), '[INVALID_URL]');
});

Deno.test('PathUtils.sanitizeUrl - should return [INVALID_URL] for empty string', () => {
    assertEquals(PathUtils.sanitizeUrl(''), '[INVALID_URL]');
});
