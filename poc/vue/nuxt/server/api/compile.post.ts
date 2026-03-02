// Nuxt Pattern: Files in server/api/ become API endpoints.
// The .post.ts suffix restricts this route to POST requests only.
// This proxy runs on the server, avoiding CORS issues that would occur
// if the browser called the Adblock Compiler API directly.
export default defineEventHandler(async (event) => {
    const body = await readBody(event);

    const runtimeConfig = useRuntimeConfig();
    const apiBaseUrl =
        (runtimeConfig as Record<string, unknown>).adblockCompilerBaseUrl as string |
        undefined ?? 'http://localhost:8787';

    try {
        const result = await $fetch(`${apiBaseUrl}/api/compile`, {
            method: 'POST',
            body,
        });
        return result;
    } catch (error) {
        const isDev = process.env.NODE_ENV === 'development';

        if (isDev) {
            // Mock fallback for PoC/demo in development
            const sources = body?.configuration?.sources ?? [];
            const transformations = body?.configuration?.transformations ?? [];
            return {
                success: true,
                ruleCount: 1234,
                sources: sources.length,
                transformations,
                message: 'Mock compilation result (API not available in PoC)',
                benchmark: { duration: '123ms', rulesPerSecond: 10000 },
            };
        }

        // In non-dev environments, surface an explicit error instead of returning mock success.
        throw createError({
            statusCode: 502,
            statusMessage: 'Bad Gateway',
            message: `Failed to reach Adblock Compiler API at ${apiBaseUrl}/api/compile`,
        });
    }
});
