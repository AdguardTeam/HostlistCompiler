import { defineConfig } from 'prisma/config';

export default defineConfig({
    schema: './schema.prisma',
    migrations: {
        path: './migrations',
    },
    datasource: {
        // Prefer DIRECT_DATABASE_URL for migrations (bypasses connection pooling).
        // Fall back to DATABASE_URL, then local dev default.
        url: process.env.DIRECT_DATABASE_URL
            ?? process.env.DATABASE_URL
            ?? 'postgresql://adblock:adblock@127.0.0.1:5432/adblock_dev',
    },
});
