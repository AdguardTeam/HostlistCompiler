<script setup lang="ts">
// Nuxt Pattern: definePageMeta() sets page-level metadata used by the router.
// The title is picked up by useHead() in a layout or middleware.
definePageMeta({
    title: 'Dashboard',
});

// Nuxt Pattern: useHead() renders <title> and <meta> tags on the server,
// so search engines and social media crawlers see them immediately.
useHead({ title: 'Dashboard — Adblock Compiler' });

const router = useRouter();

// Nuxt Pattern: useAsyncData() runs on both server AND client.
// On the server it fetches data and embeds it in the HTML payload.
// On the client it's hydrated without a second network request.
// This is the key SSR benefit: zero loading flash for initial data.
const { data: stats } = await useAsyncData('dashboard-stats', () =>
    Promise.resolve([
        { label: 'Filter Lists Compiled', value: '1,234' },
        { label: 'Total Rules Processed', value: '456K' },
        { label: 'Active Transformations', value: '12' },
        { label: 'Cache Hit Rate', value: '89%' },
    ]),
);

const presets = [
    { id: 'dns',     icon: '🛡️', name: 'DNS Safe',     description: 'Remove comments, deduplicate, validate for DNS-level blocking.' },
    { id: 'clean',   icon: '🧹', name: 'Clean & Trim', description: 'Remove comments, trim lines, and remove empty lines.' },
    { id: 'minimal', icon: '⚡', name: 'Minimal',      description: 'Deduplicate and insert a final newline only.' },
];

const launchPreset = (presetId: string) => {
    router.push(`/compiler/${presetId}`);
};
</script>

<template>
    <div>
        <h1>Adblock Compiler Dashboard</h1>
        <p class="mb-2" style="color: var(--text-muted)">
            Welcome to the Adblock Compiler.
            <span class="ssr-badge">✅ SSR</span>
            This page is server-rendered — stats are embedded in the HTML, not fetched after load.
        </p>

        <div class="stats-grid">
            <div v-for="(stat, index) in stats" :key="index" class="stat-card">
                <div class="stat-label">{{ stat.label }}</div>
                <div class="stat-value">{{ stat.value }}</div>
            </div>
        </div>

        <h2 style="margin: 24px 0 8px;">Quick Start with a Preset</h2>
        <p style="color: var(--text-muted); margin-bottom: 16px; font-size: 14px;">
            Click a preset to open the Compiler with transformations pre-selected.
            Uses <code>router.push('/compiler/:preset')</code> — programmatic navigation.
        </p>
        <div class="preset-grid">
            <div
                v-for="preset in presets"
                :key="preset.id"
                class="preset-card"
                @click="launchPreset(preset.id)"
            >
                <h4>{{ preset.icon }} {{ preset.name }}</h4>
                <p>{{ preset.description }}</p>
            </div>
        </div>

        <div class="alert alert-info mt-2">
            <strong>🚀 Nuxt SSR Pattern:</strong> This page uses <code>useAsyncData()</code> to fetch
            dashboard stats. On the server, data is fetched and serialised into the HTML response.
            On the client, Nuxt hydrates the page without re-fetching — eliminating loading flash.
            Compare this to the Vue CDN PoC where all data is initialised client-side only.
        </div>
    </div>
</template>
