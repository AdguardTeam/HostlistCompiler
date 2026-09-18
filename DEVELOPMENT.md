# Development Guide

This document explains how to set up the development environment, run the project locally, and contribute code to
Hostlist Compiler. For code guidelines and architectural decisions, see [AGENTS.md](AGENTS.md).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
    - [Cloning the Repository](#cloning-the-repository)
    - [Installing Dependencies](#installing-dependencies)
    - [Verifying the Setup](#verifying-the-setup)
- [Project Structure](#project-structure)
- [Available Commands](#available-commands)
- [Running the Compiler Locally](#running-the-compiler-locally)
- [Development Workflow](#development-workflow)
    - [Branching and Pull Requests](#branching-and-pull-requests)
    - [Making Changes](#making-changes)
    - [Running Tests](#running-tests)
    - [Linting](#linting)
    - [Commit Message Convention](#commit-message-convention)
- [Common Tasks](#common-tasks)
    - [Adding a New Transformation](#adding-a-new-transformation)
    - [Updating the Configuration Schema](#updating-the-configuration-schema)
    - [Bumping the Version](#bumping-the-version)
- [Debugging and IDE Setup](#debugging-and-ide-setup)
- [Troubleshooting](#troubleshooting)
    - [Tests Hang or Time Out](#tests-hang-or-time-out)
    - [ESLint Cache Issues](#eslint-cache-issues)
    - [Network Errors When Running the Compiler](#network-errors-when-running-the-compiler)
    - [pnpm Version Mismatch](#pnpm-version-mismatch)
- [Additional Resources](#additional-resources)

## Prerequisites

- **Node.js 22.22.2 or newer** — required by the `engines` field in `package.json`; the CI pipeline and the
  Docker image build with Node 22.
- **pnpm 10.x** — required by the `engines` field in `package.json` (use the exact version pinned there if pnpm
  reports a mismatch). Install with `npm install -g pnpm@10`.
- **Git** — for cloning the repository and managing branches.

## Getting Started

### Cloning the Repository

**Internal developers** (with access to the private repository where active development happens):

```bash
git clone git@github.com:AdGuardSoftwareLimited/filters-hostlist-compiler.git
cd filters-hostlist-compiler
```

**External contributors**: the public
[AdguardTeam/HostlistCompiler](https://github.com/AdguardTeam/HostlistCompiler)
mirror is read-only, so it cannot be used as a base for pull requests. Fork the
mirror, push your changes to the fork, and describe the proposed change in an
issue so maintainers can port it into the private repository.

### Installing Dependencies

```bash
pnpm install
```

### Verifying the Setup

Run the full verification sequence described in the [Build and Test Commands section of
AGENTS.md](AGENTS.md#build-and-test-commands) (`pnpm lint` and `pnpm test`) and make sure both finish without
errors.

## Project Structure

The full directory tree, including the layered architecture, is documented in the [Project Structure section of
AGENTS.md](AGENTS.md#project-structure).

## Available Commands

The [Build and Test Commands section of AGENTS.md](AGENTS.md#build-and-test-commands) is the single source of
truth for npm scripts. Running the compiler locally (`node src/cli.js` and its `pnpm compile` alias) and the
version bump (`pnpm increment`) are covered in [Running the Compiler Locally](#running-the-compiler-locally)
and [Bumping the Version](#bumping-the-version) below.

## Running the Compiler Locally

**With a configuration file** (full-featured mode):

```bash
node src/cli.js -c examples/sdn/configuration.json -o filter.txt
```

**Quick hosts conversion** (no configuration file needed):

```bash
node src/cli.js -i hosts.txt -o output.txt
```

All CLI flags (`-i` repeatable, `-t` input type, required `-o`, etc.) are documented in the [Usage section of
README.md](README.md#usage).

**With verbose logging** (trace-level `consola` output):

```bash
node src/cli.js -c examples/sdn/configuration.json -o filter.txt -v
```

The `pnpm compile` script is an alias for `node src/cli.js` and forwards its arguments:

```bash
pnpm compile -i hosts.txt -o output.txt
```

## Development Workflow

### Branching and Pull Requests

- Create a feature branch from `master` and push it to the remote.
- Open a pull request against `master`.
- CI runs on every pull request and every push to `master`: it lints the code, runs the test suite, and builds the npm
  package tarball. All checks must pass before merging.

### Making Changes

Make your changes in `src/` and follow the contribution rules in [AGENTS.md](AGENTS.md#contribution-instructions):
add or update tests in `test/` mirroring the source file structure, keep `CHANGELOG.md` up to date for
user-facing changes, and run the full verification sequence before pushing.

### Running Tests

Run the full test suite:

```bash
pnpm test
```

Run a single test file:

```bash
npx jest test/rule.test.js --runInBand
```

Run only tests matching a name pattern:

```bash
npx jest --testNamePattern="compress" --runInBand
```

The test setup (Jest flags, `silent` mode, `mock-fs`/`nock` mocking, fixture files) is described in the
[Testing section of AGENTS.md](AGENTS.md#testing).

### Linting

```bash
pnpm lint
```

ESLint (`pnpm lint:code`) and markdownlint (`pnpm lint:md`) enforce the rules described in the [Code
Quality](AGENTS.md#code-quality) and [Markdown Formatting](AGENTS.md#markdown-formatting) sections of
AGENTS.md. Both linters support auto-fixing:

```bash
pnpm exec eslint . --fix
pnpm exec markdownlint . --fix
```

### Commit Message Convention

Commit messages MUST follow the ticket-prefix convention (`AG-XXX` + short present-tense description) described in
the [Contribution Instructions section of AGENTS.md](AGENTS.md#contribution-instructions).

## Common Tasks

### Adding a New Transformation

1. Create a new module in `src/transformations/` exporting a single async function with a `(rules, ...) => rules`
   signature.
2. Register the transformation in the `TRANSFORMATIONS` enum in `src/transformations/enum.js` — the single source of
   truth for transformation names; the configuration schema derives its accepted names from it.
3. Register the transformation in `src/transformations/transform.js` — the order there determines execution order, not
   the order in the configuration.
4. If the new transformation is a *validation* transformation, also add it to `VALIDATION_TRANSFORMATIONS` in
   `src/transformations/enum.js` — it sits right below the enum, so adding a validator is a single-file change; the
   runtime conflict checks and the generated schema conflict rules are derived from that list.
5. Apply the documentation-sync rules from [AGENTS.md](AGENTS.md#configuration--documentation)
   (`src/schemas/configuration.schema.js`, `src/index.d.ts`, the order list in `README.md`, `CHANGELOG.md`).
6. Create a test file in `test/transformations/`.
7. Run `pnpm lint && pnpm test`.

### Updating the Configuration Schema

When adding or changing configuration fields, follow the documentation-sync rules in the
[Configuration & Documentation section of AGENTS.md](AGENTS.md#configuration--documentation), then:

1. Update the schema — it is a JS module, `src/schemas/configuration.schema.js`, not a JSON file. If the change
   touches transformation names, update the `TRANSFORMATIONS` enum in `src/transformations/enum.js` instead (the
   schema derives them from it); if it touches transformation conflicts, update `VALIDATION_TRANSFORMATIONS` in
   `src/transformations/enum.js` (the schema conflict rules are generated from it); if it touches source types,
   update `SOURCE_TYPES` in `src/source-types.js` (the schema derives the `type` enum from it).
2. Update the corresponding TypeScript types in `src/index.d.ts`.
3. Add test cases in `test/configuration.test.js`.

### Bumping the Version

```bash
pnpm increment
```

Bumps the patch version in `package.json` without creating a git tag. Preparing and publishing a release is automated
by the `prepare-release` and `publish-release` GitHub Actions workflows.

## Debugging and IDE Setup

- **Verbose logging**: pass `-v` to the CLI to enable trace-level `consola` output.
- **Node inspector**: run the CLI under the debugger:

  ```bash
  node --inspect-brk src/cli.js -c examples/sdn/configuration.json -o filter.txt
  ```

- **VS Code**: install the ESLint extension for in-editor diagnostics, and add a `launch.json` configuration that runs
  `src/cli.js` with the `-c`/`-o` arguments you want to debug.
- **Debugging a failing test**: run a single test file under the inspector:

  ```bash
  node --inspect-brk node_modules/.bin/jest test/rule.test.js --runInBand
  ```

## Troubleshooting

### Tests Hang or Time Out

Tests run with `--runInBand --detectOpenHandles`. If a test hangs, an HTTP mock (`nock`) was probably not set up
correctly or a filesystem mock (`mock-fs`) was not restored. Check that `nock.cleanAll()` and `mock.restore()` are
called in `afterEach` or `afterAll`.

### ESLint Cache Issues

ESLint caches results in `.eslintcache`. If linting gives unexpected results after changing `.eslintrc.js`, clear the
cache:

```bash
rm -f .eslintcache
pnpm lint
```

### Network Errors When Running the Compiler

Remote filter lists are downloaded by `@adguard/filters-downloader`. Behind a proxy or firewall, sources may fail
to download. Use local file paths in your configuration for offline development.

### pnpm Version Mismatch

The `engines` field in `package.json` requires a specific pnpm version. If pnpm reports a version mismatch, reinstall
the required version:

```bash
npm install -g pnpm@10
```

## Additional Resources

- [README.md](README.md) — user documentation, configuration format, and transformation reference
- [AGENTS.md](AGENTS.md) — code guidelines and contribution rules
- [CHANGELOG.md](CHANGELOG.md) — release history
