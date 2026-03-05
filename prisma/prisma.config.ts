import { defineConfig } from 'prisma/config';

export default defineConfig({
    schema: './schema.prisma',
    migrations: {
        path: './migrations',
    },
    datasource: {
        // Prefer DIRECT_DATABASE_URL for migrations (bypasses connection pooling).
        // Fall back to DATABASE_URL. Set these in .env.local (see .env.example).
        // Run `cp .env.example .env.local` and fill in your connection strings.
        url: process.env.DIRECT_DATABASE_URL
            ?? process.env.DATABASE_URL
            ?? (() => { throw new Error('DIRECT_DATABASE_URL or DATABASE_URL must be set. See .env.example for guidance.'); })(),
    },
});
