import { assertEquals, assertExists, assertInstanceOf } from '@std/assert';
import {
    BaseError,
    CompilationError,
    ConfigurationError,
    ErrorCode,
    ErrorUtils,
    FileSystemError,
    NetworkError,
    SourceError,
    StorageError,
    TransformationError,
    ValidationError,
} from './ErrorUtils.ts';

// BaseError tests
Deno.test('BaseError - should have correct properties', () => {
    class TestError extends BaseError {
        constructor(message: string) {
            super(message, ErrorCode.COMPILATION_FAILED);
            this.name = 'TestError';
        }
    }

    const error = new TestError('test message');
    assertEquals(error.message, 'test message');
    assertEquals(error.code, ErrorCode.COMPILATION_FAILED);
    assertEquals(error.name, 'TestError');
    assertExists(error.timestamp);
});

Deno.test('BaseError - should include cause', () => {
    class TestError extends BaseError {
        constructor(message: string, cause?: Error) {
            super(message, ErrorCode.COMPILATION_FAILED, cause);
            this.name = 'TestError';
        }
    }

    const cause = new Error('original error');
    const error = new TestError('wrapped error', cause);
    assertEquals(error.cause, cause);
});

Deno.test('BaseError - toJSON should return serializable object', () => {
    class TestError extends BaseError {
        constructor(message: string, cause?: Error) {
            super(message, ErrorCode.COMPILATION_FAILED, cause);
            this.name = 'TestError';
        }
    }

    const cause = new Error('original');
    const error = new TestError('test', cause);
    const json = error.toJSON();

    assertEquals(json.name, 'TestError');
    assertEquals(json.message, 'test');
    assertEquals(json.code, ErrorCode.COMPILATION_FAILED);
    assertEquals(json.cause, 'original');
    assertExists(json.timestamp);
});

// CompilationError tests
Deno.test('CompilationError - should use default error code', () => {
    const error = new CompilationError('compilation failed');
    assertEquals(error.code, ErrorCode.COMPILATION_FAILED);
    assertEquals(error.name, 'CompilationError');
});

Deno.test('CompilationError - should accept custom error code', () => {
    const error = new CompilationError('config error', ErrorCode.CONFIGURATION_INVALID);
    assertEquals(error.code, ErrorCode.CONFIGURATION_INVALID);
});

Deno.test('CompilationError - should accept cause', () => {
    const cause = new Error('root cause');
    const error = new CompilationError('failed', ErrorCode.COMPILATION_FAILED, cause);
    assertEquals(error.cause, cause);
});

// ConfigurationError tests
Deno.test('ConfigurationError - should store config name', () => {
    const error = new ConfigurationError('invalid config', 'myConfig');
    assertEquals(error.configName, 'myConfig');
    assertEquals(error.code, ErrorCode.CONFIGURATION_INVALID);
    assertEquals(error.name, 'ConfigurationError');
});

Deno.test('ConfigurationError - should work without config name', () => {
    const error = new ConfigurationError('invalid');
    assertEquals(error.configName, undefined);
});

// ValidationError tests
Deno.test('ValidationError - should store path and details', () => {
    const error = new ValidationError('invalid value', 'config.sources[0]', ['must be string']);
    assertEquals(error.path, 'config.sources[0]');
    assertEquals(error.details, ['must be string']);
    assertEquals(error.code, ErrorCode.VALIDATION_CONSTRAINT);
    assertEquals(error.name, 'ValidationError');
});

Deno.test('ValidationError - should default to empty details', () => {
    const error = new ValidationError('invalid', 'path');
    assertEquals(error.details, []);
});

// NetworkError tests
Deno.test('NetworkError - should store url and status code', () => {
    const error = new NetworkError('HTTP 500', 'https://example.com', 500, true);
    assertEquals(error.url, 'https://example.com');
    assertEquals(error.statusCode, 500);
    assertEquals(error.retryable, true);
    assertEquals(error.name, 'NetworkError');
});

Deno.test('NetworkError - should detect rate limiting', () => {
    const error = new NetworkError('Too many requests', 'https://example.com', 429);
    assertEquals(error.code, ErrorCode.HTTP_RATE_LIMITED);
});

