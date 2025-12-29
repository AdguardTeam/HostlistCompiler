#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net
import { main } from './cli/CliApp.deno.ts';

await main();
