// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-01-01',

    // Enable SSR (default, but explicit for clarity)
    ssr: true,

    // Modules
    modules: ['@pinia/nuxt'],

    // Global CSS
    css: ['~/assets/css/main.css'],

    // App-level head configuration (SSR-rendered)
    app: {
        head: {
            charset: 'utf-8',
            viewport: 'width=device-width, initial-scale=1',
            title: 'Nuxt PoC - Adblock Compiler',
            meta: [
                { name: 'description', content: 'Adblock Compiler - Nuxt 3 PoC with SSR' },
            ],
        },
    },

    // TypeScript
    typescript: {
        strict: true,
    },

    // Runtime config — values can be overridden via environment variables.
    // ADBLOCK_COMPILER_BASE_URL is read server-side only (not exposed to the client).
    runtimeConfig: {
        adblockCompilerBaseUrl: process.env.ADBLOCK_COMPILER_BASE_URL ?? 'http://localhost:8787',
    },

    devtools: { enabled: false },
});
