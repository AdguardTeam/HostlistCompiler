<script setup lang="ts">
import { useCompilerStore } from '~/stores/compiler';

definePageMeta({ title: 'Pinia Store Inspector' });
useHead({ title: 'Pinia Store Inspector — Adblock Compiler' });

const store = useCompilerStore();

const testRemoveLastUrl = () => {
    if (store.urls.length > 1) {
        store.removeUrl(store.urls.length - 1);
    }
};
</script>

<template>
    <div>
        <h1>🍍 Pinia Store Inspector</h1>
        <p class="mb-2" style="color: var(--text-muted)">
            Live inspection of centralized application state managed by Pinia
            <span class="ssr-badge">✅ SSR Hydrated</span>
        </p>

        <div class="form-section">
            <h3>📊 Current State</h3>
            <div class="feature-card">
                <h4>URLs Array</h4>
                <div class="state-display">
                    <pre>{{ JSON.stringify(store.urls, null, 2) }}</pre>
                </div>
                <p style="color: var(--text-muted); font-size: 14px; margin-top: 8px;">
                    <strong>Length:</strong> {{ store.urls.length }} URL(s)
                </p>
            </div>

            <div class="feature-card">
                <h4>Selected Transformations</h4>
                <div class="state-display">
                    <pre>{{ JSON.stringify(store.selectedTransformations, null, 2) }}</pre>
                </div>
                <p style="color: var(--text-muted); font-size: 14px; margin-top: 8px;">
                    <strong>Count:</strong> {{ store.selectedTransformations.length }} transformation(s)
                </p>
            </div>

            <div class="feature-card">
                <h4>Loading State</h4>
                <div class="state-display">
                    <strong>isLoading:</strong> <code>{{ store.isLoading }}</code>
                </div>
            </div>

            <div class="feature-card">
                <h4>Compiled Count (Getter)</h4>
                <div class="state-display">
                    <strong>compiledCount:</strong> <code>{{ store.compiledCount }}</code>
                </div>
                <p style="color: var(--text-muted); font-size: 14px; margin-top: 8px;">
                    A <strong>Pinia getter</strong> — computed from <code>store.result?.ruleCount</code>.
                    Updates automatically when the result changes.
                </p>
            </div>
        </div>

        <div class="form-section">
            <h3>🎮 Test Actions</h3>
            <p style="color: var(--text-muted); margin-bottom: 16px; font-size: 14px;">
                Click the buttons to test Pinia store actions. State updates reactively above!
            </p>
            <div class="action-buttons">
                <button class="btn btn-primary" @click="store.addUrl()">➕ Add URL</button>
                <button
                    class="btn btn-danger"
                    :disabled="store.urls.length <= 1"
                    @click="testRemoveLastUrl"
                >
                    ➖ Remove Last URL
                </button>
                <button class="btn btn-secondary" @click="store.toggleTransformation('RemoveComments')">
                    🔄 Toggle RemoveComments
                </button>
                <button class="btn btn-secondary" @click="store.toggleTransformation('Compress')">
                    🔄 Toggle Compress
                </button>
            </div>
        </div>

        <div class="alert alert-info">
            <strong>🍍 Nuxt SSR + Pinia:</strong> In Nuxt 3, <code>@pinia/nuxt</code> automatically
            serialises store state into the server-rendered HTML payload. When the client loads,
            it hydrates from that payload — no re-fetch, no loading flash, no mismatch.
        </div>

        <div class="alert alert-success">
            <strong>✅ Why Pinia in Nuxt?</strong>
            <ul style="margin: 8px 0 8px 20px;">
                <li><strong>SSR Hydration</strong> — store state flows from server to client automatically</li>
                <li><strong>Centralized state</strong> — shared across all components and pages</li>
                <li><strong>DevTools integration</strong> — time-travel debugging in browser DevTools</li>
                <li><strong>Type safety</strong> — full TypeScript inference with no extra config</li>
                <li><strong>Plugin system</strong> — extend with persistence, logging, sync</li>
            </ul>
        </div>

        <div class="alert alert-info">
            <strong>🔗 Try it:</strong> Navigate to the
            <NuxtLink to="/compiler">⚙️ Compiler</NuxtLink> page, change some URLs or
            transformations, then come back here. State persists across routes because it lives
            in the Pinia store, not in component-local state!
        </div>
    </div>
</template>
