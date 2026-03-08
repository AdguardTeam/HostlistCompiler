/**
 * @module cli
 * Public API for the AdBlock Compiler command-line interface.
 *
 * Exports the {@link CliApp} class and the top-level {@link main} function used
 * by both the Node.js (`src/cli.ts`) and Deno (`src/cli.deno.ts`) entry points.
 */
export { CliApp, main } from './CliApp.deno.ts';
