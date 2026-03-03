/**
 * Plugin loader for Deno environments.
 * This file is excluded from JSR publishing because it provides a Deno-specific,
 * runtime-dependent plugin loader that relies on dynamic imports not compatible
 * with JSR's publishing/static-analysis model.
 * For JSR users, construct Plugin objects directly and use PluginRegistry.register().
 */

import type { Plugin, PluginLoadOptions } from './PluginSystem.ts';

/**
 * Loads a plugin from a file path or URL.
 * This function is only available in Deno environments with the appropriate
 * runtime permissions (read for file paths, net for remote URLs).
 * For JSR/browser environments, construct Plugin objects directly.
 */
export async function loadPlugin(
    path: string,
    options?: PluginLoadOptions,
): Promise<Plugin> {
    const opts: Required<Omit<PluginLoadOptions, 'initTimeout'>> = {
        allowRemote: false,
        validateManifest: true,
        ...options,
    };

    // Check if it's a remote URL
    const isRemote = path.startsWith('http://') || path.startsWith('https://');
    if (isRemote && !opts.allowRemote) {
        throw new Error('Loading plugins from remote URLs is disabled');
    }

    try {
        // Dynamic import - requires Deno runtime with read (file paths) or net (remote URLs) permissions
        const module = await import(path);
        const plugin = module.default || module;

        // Validate manifest
        if (opts.validateManifest) {
            if (!plugin.manifest) {
                throw new Error('Plugin is missing manifest');
            }
            if (!plugin.manifest.name || typeof plugin.manifest.name !== 'string') {
                throw new Error('Plugin manifest is missing valid name');
            }
            if (!plugin.manifest.version || typeof plugin.manifest.version !== 'string') {
                throw new Error('Plugin manifest is missing valid version');
            }
        }

        return plugin as Plugin;
    } catch (error) {
        throw new Error(`Failed to load plugin from "${path}": ${error instanceof Error ? error.message : String(error)}`);
    }
}