Deno.test('NetworkError - should detect HTTP errors', () => {
    const error = new NetworkError('Not found', 'https://example.com', 404);
    assertEquals(error.code, ErrorCode.HTTP_ERROR);
});

Deno.test('NetworkError - should use NETWORK_ERROR for no status code', () => {
    const error = new NetworkError('Connection refused', 'https://example.com');
    assertEquals(error.code, ErrorCode.NETWORK_ERROR);
});

// SourceError tests
Deno.test('SourceError - should store source', () => {
    const error = new SourceError('failed to fetch', 'https://filters.example.com');
    assertEquals(error.source, 'https://filters.example.com');
    assertEquals(error.code, ErrorCode.SOURCE_FETCH_FAILED);
    assertEquals(error.name, 'SourceError');
});

// TransformationError tests
Deno.test('TransformationError - should store transformation type and rule count', () => {
    const error = new TransformationError('transform failed', 'exclude', 100);
    assertEquals(error.transformationType, 'exclude');
    assertEquals(error.ruleCount, 100);
    assertEquals(error.code, ErrorCode.TRANSFORMATION_FAILED);
    assertEquals(error.name, 'TransformationError');
});

// StorageError tests
Deno.test('StorageError - should store operation and key', () => {
    const error = new StorageError('failed', 'put', ['filter', 'list1']);
    assertEquals(error.operation, 'put');
    assertEquals(error.key, ['filter', 'list1']);
    assertEquals(error.code, ErrorCode.STORAGE_OPERATION_FAILED);
    assertEquals(error.name, 'StorageError');
});

// FileSystemError tests
Deno.test('FileSystemError - should store path', () => {
    const error = new FileSystemError('not found', '/path/to/file');
    assertEquals(error.path, '/path/to/file');
    assertEquals(error.code, ErrorCode.FILE_NOT_FOUND);
    assertEquals(error.name, 'FileSystemError');
});

Deno.test('FileSystemError - should accept custom error code', () => {
    const error = new FileSystemError('denied', '/path', ErrorCode.PERMISSION_DENIED);
    assertEquals(error.code, ErrorCode.PERMISSION_DENIED);
});

// ErrorUtils.getMessage tests
Deno.test('ErrorUtils.getMessage - should extract message from Error', () => {
    const error = new Error('test message');
    assertEquals(ErrorUtils.getMessage(error), 'test message');
});

Deno.test('ErrorUtils.getMessage - should return string directly', () => {
    assertEquals(ErrorUtils.getMessage('string error'), 'string error');
});

Deno.test('ErrorUtils.getMessage - should convert other types to string', () => {
    assertEquals(ErrorUtils.getMessage(42), '42');
    assertEquals(ErrorUtils.getMessage(null), 'null');
    assertEquals(ErrorUtils.getMessage(undefined), 'undefined');
});

// ErrorUtils.wrap tests
Deno.test('ErrorUtils.wrap - should wrap Error with context', () => {
    const original = new Error('original');
    const wrapped = ErrorUtils.wrap(original, 'Context');
    assertEquals(wrapped.message, 'Context: original');
    assertEquals(wrapped.cause, original);
});

Deno.test('ErrorUtils.wrap - should wrap string with context', () => {
    const wrapped = ErrorUtils.wrap('string error', 'Context');
    assertEquals(wrapped.message, 'Context: string error');
});

// ErrorUtils.toError tests
Deno.test('ErrorUtils.toError - should return Error unchanged', () => {
    const original = new Error('test');
    assertEquals(ErrorUtils.toError(original), original);
});

Deno.test('ErrorUtils.toError - should convert string to Error', () => {
    const error = ErrorUtils.toError('string error');
    assertInstanceOf(error, Error);
    assertEquals(error.message, 'string error');
});

// ErrorUtils.isRetryable tests
Deno.test('ErrorUtils.isRetryable - should return true for retryable NetworkError', () => {
    const error = new NetworkError('timeout', 'url', undefined, true);
    assertEquals(ErrorUtils.isRetryable(error), true);
});

Deno.test('ErrorUtils.isRetryable - should return false for non-retryable NetworkError', () => {
    const error = new NetworkError('not found', 'url', 404, false);
    assertEquals(ErrorUtils.isRetryable(error), false);
});

