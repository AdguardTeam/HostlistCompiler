# Node.js to Deno Migration Guide

## Overview

This document outlines the migration of the hostlist-compiler from Node.js to Deno.

## Key Changes Required

### 1. Import System Changes

**Before (Node.js):**
```typescript
import * as fs from 'fs/promises';
import { domainToASCII } from 'url';
import packageJson from '../../package.json';
```

**After (Deno):**
```typescript
import { readFile, writeFile } from '@std/fs';
import packageJson from '../../package.json' with { type: 'json' };
// domainToASCII is available in Deno's URL API natively
```

### 2. File System Operations

**Before (Node.js):**
```typescript
await fs.access(this.args.config!);
const configStr = (await fs.readFile(this.args.config!)).toString();
await fs.writeFile(this.args.output, lines.join('\n'));
```

**After (Deno):**
```typescript
const configStr = await Deno.readTextFile(this.args.config!);
await Deno.writeTextFile(this.args.output, lines.join('\n'));
```

### 3. CLI Argument Parsing

**Before (Node.js):**
```typescript
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
```

**After (Deno):**
```typescript
import { parseArgs } from '@std/flags';
// or use cliffy for more advanced CLI features
import { Command } from 'https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts';
```

### 4. Process APIs

**Before (Node.js):**
```typescript
process.exit(1);
process.argv
```

**After (Deno):**
```typescript
Deno.exit(1);
Deno.args
```

### 5. Dependencies Migration

| Node.js Package | Deno Alternative | Notes |
|----------------|------------------|-------|
| `yargs` | `@std/flags` or `cliffy` | cliffy provides more features similar to yargs |
| `axios` | `fetch` | Deno has built-in fetch API |
| `consola` | Custom logger or `@std/log` | Can create wrapper for compatibility |
| `lodash` | Native JS or `npm:lodash` | Can use npm: specifier temporarily |
| `ajv` | `npm:ajv` or custom validation | JSON schema validation |
| `tldts` | `npm:tldts` | Can use npm: specifier |
| `@adguard/filters-downloader` | Need to check compatibility | May need custom implementation |

### 6. TypeScript Configuration

- Remove `tsconfig.json` (Deno has built-in TS support)
- Move compiler options to `deno.json`
- No need for `@types/*` packages

### 7. Testing

**Before (Jest):**
```json
{
  "scripts": {
    "test": "jest --runInBand --detectOpenHandles"
  }
}
```

**After (Deno):**
```json
{
  "tasks": {
    "test": "deno test --allow-read --allow-write --allow-net"
  }
}
```

Test files need to be converted from Jest syntax to Deno's built-in test framework:
```typescript
// Before (Jest)
import { describe, it, expect } from '@jest/globals';

describe('MyTest', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});

// After (Deno)
import { assertEquals } from '@std/assert';

Deno.test('MyTest - should work', () => {
  assertEquals(true, true);
});
```

### 8. Build and Deployment

- No need for `npm run build` (TypeScript compilation)
- Can use `deno compile` to create standalone executables
- Update Bamboo specs to use Deno Docker image instead of Node

## Migration Steps

1. **Phase 1: Setup**
   - [x] Create `deno.json` configuration
   - [ ] Install Deno locally for testing
   - [ ] Set up Deno-compatible development environment

2. **Phase 2: Core Files**
   - [ ] Migrate CLI entry point (`src/cli.ts`)
   - [ ] Migrate CLI app (`src/cli/CliApp.ts`)
   - [ ] Update file system operations throughout codebase
   - [ ] Replace `yargs` with Deno alternative

3. **Phase 3: Utilities**
   - [ ] Update utils that use Node.js APIs
   - [ ] Replace `url.domainToASCII` usage
   - [ ] Update path operations

4. **Phase 4: Dependencies**
   - [ ] Replace or wrap `consola`
   - [ ] Replace `axios` with `fetch`
   - [ ] Handle `lodash` usage
   - [ ] Handle `ajv` validation
   - [ ] Test `@adguard/filters-downloader` compatibility

5. **Phase 5: Tests**
   - [ ] Convert Jest tests to Deno tests
   - [ ] Update test assertions
   - [ ] Configure test permissions

6. **Phase 6: CI/CD**
   - [ ] Update Bamboo specs
   - [ ] Update deployment scripts
   - [ ] Create Deno executable builds

## Compatibility Notes

### Using npm: Specifier

Deno supports importing npm packages directly:
```typescript
import _ from 'npm:lodash@^4.17.15';
import ajv from 'npm:ajv@^6.12.0';
```

This can be used as a transitional approach for packages without Deno-native alternatives.

### Permissions

Deno requires explicit permissions. Common permissions needed:
- `--allow-read`: Read files and configuration
- `--allow-write`: Write output files
- `--allow-net`: Download filter lists from URLs
- `--allow-env`: Access environment variables (if needed)

## Challenges

1. **@adguard/filters-downloader**: This is a Node.js package that may not work with Deno
2. **ajv and validation**: Schema validation might need different approach
3. **consola**: Logging library might need custom wrapper
4. **Extensive codebase**: ~2080 lines of TypeScript to review and update

## Benefits of Migration

1. **No build step**: Deno runs TypeScript natively
2. **Better security**: Explicit permissions model
3. **Modern APIs**: Built-in fetch, WebCrypto, etc.
4. **Simpler tooling**: No need for webpack, babel, etc.
5. **Better dependency management**: URL imports, lock files
6. **Faster execution**: V8 optimizations

## Rollback Plan

Keep Node.js version in a separate branch until Deno version is fully tested and deployed.
