<script setup lang="ts">
// Nuxt Pattern: Auto-imported composables - no explicit import needed
const { theme, toggleTheme } = useTheme();
</script>

<template>
    <nav class="nav">
        <ul class="nav-links">
            <li>
                <NuxtLink to="/" class="nav-link">← PoC Overview</NuxtLink>
            </li>
            <li>
                <NuxtLink to="/" class="nav-link">🏠 Home</NuxtLink>
            </li>
            <li>
                <NuxtLink to="/compiler" class="nav-link">⚙️ Compiler</NuxtLink>
            </li>
            <li>
                <NuxtLink to="/store" class="nav-link">🍍 Pinia Store</NuxtLink>
            </li>
            <li>
                <NuxtLink to="/ssr" class="nav-link">🚀 SSR Features</NuxtLink>
            </li>
            <li>
                <NuxtLink to="/benchmark" class="nav-link">📊 Benchmark</NuxtLink>
            </li>
        </ul>
        <button class="theme-toggle" @click="toggleTheme">
            {{ theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode' }}
        </button>
    </nav>
</template>
