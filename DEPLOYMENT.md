# Deployment — @adguard/hostlist-compiler

- [Deployment Summary](#deployment-summary)
- [Release Pipeline](#release-pipeline)
- [CI/CD](#cicd)
- [Environment Variables](#environment-variables)
- [Infrastructure Dependencies](#infrastructure-dependencies)
- [Logging](#logging)
- [Integrations](#integrations)
- [External Service Dependencies](#external-service-dependencies)
- [External Filter Sources](#external-filter-sources)
- [Error Reporting](#error-reporting)
- [Docker Build](#docker-build)
- [Local Build Commands](#local-build-commands)

## Deployment Summary

| Parameter         | Value                          |
| ----------------- | ------------------------------ |
| **npm package**   | `@adguard/hostlist-compiler`   |
| **Artifact**      | `hostlist-compiler.tgz`        |
| **Public mirror** | `AdguardTeam/HostlistCompiler` |
| **Slack channel** | `#adguard-filters-vcs`         |
| **npm bin**       | `hostlist-compiler`            |

## Release Pipeline

Releases follow the shared [ext-shared-actions][ext-shared-actions] pipeline.
For the full step-by-step documentation, see
[publish-release.md](https://github.com/AdGuardSoftwareLimited/ext-shared-actions/blob/master/docs/publish-release.md).

In short:

1. A maintainer runs `prepare-release.yml` manually with a target tag
   (e.g. `v2.1.0`) to open a release-bump PR that finalizes `CHANGELOG.md`.
2. Merging the release-bump PR triggers `publish-release.yml`, which tags
   the release commit, builds and tests, publishes to npm via OIDC trusted
   publishing, mirrors the tag to `AdguardTeam/HostlistCompiler`, drafts a
   GitHub Release with the changelog entries, and notifies Slack
   (`#adguard-filters-vcs`).

## CI/CD

| Workflow              | Trigger                                | Purpose                                                                  |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `ci.yml`              | PRs and pushes to `master`             | Lint, test, build inside Docker; upload `hostlist-compiler.tgz` artifact |
| `prepare-release.yml` | Manual (`workflow_dispatch` with tag)  | Open a release-bump PR that finalizes `CHANGELOG.md`                     |
| `publish-release.yml` | PR merged to `master` or manual re-run | Tag, build, publish to npm, mirror, draft GitHub Release, notify Slack   |
| `mirror.yml`          | Push to `master`                       | Mirror commits to `AdguardTeam/HostlistCompiler`                         |

All workflows reuse the shared pipeline definitions from
[ext-shared-actions][ext-shared-actions] and [actions][actions]. The
`publish-release.yml` trigger fires for any closed PR against `master`; the
called workflow only proceeds when the PR was actually merged and its head ref
starts with `release-bump/`, so closing an unrelated PR is a safe no-op.

**Concurrency**: `ci.yml` uses a concurrency group
`ci-${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`
to prevent redundant CI runs when a new push arrives for the same ref.
`publish-release.yml` uses a `publish-release` group with
`cancel-in-progress: false` to serialize release runs.

## Environment Variables

The compiler defines **no environment variables of its own**. To download
sources through a proxy, set `NODE_USE_ENV_PROXY=1` together with the
`HTTP_PROXY` (also used for `https://` when `HTTPS_PROXY` is unset),
`HTTPS_PROXY`, and `NO_PROXY` variables. The Node.js native `fetch` ignores
these variables unless `NODE_USE_ENV_PROXY=1` is set. All CI/CD
configuration (such as npm publish tokens, Octopass, and Slack webhooks) is
handled by the shared workflows and does not require per-project
configuration.

## Infrastructure Dependencies

The compiler is a **stateless CLI tool and library** with no database, cache,
or message queue dependencies. The only infrastructure requirement is:

| Dependency                  | Required | Purpose                                                                                        |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| **Outbound HTTP(S) access** | Yes      | Downloading remote filter sources and `!#include` directives via `@adguard/filters-downloader` |

Remote sources are downloaded over HTTP or HTTPS with the Node.js native
`fetch` (inside `@adguard/filters-downloader`), and the downloaded content is
compiled entirely in memory — nothing is persisted between runs. The Docker
base image (`adguard/node-ssh:22.22--0`) includes everything else needed to
run the CLI.

## Logging

The compiler uses `consola` (v2) for all diagnostics.

| Aspect          | Details                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| **Framework**   | `consola` with its default reporters                                     |
| **Output**      | `stdout` for `info`/`warn`/`debug`/`trace`, `stderr` for `error`/`fatal` |
| **Format**      | Plain text, consola default formatting                                   |
| **Levels**      | `fatal`, `error`, `warn`, `info`, `debug`, `trace` (consola levels 0-5)  |
| **Default**     | `info` level (3); `-v` / `--verbose` raises it to `trace` (5)            |
| **Persistence** | No log files, no rotation, no remote log shipping                        |

There is no log configuration file — the only knob is the `-v` / `--verbose`
CLI flag. Failures are logged via `consola.error` and the CLI exits with
code 1.

## Integrations

### External Service Dependencies

| Integration                                 | Purpose               | Configuration                                                                             |
| ------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| **npm registry**                            | Package distribution  | OIDC trusted publishing via the shared `publish-release` workflow. No long-lived tokens.  |
| **GitHub (`AdguardTeam/HostlistCompiler`)** | Public mirror         | SSH push via Octopass OIDC. Workflows are disabled in the mirror repo.                    |
| **Slack**                                   | Release notifications | `#adguard-filters-vcs` channel. Webhook managed by the shared `publish-release` workflow. |

### External Filter Sources

The compiler downloads filter lists at runtime from the URLs configured in
the compiler configuration (`sources`) and resolved `!#include` directives.
These URLs are user-defined — there are no hardcoded external services — but
the deployment environment must allow outbound HTTP(S) requests so that remote
sources can be fetched.

## Error Reporting

This project does **not** use an error reporting service (Sentry, Bugsnag,
or equivalent). Errors are logged to `stderr` via `consola.error` and the
CLI exits with code 1; when used as a library, errors are surfaced as thrown
`Error` / `TypeError` exceptions to the caller.

## Docker Build

The `Dockerfile` uses multi-stage builds based on `adguard/node-ssh:22.22--0`
(Node.js 22, pnpm 10 from the base image; the exact pnpm version is pinned in
the `engines` field of `package.json`):

| Stage                    | Purpose           | Key Steps                                                                        |
| ------------------------ | ----------------- | -------------------------------------------------------------------------------- |
| `base`                   | Shared foundation | Node.js 22, pnpm 10 (from base image), `npm_config_store_dir=/pnpm-store`        |
| `deps`                   | Dependency cache  | `pnpm install --frozen-lockfile --prefer-offline --ignore-scripts`               |
| `source`                 | Full source       | Copies project files over `deps`                                                 |
| `test` / `test-output`   | CI validation     | `pnpm lint && pnpm test`; `test-output` exports the passed-gate marker           |
| `build` / `build-output` | Artifact creation | `pnpm pack --out hostlist-compiler.tgz`; outputs the `.tgz`                      |

The dependency stage is cached by `package.json` and `pnpm-lock.yaml`. The
pnpm store cache is mounted at `/pnpm-store` with id `hostlist-compiler-pnpm`.

The table above summarizes the Dockerfile; the `Dockerfile` and the workflow
files in `.github/workflows/` are the source of truth for the exact stages,
flags, triggers, and concurrency settings.

### Local Build Commands

```bash
# Run CI validation (lint + tests)
docker build --target test-output .

# Produce the release artifact. The repo's package.json has no `version`
# field and `pnpm pack` requires one, so set it first — CI stamps the
# release version into package.json before building the image.
npm pkg set version=0.0.0-dev
docker build --target build-output --output ./artifacts .
# → ./artifacts/hostlist-compiler.tgz

# Restore package.json — the version was only set for the local build, and
# CI stamps the release version into the tracked file.
git checkout -- package.json
```

[ext-shared-actions]: https://github.com/AdGuardSoftwareLimited/ext-shared-actions
[actions]: https://github.com/AdGuardSoftwareLimited/actions
