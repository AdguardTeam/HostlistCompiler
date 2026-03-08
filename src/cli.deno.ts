#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net
/**
 * @module cli.deno
 * Deno CLI entry point for the AdBlock Compiler.
 *
 * Bootstraps the command-line interface using the {@link main} function from the
 * Deno-specific CLI application module. Use this file when running directly with
 * Deno (e.g. `deno run --allow-read --allow-write --allow-net src/cli.deno.ts`).
 *
 * @see {@link ./cli/CliApp.deno.ts} for the underlying CLI implementation.
 */
import { main } from './cli/CliApp.deno.ts';

await main();