Deno.test('ErrorUtils.isRetryable - should detect timeout errors', () => {
    assertEquals(ErrorUtils.isRetryable(new Error('Request timeout')), true);
});

Deno.test('ErrorUtils.isRetryable - should detect network errors', () => {
    assertEquals(ErrorUtils.isRetryable(new Error('ECONNRESET')), true);
    assertEquals(ErrorUtils.isRetryable(new Error('ECONNREFUSED')), true);
    assertEquals(ErrorUtils.isRetryable(new Error('network failure')), true);
    assertEquals(ErrorUtils.isRetryable(new Error('fetch failed')), true);
});

Deno.test('ErrorUtils.isRetryable - should detect HTTP 5xx errors', () => {
    assertEquals(ErrorUtils.isRetryable(new Error('HTTP 500 Internal Server Error')), true);
    assertEquals(ErrorUtils.isRetryable(new Error('HTTP 503 Service Unavailable')), true);
});

Deno.test('ErrorUtils.isRetryable - should detect rate limiting', () => {
    assertEquals(ErrorUtils.isRetryable(new Error('HTTP 429 Too Many Requests')), true);
});

Deno.test('ErrorUtils.isRetryable - should return false for non-retryable errors', () => {
    assertEquals(ErrorUtils.isRetryable(new Error('invalid input')), false);
    assertEquals(ErrorUtils.isRetryable(new Error('HTTP 400 Bad Request')), false);
});

Deno.test('ErrorUtils.isRetryable - should return false for non-errors', () => {
    assertEquals(ErrorUtils.isRetryable('string'), false);
    assertEquals(ErrorUtils.isRetryable(null), false);
});

// ErrorUtils.format tests
Deno.test('ErrorUtils.format - should format BaseError with all details', () => {
    const cause = new Error('cause');
    const error = new CompilationError('failed', ErrorCode.COMPILATION_FAILED, cause);
    const formatted = ErrorUtils.format(error);

    assertEquals(formatted.includes('CompilationError'), true);
    assertEquals(formatted.includes('COMPILATION_FAILED'), true);
    assertEquals(formatted.includes('failed'), true);
    assertEquals(formatted.includes('Caused by:'), true);
});

Deno.test('ErrorUtils.format - should format regular Error', () => {
    const cause = new Error('inner');
    const error = new Error('outer');
    error.cause = cause;
    const formatted = ErrorUtils.format(error);

    assertEquals(formatted.includes('Error: outer'), true);
    assertEquals(formatted.includes('Caused by: inner'), true);
});

Deno.test('ErrorUtils.format - should handle non-Error values', () => {
    assertEquals(ErrorUtils.format('string error'), 'string error');
    assertEquals(ErrorUtils.format(42), '42');
});

// Factory method tests
Deno.test('ErrorUtils.httpError - should create NetworkError for HTTP failures', () => {
    const error = ErrorUtils.httpError('https://example.com', 500, 'Internal Server Error');
    assertInstanceOf(error, NetworkError);
    assertEquals(error.statusCode, 500);
    assertEquals(error.retryable, true);
});

Deno.test('ErrorUtils.httpError - should mark 429 as retryable', () => {
    const error = ErrorUtils.httpError('https://example.com', 429, 'Too Many Requests');
    assertEquals(error.retryable, true);
});

Deno.test('ErrorUtils.httpError - should not mark 4xx as retryable', () => {
    const error = ErrorUtils.httpError('https://example.com', 404, 'Not Found');
    assertEquals(error.retryable, false);
});

Deno.test('ErrorUtils.timeoutError - should create retryable NetworkError', () => {
    const error = ErrorUtils.timeoutError('https://example.com', 5000);
    assertInstanceOf(error, NetworkError);
    assertEquals(error.retryable, true);
    assertEquals(error.message.includes('5000ms'), true);
});

Deno.test('ErrorUtils.sourceDownloadError - should create SourceError', () => {
    const cause = new Error('network issue');
    const error = ErrorUtils.sourceDownloadError('https://filters.com', cause);
    assertInstanceOf(error, SourceError);
    assertEquals(error.source, 'https://filters.com');
    assertEquals(error.message.includes('network issue'), true);
});

