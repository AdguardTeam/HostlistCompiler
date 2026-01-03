# Multi-stage build for adblock-compiler with Cloudflare Worker support
# This Dockerfile creates a container that can run both the compiler CLI and the web UI

# Stage 1: Base image with Deno
FROM denoland/deno:1.45.0 AS base

# Set working directory
WORKDIR /app

# Install Node.js and npm for Wrangler (Cloudflare Worker runtime)
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    --no-install-recommends && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Stage 2: Dependencies and build
FROM base AS builder

# Copy package files for npm dependencies
COPY package.json package-lock.json ./

# Install npm dependencies (Wrangler)
RUN npm ci

# Copy Deno configuration
COPY deno.json deno.lock ./

# Copy source files
COPY src ./src
COPY src-worker ./src-worker
COPY public ./public

# Copy configuration files
COPY wrangler.toml ./
COPY tsconfig.json ./

# Cache Deno dependencies
RUN deno cache src/index.ts

# Build the standalone CLI executable
RUN deno task build

# Stage 3: Production runtime
FROM base AS runtime

# Copy node_modules from builder (for Wrangler)
COPY --from=builder /app/node_modules ./node_modules

# Copy all application files
COPY --from=builder /app/deno.json /app/deno.lock ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/src-worker ./src-worker
COPY --from=builder /app/public ./public
COPY --from=builder /app/wrangler.toml ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/package.json ./

# Copy the built CLI executable
COPY --from=builder /app/hostlist-compiler ./hostlist-compiler

# Create a non-root user
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Expose the default Wrangler port
EXPOSE 8787

# Set environment variables
ENV DENO_DIR=/app/.deno
ENV PORT=8787

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8787/api || exit 1

# Default command: run Wrangler dev server
CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787"]
