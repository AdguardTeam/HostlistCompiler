/* eslint-disable max-len -- schema descriptions are long human-readable strings */

const { buildSchemaConflictRules } = require('../validation-conflicts');

/**
 * A list of the transformations that will be applied. The conflict rules are
 * generated from src/validation-conflicts.js, the single source of truth for
 * validation-conflict rules, so the schema cannot drift from the runtime checks.
 */
const TRANSFORMATIONS = {
    description: 'A list of the transformations that will be applied',
    type: 'array',
    allOf: buildSchemaConflictRules(),
    items: {
        type: 'string',
        enum: [
            'RemoveComments',
            'RemoveModifiers',
            'Compress',
            'Validate',
            'ValidateAllowIp',
            'ValidateAllowPublicSuffix',
            'ValidateAllowIpAndPublicSuffix',
            'Deduplicate',
            'InvertAllow',
            'RemoveEmptyLines',
            'TrimLines',
            'InsertFinalNewLine',
            'ConvertToAscii',
        ],
    },
};

const schema = {
    $id: 'https://adguarad.com/hostlist-compiler.configuration.schema.json',
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
        transformations: TRANSFORMATIONS,
        exclusions: {
            description: 'A list of rules (or wildcards) to exclude from the source.',
            type: 'array',
            items: {
                type: 'string',
            },
        },
        exclusions_sources: {
            description: 'An array of exclusions sources.',
            type: 'array',
            items: {
                type: 'string',
            },
        },
        inclusions: {
            description: "A list of wildcards to include from the source. All rules that don't match these wildcards won't be included.",
            type: 'array',
            items: {
                type: 'string',
            },
        },
        inclusions_sources: {
            description: 'A list of files with inclusions.',
            type: 'array',
            items: {
                type: 'string',
            },
        },
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
                    enum: [
                        'adblock',
                        'hosts',
                    ],
                },
                transformations: TRANSFORMATIONS,
                exclusions: {
                    description: 'A list of rules (or wildcards) to exclude from the source.',
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                exclusions_sources: {
                    description: 'An array of exclusions sources.',
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                inclusions: {
                    description: "A list of wildcards to include from the source. All rules that don't match these wildcards won't be included.",
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                inclusions_sources: {
                    description: 'A list of files with inclusions.',
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
            },
            required: [
                'source',
            ],
            additionalProperties: false,
        },
    },
};

module.exports = schema;
