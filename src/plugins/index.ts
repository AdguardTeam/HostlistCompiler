/**
 * Plugin system exports
 */

export { createSimplePlugin, globalRegistry, PluginRegistry, PluginTransformationWrapper } from './PluginSystem.ts';

export type { DownloaderPlugin, Plugin, PluginContext, PluginLoadOptions, PluginManifest, TransformationPlugin } from './PluginSystem.ts';

/**
 * @deprecated `loadPlugin` has been removed from the public API. Dynamic plugin loading
 * is Deno-specific and not compatible with JSR publishing. In Deno environments, import
 * directly from `./PluginLoader.deno.ts` instead.
 * @throws {Error} Always throws to indicate that this API is no longer supported.
 */
export function loadPlugin(..._args: unknown[]): never {
    throw new Error(
        'loadPlugin() has been removed from the public API. ' +
            'In Deno environments, import { loadPlugin } from "./plugins/PluginLoader.deno.ts" instead.',
    );
}
