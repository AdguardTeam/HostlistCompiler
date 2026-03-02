<script setup lang="ts">
import { useCompilerStore, type CompilationResult } from '~/stores/compiler';

definePageMeta({ title: 'Compiler' });

const route = useRoute();
const store = useCompilerStore();

// Nuxt Pattern: useHead() with computed values for dynamic page titles
useHead(computed(() => ({
    title: `Compiler${route.params.preset ? ` — ${String(route.params.preset)}` : ''} — Adblock Compiler`,
})));

const PRESET_CONFIGS: Record<string, Record<string, boolean>> = {
    dns:     { RemoveComments: true, Deduplicate: true, Validate: true },
    clean:   { RemoveComments: true, TrimLines: true, RemoveEmptyLines: true },
    minimal: { Deduplicate: true, InsertFinalNewLine: true },
};

const ALL_TRANSFORMATIONS = [
    'RemoveComments', 'Compress', 'RemoveModifiers', 'Validate', 'ValidateAllowIp',
    'Deduplicate', 'InvertAllow', 'RemoveEmptyLines', 'TrimLines', 'InsertFinalNewLine', 'ConvertToAscii',
];

const transformations = reactive<Record<string, boolean>>(
    Object.fromEntries(ALL_TRANSFORMATIONS.map((name) => [name, name === 'RemoveComments' || name === 'Deduplicate'])),
);

const activePreset = computed(() => route.params.preset ? String(route.params.preset) : null);

const applyPreset = (presetId: string | null | undefined) => {
    ALL_TRANSFORMATIONS.forEach((key) => { transformations[key] = false; });
    if (presetId && PRESET_CONFIGS[presetId]) {
        Object.entries(PRESET_CONFIGS[presetId]).forEach(([key, value]) => {
            if (key in transformations) transformations[key] = value;
        });
    } else {
        transformations.RemoveComments = true;
        transformations.Deduplicate = true;
    }
    store.setTransformations(
        Object.entries(transformations).filter(([, v]) => v).map(([k]) => k),
    );
};

onMounted(() => {
    applyPreset(activePreset.value);
});

watch(() => route.params.preset, (newPreset) => {
    applyPreset(newPreset ? String(newPreset) : null);
});

const handleCompile = async () => {
    const validUrls = store.urls.filter((url) => url.trim() !== '');
    if (validUrls.length === 0) {
        store.resetCompilation();
        store.setError('Please enter at least one URL');
        return;
    }

    const payload = {
        configuration: {
            name: 'Nuxt PoC Compilation',
            sources: validUrls.map((url) => ({ source: url })),
            transformations: store.selectedTransformations,
        },
        benchmark: true,
    };

    store.setLoading(true);
    store.resetCompilation();

    try {
        // Nuxt Pattern: $fetch is Nuxt's isomorphic fetch utility.
        // It works on both server and client, with automatic base URL handling.
        const result = await $fetch('/api/compile', {
            method: 'POST',
            body: payload,
        });
        store.setResult(result as CompilationResult);
    } catch (err) {
        // Mock fallback for PoC demo when API is not available
        console.log('API call failed (expected in PoC), showing mock data:', err);
        store.setResult({
            success: true,
            ruleCount: 1234,
            sources: validUrls.length,
            transformations: store.selectedTransformations,
            message: 'Mock compilation result (API not available in PoC)',
            benchmark: { duration: '123ms', rulesPerSecond: 10000 },
        });
    } finally {
        store.setLoading(false);
    }
};
</script>

<template>
    <div>
        <h1>Compiler</h1>
        <p class="mb-2" style="color: var(--text-muted)">
            Configure and compile your filter lists
        </p>

        <div v-if="activePreset" class="preset-badge">
            🎯 Preset loaded: {{ activePreset }}
        </div>

        <form @submit.prevent="handleCompile">
            <div class="form-section">
                <h3>Filter List URLs</h3>
                <div class="url-list">
                    <div v-for="(url, index) in store.urls" :key="index" class="url-input-row">
                        <input
                            v-model="store.urls[index]"
                            type="url"
                            class="input"
                            placeholder="https://example.com/filters.txt"
                        />
                        <button
                            v-if="store.urls.length > 1"
                            type="button"
                            class="btn btn-danger"
                            @click="store.removeUrl(index)"
                        >
                            Remove
                        </button>
                    </div>
                </div>
                <button type="button" class="btn btn-secondary" @click="store.addUrl()">
                    + Add URL
                </button>
            </div>

            <div class="form-section">
                <h3>Transformations</h3>
                <div class="transformations-grid">
                    <label v-for="name in ALL_TRANSFORMATIONS" :key="name" class="checkbox-label">
                        <input
                            type="checkbox"
                            :checked="store.selectedTransformations.includes(name)"
                            @change="store.toggleTransformation(name)"
                        />
                        <span>{{ name }}</span>
                    </label>
                </div>
            </div>

            <button type="submit" class="btn btn-primary" :disabled="store.isLoading">
                {{ store.isLoading ? 'Compiling...' : '🚀 Compile' }}
            </button>
        </form>

        <div v-if="store.isLoading" class="loading">
            <div class="spinner"></div>
            <p>Compiling filter lists...</p>
        </div>

        <div v-if="store.error" class="alert alert-error mt-2">
            <strong>❌ Error:</strong> {{ store.error }}
        </div>

        <div v-if="store.result" class="results-container">
            <h3>✅ Compilation Results</h3>
            <div class="results-code">
                <pre>{{ JSON.stringify(store.result, null, 2) }}</pre>
            </div>
        </div>

        <div class="alert alert-info mt-2">
            <strong>🍍 Nuxt + Pinia Pattern:</strong> This component uses the same Pinia store as the
            Vue CDN PoC, but in Nuxt 3 the store state is SSR-hydrated automatically via
            <code>@pinia/nuxt</code>. The server serialises store state into the HTML payload;
            the client picks it up without an extra round-trip. Visit the
            <NuxtLink to="/store">🍍 Pinia Store</NuxtLink> page to inspect live state.
            <br /><br />
            <strong>⚡ Nuxt Pattern:</strong> <code>$fetch()</code> is used instead of bare
            <code>fetch()</code>. It is isomorphic — on the server it uses Node's http stack;
            on the client it uses the browser's Fetch API — with no code change needed.
        </div>
    </div>
</template>
