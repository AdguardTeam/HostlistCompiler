#!/usr/bin/env node
/**
 * @module cli
 * Node.js CLI entry point for the AdBlock Compiler.
 *
 * Bootstraps the command-line interface using the {@link main} function exported
 * from the `cli` module. Use this file when running via Node.js (e.g. `node src/cli.ts`).
 *
 * @see {@link ./cli/CliApp.deno.ts} for the underlying CLI implementation.
 */
import { main } from './cli/index.ts';

main();
