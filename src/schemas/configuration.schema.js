/* eslint-disable max-len -- schema descriptions are long human-readable strings */

const { TRANSFORMATIONS } = require('../transformations/enum');
const { SOURCE_TYPES } = require('../source-types');
const { buildSchemaConflictRules } = require('../validation-conflicts');

/**
 * A list of the transformations that will be applied. The accepted names are
 * derived from the `TRANSFORMATIONS` enum and the conflict rules are generated
 * from src/validation-conflicts.js, so the schema cannot drift from the code.
 */
const transformations = {
    description: 'A list of the transformations that will be applied',
    type: 'array',
    allOf: buildSchemaConflictRules(),
    items: {
        type: 'string',
        enum: Object.values(TRANSFORMATIONS),
    },
};

/**
 * A JSON-schema fragment for a configuration property that is a list of strings.
 *
 * @param {string} description - human-readable description of the property.
 * @returns {Object} the JSON-schema fragment (type: 'array', items: string).
 */
function stringArray(description) {
    return {
        description,
        type: 'array',
        items: {
            type: 'string',
        },
    };
}

// Shared between the top level and the source level, like `transformations`.
const exclusions = stringArray('A list of rules (or wildcards) to exclude from the source.');
const exclusionsSources = stringArray('An array of exclusions sources.');
const inclusions = stringArray("A list of wildcards to include from the source. All rules that don't match these wildcards won't be included.");
const inclusionsSources = stringArray('A list of files with inclusions.');

const schema = {
    $id: 'https://adguard.com/hostlist-compiler.configuration.schema',
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Hostlist compiler configuration',
    description: 'Configuration for the hostlist compiler',
    type: 'object',
    properties: {
        name: {
            description: 'Filter list name',
            type: 'string',
            minLength: 1,
        },
        description: {
            description: 'Filter list description',
            type: 'string',
        },
        homepage: {
            description: 'Filter list homepage',
            type: 'string',
        },
        license: {
            description: 'Filter list license',
            type: 'string',
        },
        version: {
            description: 'Filter version',
            type: 'string',
        },
        sources: {
            description: 'An array of the filter list sources',
            type: 'array',
            minItems: 1,
            items: {
                $ref: '#/definitions/source',
            },
        },
        transformations,
        exclusions,
        exclusions_sources: exclusionsSources,
        inclusions,
        inclusions_sources: inclusionsSources,
    },
    required: [
        'name',
        'sources',
    ],
    additionalProperties: false,
    definitions: {
        source: {
            description: 'A source for the filter list',
            type: 'object',
            properties: {
                name: {
                    description: 'Name of the source',
                    type: 'string',
                    minLength: 1,
                },
                source: {
                    description: 'Path to a file or a URL',
                    type: 'string',
                    minLength: 1,
                },
                type: {
                    description: 'Type of the source',
                    type: 'string',
                    enum: Object.values(SOURCE_TYPES),
                },
                transformations,
                exclusions,
                exclusions_sources: exclusionsSources,
                inclusions,
                inclusions_sources: inclusionsSources,
            },
            required: [
                'source',
            ],
            additionalProperties: false,
        },
    },
};

module.exports = schema;
