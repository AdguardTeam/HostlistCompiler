/**
 * Vitest configuration for the Angular frontend
 *
 * Uses `@analogjs/vitest-angular` (the AnalogJS Vite plugin for Angular) to
 * provide the Angular compiler transform pipeline inside Vitest's Vite runtime.
 * This replaces the Karma + Jasmine setup that ships with the Angular CLI.
 *
 * Key choices:
 *
 * globals: true
 *   Exposes `describe`, `it`, `expect`, `beforeEach`, etc. as globals so that
 *   existing spec files (written in Jasmine style) work without import changes.
 *
 * environment: 'jsdom'
 *   Provides a DOM environment for component rendering tests, equivalent to
 *   what Karma/Chrome provided. For pure unit tests (services, pipes) this is
 *   not strictly required but keeps the setup uniform.
 *
 * setupFiles: ['src/test-setup.ts']
 *   Imports `@angular/compiler` before any spec runs. The Angular compiler must
 *   be loaded before TestBed is used — this is the analogue of the
 *   `setupFilesAfterFramework` pattern used in jest-preset-angular.
 *
 * Coverage via v8
 *   Uses V8's built-in coverage instrumentation (no Babel transforms needed).
 *   Run `npm run test:coverage` to generate reports in `coverage/`.
 */

import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
    plugins: [
        angular({
            // Point to the spec tsconfig so Vitest inherits the correct
            // compiler options (strict mode, vitest/globals types, etc.)
            tsconfig: './tsconfig.spec.json',
        }),
    ],
    test: {
        // Expose Vitest globals (describe, it, expect, …) without explicit imports.
        // Matches the Jasmine-style API used in the existing spec files.
        globals: true,

        // jsdom provides window, document, and the full DOM API for component tests.
        environment: 'jsdom',

        // Run Angular compiler setup before any spec file is imported.
        setupFiles: ['src/test-setup.ts'],

        // Discover all Angular spec files under src/.
        include: ['src/**/*.spec.ts'],

        // Verbose reporter shows individual test names — useful where
        // the test list is short and educational.
        reporters: ['verbose'],

        coverage: {
            // V8 provider uses native V8 coverage — fast and zero-config.
            provider: 'v8',

            // Generate text summary (terminal), JSON (CI ingestion), and HTML
            // (human-readable report at coverage/index.html).
            reporter: ['text', 'json', 'html'],

            // Measure coverage across all app source files …
            include: ['src/app/**/*.ts'],

            // … but exclude the spec files themselves from the report.
            exclude: ['src/app/**/*.spec.ts'],
        },
    },
});
