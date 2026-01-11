/**
 * Plugin system exports
 */

export {
    PluginRegistry,
    PluginTransformationWrapper,
    loadPlugin,
    createSimplePlugin,
    globalRegistry,
} from './PluginSystem.ts';

export type {
    PluginManifest,
    TransformationPlugin,
    DownloaderPlugin,
    Plugin,
    PluginContext,
    PluginLoadOptions,
} from './PluginSystem.ts';
