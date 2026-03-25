# Development Guide

This document explains how to set up the development environment, run the
project locally, and contribute code to Hostlist Compiler.

For code guidelines and architectural decisions, see [AGENTS.md](AGENTS.md).

## Prerequisites

- **Node.js** — current LTS version (20.x or later)
- **Yarn** — classic (1.x)
- **Git**

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/AdguardTeam/HostlistCompiler.git
   cd HostlistCompiler
   ```

2. Install dependencies:

   ```bash
   yarn install
   ```

3. Verify the setup by running linter and tests:

   ```bash
   yarn lint
   yarn test
   ```

## Available Commands

| Command | Description |
|---------|-------------|
| `yarn install` | Install all dependencies |
| `yarn lint` | Run ESLint (`airbnb-base` config) |
| `yarn test` | Run Jest test suite (`--runInBand --detectOpenHandles`) |
| `yarn increment` | Bump the patch version in `package.json` |
| `yarn build-txt` | Generate transformations documentation |
| `yarn compile` | Run the compiler CLI (`node src/cli.js`) |

## Running the Compiler Locally

**With a configuration file** (full-featured mode):

```bash
node src/cli.js -c examples/sdn/configuration.json -o filter.txt
```

**Quick hosts conversion** (simple mode):

```bash
node src/cli.js -i hosts.txt -o output.txt
```

**With verbose logging**:

```bash
node src/cli.js -c examples/sdn/configuration.json -o filter.txt -v
```

The `examples/` directory contains several ready-made configurations (`sdn`,
`energized`, `china`, `whitelist`) that can be used for testing.

## Development Workflow

### Making Changes

1. Create a feature branch from `master`.
2. Make your changes in `src/`.
3. Add or update tests in `test/` — mirror the source file structure.
4. Run the full verification sequence:

   ```bash
   yarn lint
   yarn test
   ```

5. Fix any issues until both commands pass.

### Running Tests

Run the full test suite:

```bash
yarn test
```

Run a specific test file:

```bash
npx jest test/rule.test.js --runInBand
```

Run tests matching a pattern:

```bash
npx jest --testNamePattern="compress" --runInBand
```

Tests use `mock-fs` for filesystem mocking and `nock` for HTTP request
interception. Test fixtures live in `test/resources/`.

### Linting

```bash
yarn lint
```

ESLint is configured in `.eslintrc.js` with the `airbnb-base` preset. The
`.eslintignore` file excludes non-source directories from linting.

## Common Tasks

### Adding a New Transformation

1. Create a new module in `src/transformations/` exporting a single async
   function.
2. Register the transformation in `src/transformations/transform.js` — the
   order in `transform.js` determines execution order (not configuration order).
3. Add the transformation name to the JSON schema in
   `src/schemas/configuration.schema.json`.
4. Update `src/index.d.ts` with the new transformation name in the type union.
5. Create a test file in `test/transformations/`.
6. Update `CHANGELOG.md`.
7. Run `yarn lint && yarn test`.

### Updating the Configuration Schema

The configuration is validated by AJV against the JSON schema at
`src/schemas/configuration.schema.json`. When adding new fields:

1. Update the schema with the new property definition.
2. Update `src/index.d.ts` with the corresponding TypeScript type.
3. Add test cases in `test/configuration.test.js`.

## Troubleshooting

### Tests Hang or Time Out

Tests run with `--runInBand --detectOpenHandles`. If a test hangs, it usually
means an HTTP mock (`nock`) was not set up correctly or a filesystem mock
(`mock-fs`) was not restored. Check that `nock.cleanAll()` and
`mock.restore()` are called in `afterEach` or `afterAll`.

### ESLint Cache Issues

If linting gives unexpected results after changing `.eslintrc.js`, clear the
cache:

```bash
rm -f .eslintcache
yarn lint
```

### Network Errors When Running the Compiler

The compiler downloads remote filter lists. If you're behind a proxy or
firewall, sources may fail to download. Use local file paths in your
configuration for offline development.

## Additional Resources

- [README.md](README.md) — user documentation, configuration format, and
  transformation reference
- [AGENTS.md](AGENTS.md) — code guidelines and contribution rules
- [CHANGELOG.md](CHANGELOG.md) — release history
