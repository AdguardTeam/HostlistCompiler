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
}

/**
 * Scan a directory for plugin modules, load each one, and return the
 * resulting {@link Plugin} array (ready for `registerAll()`).
 *
 * @param dir - Absolute or project-relative directory path
 * @param options - Discovery options (patterns, recursive, etc.)
 * @returns Array of loaded Plugin objects
 *
 * @example
 * ```ts
 * const plugins = await discoverPlugins('./plugins');
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

    for await (const entry of Deno.readDir(dir)) {
        if (entry.isDirectory && recursive) {
            const sub = await discoverPlugins(`${dir}/${entry.name}`, options);
            plugins.push(...sub);
            continue;
        }

        if (!entry.isFile) continue;
        if (!patterns.some((p) => matchGlob(entry.name, p))) continue;

        // Skip test files
        if (/\.test\.[tj]s$/.test(entry.name)) continue;

        try {
            const plugin = await loadPlugin(`./${dir}/${entry.name}`, options);
            plugins.push(plugin);
        } catch {
            // Skip files that aren't valid plugins
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