Deno.test('ErrorUtils.sourceDownloadError - should work without cause', () => {
    const error = ErrorUtils.sourceDownloadError('https://filters.com');
    assertInstanceOf(error, SourceError);
    assertEquals(error.message.includes('Failed to download'), true);
});

Deno.test('ErrorUtils.configurationError - should create ConfigurationError', () => {
    const error = ErrorUtils.configurationError('invalid format', 'config.json');
    assertInstanceOf(error, ConfigurationError);
    assertEquals(error.configName, 'config.json');
});

Deno.test('ErrorUtils.transformationError - should create TransformationError', () => {
    const cause = new Error('regex error');
    const error = ErrorUtils.transformationError('exclude', 'pattern failed', 50, cause);
    assertInstanceOf(error, TransformationError);
    assertEquals(error.transformationType, 'exclude');
    assertEquals(error.ruleCount, 50);
    assertEquals(error.cause, cause);
});

Deno.test('ErrorUtils.fileNotFoundError - should create FileSystemError', () => {
    const error = ErrorUtils.fileNotFoundError('/missing/file.txt');
    assertInstanceOf(error, FileSystemError);
    assertEquals(error.path, '/missing/file.txt');
    assertEquals(error.code, ErrorCode.FILE_NOT_FOUND);
});

Deno.test('ErrorUtils.permissionDeniedError - should create FileSystemError', () => {
    const error = ErrorUtils.permissionDeniedError('/protected/file', 'write');
    assertInstanceOf(error, FileSystemError);
    assertEquals(error.code, ErrorCode.PERMISSION_DENIED);
    assertEquals(error.message.includes('write'), true);
});

Deno.test('ErrorUtils.storageError - should create StorageError', () => {
    const cause = new Error('KV error');
    const error = ErrorUtils.storageError('put', ['prefix', 'key'], cause);
    assertInstanceOf(error, StorageError);
    assertEquals(error.operation, 'put');
    assertEquals(error.key, ['prefix', 'key']);
    assertEquals(error.message.includes('prefix/key'), true);
});

Deno.test('ErrorUtils.storageError - should handle missing key', () => {
    const error = ErrorUtils.storageError('get');
    assertEquals(error.message.includes('unknown'), true);
});

// Type guard tests
Deno.test('ErrorUtils.isBaseError - should identify BaseError subclasses', () => {
    assertEquals(ErrorUtils.isBaseError(new CompilationError('test')), true);
    assertEquals(ErrorUtils.isBaseError(new NetworkError('test', 'url')), true);
    assertEquals(ErrorUtils.isBaseError(new Error('test')), false);
    assertEquals(ErrorUtils.isBaseError('string'), false);
});

Deno.test('ErrorUtils.isNetworkError - should identify NetworkError', () => {
    assertEquals(ErrorUtils.isNetworkError(new NetworkError('test', 'url')), true);
    assertEquals(ErrorUtils.isNetworkError(new CompilationError('test')), false);
    assertEquals(ErrorUtils.isNetworkError(new Error('test')), false);
});

Deno.test('ErrorUtils.isValidationError - should identify ValidationError', () => {
    assertEquals(ErrorUtils.isValidationError(new ValidationError('test', 'path')), true);
    assertEquals(ErrorUtils.isValidationError(new Error('test')), false);
});

Deno.test('ErrorUtils.isConfigurationError - should identify ConfigurationError', () => {
    assertEquals(ErrorUtils.isConfigurationError(new ConfigurationError('test')), true);
    assertEquals(ErrorUtils.isConfigurationError(new Error('test')), false);
});

Deno.test('ErrorUtils.getErrorCode - should return code for BaseError', () => {
    const error = new CompilationError('test');
    assertEquals(ErrorUtils.getErrorCode(error), ErrorCode.COMPILATION_FAILED);
});

Deno.test('ErrorUtils.getErrorCode - should return undefined for non-BaseError', () => {
    assertEquals(ErrorUtils.getErrorCode(new Error('test')), undefined);
    assertEquals(ErrorUtils.getErrorCode('string'), undefined);
});
