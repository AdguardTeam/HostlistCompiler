# AGENTS.md

Guidelines for AI agents working on this project.

## Table of Contents

- [Project Overview](#project-overview)
- [Technical Context](#technical-context)
- [Project Structure](#project-structure)
- [Build And Test Commands](#build-and-test-commands)
- [Contribution Instructions](#contribution-instructions)
- [Code Guidelines](#code-guidelines)
    - [System Design](#system-design)
    - [Architecture](#architecture)
    - [Code Quality](#code-quality)
    - [Testing](#testing)
    - [Dependency Management](#dependency-management)
    - [Configuration & Documentation](#configuration--documentation)
    - [Markdown Formatting](#markdown-formatting)
    - [Other](#other)

## Project Overview

**Hostlist Compiler** (`@adguard/hostlist-compiler`) is a Node.js CLI tool and
library for building DNS filter lists; see [README.md](README.md) for the
user-facing description. The sections below summarize what agents need to know
when working on this codebase.

It supports multiple input formats (`/etc/hosts`, adblock-style), configurable
transformations (compress, deduplicate, validate, remove comments, etc.),
inclusion/exclusion rules, and `!#include` directive resolution via
`@adguard/filters-downloader`.

## Technical Context

- **Language**: JavaScript (Node.js, CommonJS modules)
- **Node / pnpm Versions**: see the `engines` field in `package.json` (the
  single source of truth)
- **Primary Dependencies**:
    - `@adguard/filters-downloader` — resolves `!#include` directives and
      downloads remote sources
    - `ajv` / `ajv-errors` / `better-ajv-errors` — JSON schema validation for
      configuration
    - `lodash` — utility functions
    - `tldts` — TLD parsing for domain validation
    - `yargs` — CLI argument parsing
    - `consola` — logging
- **Testing**: Jest (`jest --runInBand --detectOpenHandles`, silent mode)
- **Linting**: ESLint with `airbnb-base` config and `@babel/eslint-parser`;
  markdownlint for Markdown files
- **Storage**: None (stateless CLI tool, reads remote/local files, writes output
  files)
- **Target Platform**: Node.js (CLI and library; published to npm)
- **Project Type**: Single package (CLI tool + library)
- **License**: GPL-3.0

## Project Structure

```text
├── src/                        # Main source code
│   ├── cli.js                  # CLI entry point (hashbang, yargs, config loading)
│   ├── index.js                # Library entry point: compile(configuration)
│   ├── index.d.ts              # TypeScript type declarations for consumers
│   ├── compile-source.js       # Downloads and compiles a single source
│   ├── configuration.js        # Configuration validation (AJV + schema)
│   ├── filter.js               # Include/exclude wildcard filtering, downloads
│   ├── rule.js                 # Rule parsing (adblock, /etc/hosts)
│   ├── ip-normalize.js         # Internal helper: IP rule normalization (used by transformations)
│   ├── utils.js                # String, IP, and wildcard utilities
│   ├── schemas/                # JSON schema for configuration validation
│   └── transformations/        # 15 transformations + fixed-order pipeline
│       ├── transform.js        # Pipeline orchestrator (TRANSFORMATIONS enum)
│       ├── exclude.js          # Exclusion rules (async, ungated)
│       ├── include.js          # Inclusion rules (async, ungated)
│       └── # ... (13 simple transforms: compress, validate, deduplicate, etc.)
├── test/                       # Jest test suites mirroring src/
│   ├── resources/              # Test fixture files
│   └── transformations/        # Transformation-specific tests
├── examples/                   # Example configurations (sdn, energized, china, whitelist)
├── .github/workflows/          # GitHub Actions CI (ci, mirror, prepare-release, publish-release)
├── Dockerfile                  # Multi-stage build: test-output / build-output targets
├── package.json                # Package manifest and scripts
├── jest.config.js              # Jest configuration
├── .eslintrc.js                # ESLint configuration (airbnb-base)
├── .markdownlint.json          # Markdownlint configuration
├── .markdownlintignore         # Files excluded from Markdown linting
├── CHANGELOG.md                # Release history
├── DEPLOYMENT.md               # Deployment, CI/CD and release documentation
├── DEVELOPMENT.md              # Environment setup guide (setup, not agent rules)
├── README.md                   # User documentation
└── LICENSE                     # GPL-3.0
```

## Build and Test Commands

**Full verification sequence** (run all of these before considering a task done):

```bash
pnpm lint
pnpm test
```

| Action        | Command                                              |
| ------------- | ---------------------------------------------------- |
| Install       | `pnpm install`                                       |
| Lint (all)    | `pnpm lint` (runs `lint:code` and `lint:md`)         |
| Lint code     | `pnpm lint:code` (ESLint, `airbnb-base` config)      |
| Lint markdown | `pnpm lint:md` (markdownlint)                        |
| Test          | `pnpm test` (`jest --runInBand --detectOpenHandles`) |

For running the CLI locally and bumping the version, see
[DEVELOPMENT.md](DEVELOPMENT.md).

## Contribution Instructions

- You MUST verify your work with the linter and the Markdown formatter. The
  project has no type checker (plain JavaScript); ESLint and markdownlint are
  the gates (see [Build and Test Commands](#build-and-test-commands)); use
  `pnpm exec eslint . --fix` and `pnpm exec markdownlint . --fix` to
  auto-fix issues.
- You MUST update or add unit tests for any changed or new code, mirroring the
  source file structure under `test/` (`<module>.test.js`).
- You MUST run `pnpm test` and confirm all tests pass — a task is not complete
  until all checks are green.
- When you change the project structure or add new build commands, update the
  Project Structure and Build And Test Commands sections in `AGENTS.md`.
- If a prompt asks you to refactor or improve existing code, check whether the
  insight can be phrased as a code guideline; if so, add it to the relevant
  Code Guidelines section in `AGENTS.md`.
- After completing a task, verify that the code you wrote follows the Code
  Guidelines in this file.
- Even when the task is to write or update a document (e.g. a plan or any
  Markdown file) rather than code, run `pnpm lint:md` to verify and fix
  Markdown formatting.
- Install dependencies with `pnpm install` before working.
- Do not commit generated files, `node_modules`, or editor configs.
- Do not create git commits or PRs unless explicitly asked.
- Keep documentation in sync as described in
  [Configuration & Documentation](#configuration--documentation) below.
- **Use ticket-prefixed commit messages**: Commit messages MUST start with the
  ticket number (`AG-XXX`) so they auto-link with the task tracker, followed
  by a short description in the present tense (e.g. `AG-1234 Fix login
  redirect`). Automated commits made by CI (e.g. the CHANGELOG finalization
  in the release-* PRs) use a [Conventional Commits] prefix such as `docs:`
  instead.

[Conventional Commits]: https://www.conventionalcommits.org/en/v1.0.0/

## Code Guidelines

### System Design

The package is both a CLI tool and a library, so both sets of rules apply:

- The CLI runs and exits — no long-lived state, no background daemons. It
  exits with code 0 on success and code 1 on failure; error handling is
  specified in [Code Quality](#code-quality).
- Write the compiled filter list to the required `-o` output file; use
  `consola` for diagnostics (`-v` / `--verbose` enables debug and trace).
- Be composable — support quick `hosts`-file conversion via `-i` without a
  configuration file, and full mode via `-c <config>`; sources can be local
  files or remote URLs.
- Fail fast with clear messages — validate the configuration with AJV before
  compiling; throw errors that include the invalid value so the user can fix
  it.
- Keep startup time fast — no heavy initialization on the CLI code path.
- As a library, `compile(configuration)` must not mutate global state
  (environment variables, process listeners); the only I/O it performs is the
  downloads explicitly requested by the configuration's sources.
- Export a stable public API (`compile`, configuration/source types) with
  complete TypeScript declarations in `src/index.d.ts`; internal functions are
  not exported.
- Handle errors by throwing descriptive `Error` / `TypeError` instances and
  let the caller decide how to recover; see the error-handling rules in
  [Code Quality](#code-quality).

### Architecture

The easiest way to achieve these principles is **layered architecture**.
This project's layers, from top to bottom:

```text
CLI entry (src/cli.js)
    ↓
Library entry / orchestration (src/index.js)
    ↓
Configuration validation (src/configuration.js, src/schemas/configuration.schema.json)
Per-source compilation (src/compile-source.js)
    ↓
Transformation pipeline (src/transformations/transform.js)
    ↓
Transformations (src/transformations/*.js)
    ↓
Rule parsing (src/rule.js)   Filtering (src/filter.js)   Utilities (src/utils.js)
    ↓
@adguard/filters-downloader (external package, downloads sources and includes)
```

Each layer may call the layers below it; no layer depends on a layer above it.
`utils.js` is the leaf module (only depends on `lodash`); there are no circular
dependencies.

Universal design principles the codebase should follow:

- **Separation of Concerns** — parsing, filtering, transformations, and
  configuration validation live in separate modules.
- **Single Responsibility Principle** — each transformation module does exactly
  one transformation; each module has one reason to change.
- **Dependency Direction** — dependencies point downward, from entry points to
  utilities; lower layers never import entry points.
- **Explicit Boundaries** — transformations communicate through
  `(rules, ...) => rules` signatures; the `TRANSFORMATIONS` enum is frozen.
- **Data Flow Clarity** — rules flow through a single fixed-order pipeline,
  making the data path predictable and traceable.
- **Minimize Coupling, Maximize Cohesion** — modules are self-contained and
  interact through narrow interfaces.
- **Make Invalid States Impossible** — configuration is validated against a
  JSON schema; incompatible transformation combinations are rejected at
  runtime and in the schema. Less critical at compile time: the project is
  plain JavaScript, so runtime validation carries this burden.
- **Observability Built-in** — all logging goes through `consola`; see the
  logging and error-handling rules in [Code Quality](#code-quality).
- **Keep It Boring** — plain CommonJS modules, no framework magic, simple
  synchronous or async transformation functions.

**Known exclusions** (to be fixed):

- Each item below is tracked in the issue tracker (see the `AG-…` comment on
  the item). Remove an entry as soon as it is fixed, so this list never drifts
  out of sync.
- Business logic in the CLI layer: `createConfig()` in `src/cli.js` hardcodes
  the default transformation pipeline and the `hosts` input type instead of
  delegating to a lower layer.
  <!-- AG-58264 -->
- Network I/O in the filtering layer: `src/filter.js` downloads exclusion and
  inclusion sources directly, duplicating the download call in
  `src/compile-source.js`; there is no central download layer.
  <!-- AG-58265 -->
- Validation-conflict rules are enforced in three places (JSON schema,
  `transform.js`, `index.js`), which can drift out of sync.
  <!-- AG-58267 -->
- `ajv-errors` is declared in `package.json` but never imported in `src/`.
  <!-- AG-58268 -->

### Code Quality

- **ESLint airbnb-base** rules apply — run `pnpm lint:code` to check; the
  project-specific overrides are configured in `.eslintrc.js` and not
  restated here.
- Use `lodash` helpers (e.g., `_.startsWith`, `_.isEmpty`, `_.trim`) where they
  are already used — stay consistent with the existing style.
- Prefer `for...of` loops over `Array.forEach` for async iteration (the
  codebase disables `no-restricted-syntax` where needed).
- Use JSDoc comments for public functions (parameters and return values), e.g.
  `transform()` in `src/transformations/transform.js`.
- Use `consola` for all logging (`consola.info`, `consola.debug`,
  `consola.error`). Do not use `console.log` / `console.error` directly.
- Throw descriptive `Error` (or `TypeError`) instances with messages that
  include the invalid input value — this helps users diagnose configuration
  and rule problems.
- Propagate errors up to the CLI entry point (`src/cli.js`), which catches
  them, logs via `consola.error`, and exits with code 1.

### Testing

- **Framework**: Jest, running in Node environment with `--runInBand
  --detectOpenHandles` and `silent: true`.
- **Mocking**: `mock-fs` for filesystem mocks, `nock` for HTTP request
  interception.
- Test files follow the naming convention `<module>.test.js` under `test/`,
  mirroring the structure of `src/`.
- Each transformation has its own test file under `test/transformations/`.
- Add or update tests for every changed or new code path; all tests must pass
  before a task is complete.

### Dependency Management

- **Pin all dependency versions explicitly** — all entries in `dependencies`
  and `devDependencies` in `package.json` use exact versions (no `^`/`~`
  ranges). When adding or updating a dependency, pin it to the version
  resolved in `pnpm-lock.yaml`; never lower a version below what the lockfile
  currently resolves to.
- **Prefer vanilla solutions** — use the language's standard library and
  built-in APIs when they adequately solve the problem. Only add a dependency
  when it provides significant value over a vanilla implementation.
- **Reputable sources only** — dependencies MUST come from well-established,
  actively maintained projects (npm download counts, repository activity,
  known maintainers).
- **Avoid unpopular libraries** — do NOT add niche or obscure packages with
  limited community adoption; they pose security risks and may become
  unmaintained.
- **Minimize dependency count** — each new dependency increases attack
  surface, bundle size, and maintenance burden. Justify every addition.
- **Use the latest stable version** — when adding a new dependency, check the
  package registry for the latest stable release and use it; do not copy
  outdated version numbers from memory or other projects.
- **Acknowledge the library-side trade-off** — exact pins favor reproducibility
  but hurt library consumers: duplicates of the same dependency may be
  installed alongside their own ranges, and transitive patches only arrive with
  a new release. This trade-off is deliberate; do not loosen pins without
  discussing the impact.

**Rationale**: Fewer, well-vetted dependencies reduce security
vulnerabilities, supply chain risks, and long-term maintenance costs.

### Configuration & Documentation

- The compiler is controlled by a JSON configuration object validated against
  `src/schemas/configuration.schema.json` (draft-07) via AJV; unknown keys are
  rejected (`additionalProperties: false`).
- Runtime behavior is selected via CLI flags (`-c` config file, `-i` quick
  hosts conversion, `-o` output file, `-v` verbose logging); there is no
  environment-variable configuration and no `.env` files.
- Example configurations live in `examples/` (`sdn`, `energized`, `china`,
  `whitelist`) and are used for manual testing.
- Keep documentation in sync with code: update `README.md` when adding or
  reordering transformations (the transformation order in `README.md` MUST
  match `src/transformations/transform.js`), update `CHANGELOG.md` for
  user-facing changes, update `src/schemas/configuration.schema.json` when
  adding configuration options, update `src/index.d.ts` when changing the
  public API, and update `DEPLOYMENT.md` when changing the Dockerfile, CI
  workflows, or deployment setup.
- No secrets or credentials are used anywhere in the project; configuration
  files are committed to the repository.

### Markdown Formatting

All Markdown files MUST pass markdownlint; the enforced rules live in
`.markdownlint.json` (plus markdownlint defaults) and are not restated here.
The following conventions go beyond what the linter enforces:

- **Line length**: Don't wrap lines artificially short — keep them close to
  the length limit configured in the linter where possible.
- **Continuation lines**: When a list item wraps to the next line, align the
  continuation with the first character of the item text, not the list
  marker. This applies to all list types (ordered and unordered).
- **Emphasis**: Use asterisks (`*`) for emphasis (`*italic*`, `**bold**`) —
  the linter only enforces a consistent style, not a specific one.

**Rationale**: Uniform Markdown formatting improves readability for both
humans and AI agents that consume project documentation.

### Other

- Do not restate rules that are configured in linter configs (`.eslintrc.js`,
  `.markdownlint.json`) — reference the config files instead; they are the
  source of truth.
- The transformation pipeline always runs in a fixed order regardless of the
  order specified in configuration (see
  [Configuration & Documentation](#configuration--documentation) for keeping
  `README.md` in sync).
- Any recurring agent error is a defect in this document. If you had to be
  corrected twice on the same issue, add a rule here to prevent it in the
  future.
