# Testing Documentation

## Overview

This project has comprehensive unit test coverage using Deno's native testing framework. All tests are co-located with source files in the `src/` directory.

## Test Structure

Tests follow the pattern: `*.test.ts` files are placed next to their corresponding source files.

Example:

```
src/cli/
├── ArgumentParser.ts
├── ArgumentParser.test.ts  ← Test file
├── ConfigurationLoader.ts
└── ConfigurationLoader.test.ts  ← Test file
```

## Running Tests

```bash
# Run all tests
deno task test

# Run tests with coverage
deno task test:coverage

# Run tests in watch mode
deno task test:watch

# Run specific test file
deno test src/cli/ArgumentParser.test.ts

# Run tests for a specific module
deno test src/transformations/

# Run tests with permissions
deno test --allow-read --allow-write --allow-net --allow-env --unstable-kv
```

## Test Coverage

### Modules with Complete Coverage

#### CLI Module

- ✅ `ArgumentParser.ts` - Argument parsing and validation (22 tests)
- ✅ `ConfigurationLoader.ts` - JSON loading and validation (16 tests)
- ✅ `OutputWriter.ts` - File writing (8 tests)

#### Compiler Module

- ✅ `FilterCompiler.ts` - Main compilation logic (existing tests)
- ✅ `HeaderGenerator.ts` - Header generation (16 tests)

#### Downloader Module

- ✅ `ConditionalEvaluator.ts` - Boolean expression evaluation (25 tests)
- ✅ `ContentFetcher.ts` - HTTP/file fetching (18 tests)
- ✅ `FilterDownloader.ts` - Filter list downloading (existing tests)
- ✅ `PreprocessorEvaluator.ts` - Directive processing (23 tests)

#### Transformations Module (11 transformations)

- ✅ `CompressTransformation.ts` - Hosts to adblock conversion
- ✅ `ConvertToAsciiTransformation.ts` - Unicode to ASCII conversion
- ✅ `DeduplicateTransformation.ts` - Remove duplicate rules
- ✅ `ExcludeTransformation.ts` - Pattern-based exclusion (10 tests)
- ✅ `IncludeTransformation.ts` - Pattern-based inclusion (11 tests)
- ✅ `InsertFinalNewLineTransformation.ts` - Final newline insertion
- ✅ `InvertAllowTransformation.ts` - Allow rule inversion
- ✅ `RemoveCommentsTransformation.ts` - Comment removal
- ✅ `RemoveEmptyLinesTransformation.ts` - Empty line removal
- ✅ `RemoveModifiersTransformation.ts` - Modifier removal
- ✅ `TrimLinesTransformation.ts` - Whitespace trimming
- ✅ `ValidateTransformation.ts` - Rule validation
- ✅ `TransformationRegistry.ts` - Transformation management (13 tests)

#### Utils Module

- ✅ `Benchmark.ts` - Performance benchmarking (existing tests)
- ✅ `EventEmitter.ts` - Event emission (existing tests)
- ✅ `logger.ts` - Logging functionality (17 tests)
- ✅ `RuleUtils.ts` - Rule parsing utilities (existing tests)
- ✅ `StringUtils.ts` - String utilities (existing tests)
- ✅ `TldUtils.ts` - Domain/TLD parsing (36 tests)
- ✅ `Wildcard.ts` - Wildcard pattern matching (existing tests)

#### Configuration Module

- ✅ `ConfigurationValidator.ts` - Configuration validation (existing tests)

#### Platform Module

- ✅ `platform.test.ts` - Platform abstractions (existing tests)

#### Storage Module

- ✅ `NoSqlStorage.test.ts` - Storage operations (existing tests)

## Test Statistics

- **Total Test Files**: 32
- **Total Modules Tested**: 40+
- **Test Cases**: 500+
- **Coverage**: High coverage on all core functionality

## Writing New Tests

### Test File Template

```typescript
import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { MyClass } from './MyClass.ts';

Deno.test('MyClass - should do something', () => {
    const instance = new MyClass();
    const result = instance.doSomething();
    assertEquals(result, expectedValue);
});

Deno.test('MyClass - should handle errors', async () => {
    const instance = new MyClass();
    await assertRejects(
        async () => await instance.failingMethod(),
        Error,
        'Expected error message',
    );
});
```

### Best Practices

1. **Co-locate tests** - Place test files next to source files
2. **Use descriptive names** - `MyClass - should do something specific`
3. **Test edge cases** - Empty inputs, null values, boundary conditions
4. **Use mocks** - Mock external dependencies (file system, HTTP)
5. **Keep tests isolated** - Each test should be independent
6. **Use async/await** - For asynchronous operations
7. **Clean up** - Remove temporary files/state after tests

### Mock Examples

#### Mock File System

```typescript
class MockFileSystem implements IFileSystem {
    private files: Map<string, string> = new Map();

    setFile(path: string, content: string) {
        this.files.set(path, content);
    }

    async readTextFile(path: string): Promise<string> {
        return this.files.get(path) ?? '';
    }

    async writeTextFile(path: string, content: string): Promise<void> {
        this.files.set(path, content);
    }

    async exists(path: string): Promise<boolean> {
        return this.files.has(path);
    }
}
```

#### Mock HTTP Client

```typescript
class MockHttpClient implements IHttpClient {
    private responses: Map<string, Response> = new Map();

    setResponse(url: string, response: Response) {
        this.responses.set(url, response);
    }

    async fetch(url: string): Promise<Response> {
        return this.responses.get(url) ?? new Response('', { status: 404 });
    }
}
```

#### Mock Logger

```typescript
const mockLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
};
```

## Continuous Integration

Tests are automatically run on:

- Push to main branch
- Pull requests
- Pre-deployment

## Coverage Reports

Generate coverage reports:

```bash
# Generate coverage
deno task test:coverage

# View coverage report (HTML)
deno coverage coverage --html --include="^file:"

# Generate lcov report for CI
deno coverage coverage --lcov --output=coverage.lcov --include="^file:"
```

## Troubleshooting

### Tests fail with permission errors

Make sure to run with required permissions:

```bash
deno test --allow-read --allow-write --allow-net --allow-env --unstable-kv
```

### Tests timeout

Increase timeout for slow operations:

```typescript
Deno.test({
    name: 'slow operation',
    fn: async () => {
        // test code
    },
    sanitizeOps: false,
    sanitizeResources: false,
});
```

### Mock not working

Ensure mocks are passed to constructors:

```typescript
const mockFs = new MockFileSystem();
const instance = new MyClass(mockFs); // Pass mock
```

## Resources

- [Deno Testing Documentation](https://deno.land/manual/testing)
- [Deno Assertions](https://deno.land/std/assert)
- [Project README](README.md)
