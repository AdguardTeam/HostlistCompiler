import { defineStore } from 'pinia';

export interface BenchmarkResult {
    duration: string;
    rulesPerSecond: number;
}

export interface CompilationResult {
    success: boolean;
    ruleCount: number;
    sources: number;
    transformations: string[];
    message?: string;
    benchmark: BenchmarkResult;
}

// Pinia store used by the Nuxt app.
// Note: stores under poc/vue/nuxt/stores/ are not auto-imported;
// import useCompilerStore explicitly where it is used.
export const useCompilerStore = defineStore('compiler', {
    state: () => ({
        urls: [''] as string[],
        selectedTransformations: [] as string[],
        isLoading: false,
        result: null as CompilationResult | null,
        error: null as string | null,
    }),

    getters: {
        compiledCount(state): number {
            return state.result ? state.result.ruleCount : 0;
        },
        canCompile(state): boolean {
            return state.urls.some((url) => url.trim() !== '') && !state.isLoading;
        },
    },

    actions: {
        addUrl() {
            this.urls.push('');
        },
        removeUrl(index: number) {
            if (this.urls.length > 1) {
                this.urls.splice(index, 1);
            }
        },
        toggleTransformation(name: string) {
            const index = this.selectedTransformations.indexOf(name);
            if (index > -1) {
                this.selectedTransformations.splice(index, 1);
            } else {
                this.selectedTransformations.push(name);
            }
        },
        setTransformations(transformations: string[]) {
            this.selectedTransformations = transformations;
        },
        resetCompilation() {
            this.result = null;
            this.error = null;
        },
        setLoading(loading: boolean) {
            this.isLoading = loading;
        },
        setError(error: string | null) {
            this.error = error;
        },
        setResult(result: CompilationResult) {
            this.result = result;
        },
    },
});
