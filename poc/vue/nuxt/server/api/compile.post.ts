// Nuxt Pattern: Files in server/api/ become API endpoints.
// The .post.ts suffix restricts this route to POST requests only.
// This proxy runs on the server, avoiding CORS issues that would occur
// if the browser called the Adblock Compiler API directly.
export default defineEventHandler(async (event) => {
    const body = await readBody(event);

    // In production, proxy to the real API.
    // In PoC / dev mode, return mock data when the API isn't available.
    try {
        const result = await $fetch('http://localhost:8787/api/compile', {
            method: 'POST',
            body,
        });
        return result;
    } catch {
        // Mock fallback for PoC demo
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
});
