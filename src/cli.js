#! /usr/bin/env node

const fs = require('fs');
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
    .help('h')
    .alias('h', 'help');

if (argv.verbose) {
    // trace level
    consola.level = 5;
}

consola.info(`Starting ${packageJson.name} v${packageJson.version}`);

if (!fs.existsSync(argv.config)) {
    consola.error(`File ${argv.config} not found!`);
    return 1;
}

async function main() {
    try {
        const config = JSON.parse(fs.readFileSync(argv.config).toString());
        const lines = await compile(config);

        consola.info(`Writing output to ${argv.output}`);
        fs.writeFileSync(argv.output, lines.join('\n'));
        consola.info('Finished compiling');
    } catch (ex) {
        consola.error(ex);
        process.exit(1);
    }
}

main();
return 0;
