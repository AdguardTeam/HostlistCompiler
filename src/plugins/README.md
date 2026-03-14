# Plugin System

The adblock-compiler plugin system provides a **unified architecture** for extending all 10 compiler subsystems through a single registration channel.

## Quick Start

```ts
import { createSimplePlugin, globalRegistry, type Plugin } from './plugins/index.ts';

// Simplest: a transformation plugin
const myTransform = createSimplePlugin(
    'my-transform',
    '1.0.0',
    'lowercase',
    (rules) => rules.map((r) => r.toLowerCase()),
);
await globalRegistry.register(myTransform);
```

## Plugin Interface

A plugin is an object implementing the `Plugin` interface. All slot arrays are optional — provide only what your plugin needs:

```ts
const plugin: Plugin = {
    manifest: {
        name: 'my-plugin',
        version: '1.0.0',
        description: 'Example plugin',
        dependencies: ['other-plugin'], // optional inter-plugin deps
    },

    // Optional lifecycle hooks
    init: (ctx) => console.log('Plugin loaded'),
    cleanup: () => console.log('Plugin unloaded'),

    // Optional subsystem slots (provide any combination)
    transformations: [{ type: 'my-xform', execute: (rules) => rules }],
    formatters: [{ format: 'custom', formatterClass: MyFormatter }],
    validators: [{ name: 'my-check', validate: (config) => ({ valid: true, errorsText: null }) }],
    parsers: [{ name: 'my-parser', supportedSyntaxes: ['adblock'], parse: (input) => ({ type: 'Rule', raw: input }) }],
    diffReporters: [{ name: 'my-reporter', format: (report) => JSON.stringify(report) }],
    cacheBackends: [{ name: 'redis', createAdapter: (opts) => new RedisAdapter(opts) }],
    headerGenerators: [{ name: 'my-header', generate: (config) => ['! Custom header'] }],
    conflictResolvers: [{ name: 'my-resolver', resolve: (conflicts) => result }],
    eventHooks: [{ name: 'my-hooks', hooks: { onCompileStart: (e) => {} } }],
};
```

## Subsystem Slots

| Slot                | Interface                | Purpose                             |
| ------------------- | ------------------------ | ----------------------------------- |
| `transformations`   | `TransformationPlugin`   | Rule list transformations           |
| `downloaders`       | `DownloaderPlugin`       | Custom URL scheme fetchers          |
| `formatters`        | `FormatterPlugin`        | Output format handlers              |
| `validators`        | `ValidationPlugin`       | Configuration validators            |
| `parsers`           | `ParserPlugin`           | Rule parsing engines                |
| `diffReporters`     | `DiffReporterPlugin`     | Diff output formatters              |
| `cacheBackends`     | `CacheBackendPlugin`     | Storage adapter factories           |
| `headerGenerators`  | `HeaderGeneratorPlugin`  | Filter list header generators       |
| `conflictResolvers` | `ConflictResolverPlugin` | Rule conflict resolution strategies |
| `eventHooks`        | `EventHookPlugin`        | Compiler lifecycle event listeners  |

## Dependency Management

Plugins can declare dependencies on other plugins:

```ts
const plugin: Plugin = {
    manifest: {
        name: 'advanced-formatter',
        version: '1.0.0',
        dependencies: ['core-utils'], // must be registered first
    },
    // ...
};
```

Use `registerAll()` for automatic topological ordering:

```ts
import { globalRegistry } from './plugins/index.ts';

// Order doesn't matter — dependencies are resolved automatically
await globalRegistry.registerAll([advancedFormatter, coreUtils]);
```

Circular dependencies are detected and throw an error.

## SubsystemBridge

The `SubsystemBridge` connects plugin registration to real subsystem registries (e.g., `FormatterFactory`, `TransformationRegistry`). In production, pass a bridge to the `PluginRegistry` constructor:

```ts
const registry = new PluginRegistry(logger, {
    registerFormatter: (format, ctor) => FormatterFactory.register(format, ctor),
    registerTransformation: (type, exec) => transformationRegistry.register(type, exec),
    registerEventHooks: (hooks) => eventEmitter.registerHooks(hooks),
});
```

The bridge is optional — the registry works standalone for testing.

## Plugin Discovery

Scan a directory for plugin modules:

```ts
import { discoverPlugins } from './plugins/index.ts';

const plugins = await discoverPlugins('./my-plugins', {
    patterns: ['*.ts'],
    recursive: true,
});
await globalRegistry.registerAll(plugins);
```

## Built-in Plugins

- **AGTree Parser Plugin** (`agTreeParserPlugin`): Adapts the AGTree parser library into a `ParserPlugin` with parse, serialize, and walk support.

## Architecture

```
Plugin → PluginRegistry → SubsystemBridge → Subsystem Registries
                      ↓
              Internal Maps (formatter, validator, parser, etc.)
```

- **PluginRegistry** is the single registration channel
- **SubsystemBridge** forwards registrations to real factories/registries
- **Subsystem registries remain authoritative** — the plugin system is a channel, not a replacement
