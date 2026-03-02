/**
 * Lazy-loader shim for chart-setup.ts.
 *
 * Exposes `window.loadChart()` so plain (non-module) inline scripts can
 * trigger the Chart.js bundle on demand without paying the cost at page load.
 *
 * Vite processes the dynamic import() here as a code-split entry, so
 * chart-setup.ts (and the Chart.js library) are bundled into a separate
 * chunk that is only fetched when `window.loadChart()` is first called.
 */

declare global {
    interface Window {
        loadChart: () => Promise<void>;
    }
}

window.loadChart = () => import('./chart-setup.ts').then(() => undefined);
