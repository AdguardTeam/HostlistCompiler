/**
 * Plugin Discovery
 *
 * Scans a directory for plugin modules and loads them for registration.
 * Each plugin file must export (default or named) a {@link Plugin} object.
 *
 * @module
 */

import type { Plugin, PluginLoadOptions } from './PluginSystem.ts';
import { loadPlugin } from './PluginLoader.deno.ts';

/**
 * Options for directory-based plugin discovery.
 */
export interface DiscoveryOptions extends PluginLoadOptions {
    /** Glob patterns to match plugin files (default: `['*.ts', '*.js']`) */
    patterns?: string[];
    /** Whether to recurse into subdirectories */
    recursive?: boolean;
    /**
     * Optional callback invoked when a matched plugin file fails to load.
     * If omitted, load errors are silently ignored.
     */
    onError?: (path: string, error: Error) => void;
}

/**
 * Scan a project-relative directory for plugin modules, load each one, and
 * return the resulting {@link Plugin} array (ready for `registerAll()`).
 *
 * **Only project-relative paths are supported** (e.g., `'./plugins'` or
 * `'plugins'`). Absolute system paths are rejected by the underlying
 * {@link loadPlugin} loader for security reasons.
 *
 * Load errors for matched files are surfaced via the `options.onError`
 * callback instead of being silently discarded.
 *
 * @param dir - Project-relative directory path (e.g. `'./my-plugins'`)
 * @param options - Discovery options (patterns, recursive, onError, etc.)
 * @returns Array of loaded Plugin objects
 *
 * @example
 * ```ts
 * const plugins = await discoverPlugins('./plugins', {
 *     onError: (p, err) => console.warn(`Skipping ${p}: ${err.message}`),
 * });
 * await registry.registerAll(plugins);
 * ```
 */
export async function discoverPlugins(
    dir: string,
    options?: DiscoveryOptions,
): Promise<Plugin[]> {
    const patterns = options?.patterns ?? ['*.ts', '*.js'];
    const recursive = options?.recursive ?? false;
    const plugins: Plugin[] = [];

    // Normalise dir so it always starts with './' exactly once, e.g.
    // './my-plugins' or 'my-plugins' → './my-plugins'; '../sibling' is left unchanged.
    const normalised = dir.startsWith('./') || dir.startsWith('../') ? dir : `./${dir}`;

    for await (const entry of Deno.readDir(normalised)) {
        if (entry.isDirectory && recursive) {
            const sub = await discoverPlugins(`${normalised}/${entry.name}`, options);
            plugins.push(...sub);
            continue;
        }

        if (!entry.isFile) continue;
        if (!patterns.some((p) => matchGlob(entry.name, p))) continue;

        // Skip test files
        if (/\.test\.[tj]s$/.test(entry.name)) continue;

        const importPath = `${normalised}/${entry.name}`;
        try {
            const plugin = await loadPlugin(importPath, options);
            plugins.push(plugin);
        } catch (err) {
            options?.onError?.(
                importPath,
                err instanceof Error ? err : new Error(String(err)),
            );
        }
    }

    return plugins;
}

/** Minimal glob matcher supporting `*` wildcards. */
function matchGlob(name: string, pattern: string): boolean {
    const regex = new RegExp(
        '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$',
    );
    return regex.test(name);
}
