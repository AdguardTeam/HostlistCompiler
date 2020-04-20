#! /usr/bin/env node

const fs = require('fs').promises;
const consola = require('consola');
const compile = require('./index');
const packageJson = require('../package.json');

// eslint-disable-next-line import/order
const { argv } = require('yargs')
    .usage('Usage: $0 [options]')
    .example('$0 -c config.json -o output.txt', 'compile a blocklist and write the output to output.txt')
    .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Path to the compiler configuration file',
        nargs: 1,
    })
    .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Path to the output file',
        nargs: 1,
    })
    .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Run with verbose logging',
    })
    .demandOption(['c', 'o'])
    .version()
    .help('h')
    .alias('h', 'help');

if (argv.verbose) {
    // trace level
    consola.level = 5;
}

consola.info(`Starting ${packageJson.name} v${packageJson.version}`);

async function main() {
    try {
        // Check if file exists
        await fs.access(argv.config);

        const configStr = (await fs.readFile(argv.config)).toString();
        const config = JSON.parse(configStr);
        const lines = await compile(config);

        consola.info(`Writing output to ${argv.output}`);
        await fs.writeFile(argv.output, lines.join('\n'));
        consola.info('Finished compiling');
    } catch (ex) {
        consola.error(ex);
        process.exit(1);
    }
}

main();
return 0;
