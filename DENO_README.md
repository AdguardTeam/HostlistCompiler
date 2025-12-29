# Deno Migration Progress

## Overview

This PR contains the initial work for migrating the hostlist-compiler from Node.js to Deno. This is a **partial migration** that demonstrates the approach and provides foundational files for completing the migration.

## What's Been Completed

### 1. Configuration & Documentation
- ✅ **deno.json**: Complete Deno configuration with tasks, imports, and compiler options
- ✅ **DENO_MIGRATION.md**: Comprehensive migration guide explaining all changes needed
- ✅ Created new Deno-compatible CLI application with native APIs

### 2. Core Files Migrated
- ✅ **src/cli.deno.ts**: Deno entry point replacing `#!/usr/bin/env node`
- ✅ **src/cli/CliApp.deno.ts**: Full CLI application rewrite
  - Replaced `fs/promises` with `Deno.readTextFile` and `Deno.writeTextFile`
  - Replaced `yargs` with `@std/flags`
  - Replaced `process.argv` and `process.exit()` with `Deno.args` and `Deno.exit()`
  - Implemented custom logger to replace `consola` dependency
  - Uses `import.meta.main` for main module detection

### 3. Utilities Updated
- ✅ **src/utils/RuleUtils.deno.ts**: Migrated utility with Node.js API replacements
  - Replaced `url.domainToASCII` with native URL API
  - All imports use `.ts` extensions for Deno

### 4. CI/CD Configuration
- ✅ **bamboo-specs/build.deno.yaml**: Deno build configuration
  - Uses `denoland/deno:latest` Docker image
  - Creates standalone executable with `deno compile`
  - No build step needed (TypeScript runs natively)
- ✅ **bamboo-specs/test.deno.yaml**: Deno test configuration
  - Runs `deno lint`, `deno fmt`, `deno check`
  - Executes tests with appropriate permissions

## How to Test (Prerequisites)

### Install Deno

```bash
# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex

# Or using package managers
# macOS (Homebrew)
brew install deno

# Linux (apt)
sudo apt install deno
```

### Run the Deno CLI (when migration is complete)

```bash
# Grant necessary permissions
deno run --allow-read --allow-write --allow-net src/cli.deno.ts --help

# Or use the task defined in deno.json
deno task compile --help
```

### Run Tests (when tests are migrated)

```bash
deno test --allow-read --allow-write --allow-net
```

### Lint and Format

```bash
# Check formatting
deno fmt --check src/

# Auto-format
deno fmt src/

# Lint
deno lint src/
```

## What Still Needs to Be Done

### Critical Path Items

1. **Complete Source File Migration** (Estimated: 8-12 hours)
   - [ ] Migrate all files in `src/compiler/`
   - [ ] Migrate all files in `src/transformations/`
   - [ ] Migrate all files in `src/configuration/`
   - [ ] Migrate all files in `src/services/`
   - [ ] Migrate remaining `src/utils/` files
   - [ ] Update all imports to use `.ts` extensions
   - [ ] Ensure all TypeScript files are Deno-compatible

2. **Dependency Migration** (Estimated: 4-6 hours)
   - [ ] Replace `axios` with Deno's `fetch` API in `SourceCompiler`
   - [ ] Test `@adguard/filters-downloader` with `npm:` specifier
   - [ ] Handle `ajv` validation (may use `npm:ajv` or find Deno alternative)
   - [ ] Handle `lodash` usage (use `npm:lodash` or replace with native JS)
   - [ ] Replace `tldts` or use `npm:tldts`
   - [ ] Test `better-ajv-errors` compatibility

3. **Test Migration** (Estimated: 6-8 hours)
   - [ ] Convert Jest test files to Deno test format
   - [ ] Update test assertions from Jest to `@std/assert`
   - [ ] Configure test permissions in deno.json
   - [ ] Ensure all ~30 test files are converted

4. **Integration & Validation** (Estimated: 4-6 hours)
   - [ ] End-to-end testing of CLI
   - [ ] Verify all transformations work
   - [ ] Test with real filter list sources
   - [ ] Performance testing and optimization

### Nice to Have

- [ ] Update README.md with Deno instructions
- [ ] Create Deno-specific examples
- [ ] Publish to JSR (Deno's package registry)
- [ ] Create migration script to help automate conversion

## Benefits of This Migration

1. **No Build Step**: TypeScript runs natively - no `tsc` or webpack needed
2. **Better Security**: Explicit permissions model (`--allow-read`, `--allow-net`, etc.)
3. **Modern APIs**: Built-in `fetch`, WebCrypto, and other Web Standard APIs
4. **Simpler Tooling**: One tool for linting, formatting, testing, bundling
5. **Standalone Executables**: `deno compile` creates single-file executables
6. **Better Performance**: V8 optimizations and faster startup
7. **First-Class TypeScript**: No configuration needed

## Migration Strategy

This PR takes an **incremental approach**:

1. ✅ Create parallel Deno files (`.deno.ts`) alongside Node.js files
2. ⏳ Test and validate Deno versions independently
3. ⏳ Once fully working, remove Node.js versions
4. ⏳ Update documentation and deployment

This allows:
- Testing Deno version without breaking Node.js version
- Gradual migration with lower risk
- Easy rollback if issues are discovered

## Rollback Plan

All original Node.js files remain unchanged. If the Deno migration encounters blocking issues:
1. Delete `.deno.ts` files
2. Delete `deno.json`
3. Continue using Node.js version

## Questions or Issues?

See `DENO_MIGRATION.md` for detailed information about:
- Node.js to Deno API mappings
- Dependency migration strategies
- Step-by-step conversion guide
- Common pitfalls and solutions

## Estimated Total Effort

- **Completed**: ~8 hours (configuration, core files, documentation)
- **Remaining**: ~22-32 hours (source migration, tests, validation)
- **Total**: ~30-40 hours for complete migration

## Next Steps

1. Review this PR and provide feedback
2. Decide if the Deno migration should proceed
3. If approved, continue with source file migration
4. Run comprehensive testing
5. Update deployment pipeline
