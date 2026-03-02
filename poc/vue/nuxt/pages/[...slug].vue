<script setup lang="ts">
definePageMeta({ title: '404 Not Found' });
useHead({ title: '404 Not Found — Adblock Compiler' });

const route = useRoute();
const router = useRouter();
</script>

<template>
    <div style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 80px; margin-bottom: 20px;">🔍</div>
        <h1 style="margin-bottom: 12px;">404 - Page Not Found</h1>
        <p class="mb-2" style="color: var(--text-muted)">
            The page <code>{{ route.path }}</code> does not exist.
        </p>
        <button class="btn btn-primary" @click="router.push('/')">Go Home</button>
    </div>
</template>
