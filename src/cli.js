#! /usr/bin/env node

const fs = require('fs').promises;
const consola = require('consola');
const compile = require('./index');
const packageJson = require('../package.json');

// eslint-disable-next-line import/order
const { argv } = require('yargs')
    .usage('Usage: $0 [options]')
    .example(
        '$0 -c config.json -o output.txt',
        'compile a blocklist and write the output to output.txt',
    )
    .example(
        '$0 -i https://example.org/hosts.txt -o output.txt',
        'compile a blocklist from the URL and write the output to output.txt',
    )
    .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Path to the compiler configuration file',
        nargs: 1,
    })
    .option('input', {
        alias: 'i',
        array: true,
        type: 'string',
        // eslint-disable-next-line max-len
        description: 'URL (or path to a file) to convert to an AdGuard-syntax blocklist. Can be specified multiple times.',
    })
    .option('input-type', {
        alias: 't',
        type: 'string',
        description: 'Type of the input file (/etc/hosts, adguard)',
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
    .demandOption(['o'])
    .version()
    .help('h')
    .alias('h', 'help');

if (argv.verbose) {
    // trace level.
    consola.level = 5;
}

consola.info(`Starting ${packageJson.name} v${packageJson.version}`);

/**
 * Reads the configuration file and returns the parsed JSON.
 *
 * @returns {Promise<Object> | Promise<Error>} configuration file as JSON.
 */
async function readConfig() {
    consola.debug(`Reading configuration from ${argv.config}`);

    // Check if the configuration file exists.
    await fs.access(argv.config);
    const configStr = (await fs.readFile(argv.config)).toString();

    return JSON.parse(configStr);
}

/**
 * Creates a configuration object for the specified blocklist source.
 * We assume that the input is a /etc/hosts file.
 *
 * @returns {Object} configuration object.
 */
function createConfig() {
    const inputType = argv['input-type'] || 'hosts';

    consola.debug(`Creating configuration for input ${argv.input} of type ${inputType}`);

    const config = {
        name: 'Blocklist',
        sources: [],
        transformations: [
            'RemoveComments',
            'Deduplicate',
            'Compress',
            'Validate',
            'TrimLines',
            'InsertFinalNewLine',
        ],
    };

    argv.input.forEach((input) => {
        config.sources.push({
            source: input,
            type: inputType,
        });
    });

    return config;
}

async function main() {
    try {
        if (!argv.input && !argv.config) {
            throw new Error('Either --input or --config must be specified');
        }

        const config = argv.input ? createConfig() : await readConfig();

        consola.debug(`Configuration: ${JSON.stringify(config, 0, 4)}`);

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
