/**
 * Chart.js setup module for Adblock Compiler UI.
 * Imports Chart.js from npm, registers all components used by the UI, and
 * exposes `window.Chart` and `window.loadChart` so both module and non-module
 * inline scripts can use Chart.js without duplicating setup logic.
 *
 * Import this module in place of the old chart-loader / chart-setup pair:
 *   <script type="module" src="/js/chart.ts"></script>
 *
 * Inline scripts that previously called `await window.loadChart()` continue
 * to work unchanged — the function now returns a resolved Promise because
 * Chart.js is already initialised by the time the script tag executes.
 */

import {
    Chart,
    CategoryScale,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from 'chart.js';

// Register only components actually used by the UI (line charts only).
// ArcElement, BarElement, DoughnutController, PieController, and TimeScale
// were removed — no page uses bar, pie, doughnut, or time-axis charts.
Chart.register(
    CategoryScale,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Title,
    Tooltip,
);

declare global {
    interface Window {
        Chart: typeof Chart;
        loadChart: () => Promise<void>;
    }
}

// Expose Chart on window so inline <script> blocks can reference `Chart` directly.
window.Chart = Chart;

// Backward-compatible loadChart() shim — Chart is already initialised by the
// time any inline script calls this function, so we simply return a resolved
// promise.  Existing call-sites (index.html, compiler.html) require no changes.
window.loadChart = () => Promise.resolve();

export { Chart };
