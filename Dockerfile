# Multi-stage Dockerfile for hostlist-compiler
# Dependencies are cached until package.json/pnpm-lock.yaml change
# Each stage can be built independently via --target

FROM adguard/node-ssh:22.23--0 AS base
SHELL ["/bin/bash", "-lc"]

WORKDIR /hostlist-compiler

# pnpm store directory — set once here, no need for pnpm config set in every RUN
ENV npm_config_store_dir=/pnpm-store

# ============================================================================
# Stage: deps
# Cached until package.json/pnpm-lock.yaml changes
# ============================================================================
FROM base AS deps

COPY package.json pnpm-lock.yaml ./

# --ignore-scripts: this project has no native/build-time dependency scripts,
# so skipping them keeps the install hermetic and avoids running arbitrary
# postinstall code from the dependency tree.
RUN --mount=type=cache,target=/pnpm-store,id=hostlist-compiler-pnpm \
    pnpm install \
        --frozen-lockfile \
        --prefer-offline \
        --ignore-scripts

# ============================================================================
# Stage: source
# Cached until source code changes
# Has source + node_modules
# ============================================================================
FROM deps AS source

COPY . /hostlist-compiler

# ============================================================================
# Stage: test
# Runs ESLint and Jest unit tests. build is chained on top of this stage so the
# quality gate is executed exactly once per pipeline instead of being repeated
# in both the test and build Docker builds.
# ============================================================================
FROM source AS test

RUN pnpm lint && \
    pnpm test && \
    mkdir -p /out && \
    touch /out/test-passed.txt

FROM scratch AS test-output
COPY --from=test /out/ /

# ============================================================================
# Stage: build
# Reuses the test stage (gate already passed there) and creates the npm
# package tarball.
# ============================================================================
FROM test AS build

RUN pnpm pack --out hostlist-compiler.tgz && \
    mkdir -p /out/artifacts && \
    cp hostlist-compiler.tgz /out/artifacts/

FROM scratch AS build-output
COPY --from=build /out/artifacts/ /
