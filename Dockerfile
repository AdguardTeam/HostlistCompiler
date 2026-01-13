# Multi-stage build for adblock-compiler with Cloudflare Worker support
# This Dockerfile creates a container that can run both the compiler CLI and the web UI
# Version: 0.7.11

# Build argument for Deno version
ARG DENO_VERSION=2.6.3

# Stage 1: Node.js image for building with Wrangler
FROM node:20-bookworm-slim AS node-base

ARG DENO_VERSION

# Install required packages
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    ca-certificates \
    dnsutils \
    --no-install-recommends && \
    update-ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Download and install Deno
# Note: Using --no-check-certificate as a workaround for Docker build environment SSL issues
# In production, certificates should be properly configured
RUN wget --no-check-certificate https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip -O /tmp/deno.zip && \
    unzip /tmp/deno.zip -d /tmp && \
    chmod +x /tmp/deno && \
    mv /tmp/deno /usr/local/bin/deno && \
    rm /tmp/deno.zip

# Verify Deno installation
RUN deno --version

WORKDIR /app

# Stage 2: Dependencies and build
FROM node-base AS builder

# Copy package files for npm dependencies
COPY package.json package-lock.json ./

# Install npm dependencies (Wrangler)
RUN npm ci --omit=dev

# Copy Deno configuration (deno.lock excluded as it's not tracked in this repo)
COPY deno.json ./

# Copy source files
COPY src ./src
COPY worker ./worker
COPY public ./public

# Copy configuration files
COPY wrangler.toml ./
COPY tsconfig.json ./

# Note: Skipping CLI build due to JSR (JavaScript Registry) access issues during Docker build
# JSR may not be accessible in some Docker build environments due to network restrictions or SSL issues
# The container will run the Wrangler dev server instead
# For CLI usage, build the executable outside Docker and mount it as a volume

# Stage 3: Production runtime
FROM node-base AS runtime

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy node_modules from builder (for Wrangler)
COPY --from=builder /app/node_modules ./node_modules

# Copy all application files
COPY --from=builder /app/deno.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/public ./public
COPY --from=builder /app/wrangler.toml ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/package.json ./

# Note: CLI executable not included in this image due to JSR access limitations during build
# Use Wrangler dev server for the web UI and API

# Create a non-root user
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Expose the default Wrangler port
EXPOSE 8787

# Set environment variables
ENV DENO_DIR=/app/.deno
ENV PORT=8787

# Health check using curl (installed in runtime stage)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8787/api || exit 1

# Default command: run Wrangler dev server
CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787"]
