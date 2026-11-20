const config = require('../src/configuration');
const { DEFAULT_TRANSFORMATIONS } = require('../src/transformations/transform');
const { TRANSFORMATIONS } = require('../src/transformations/enum');
const schema = require('../src/schemas/configuration.schema');

describe('createConfiguration', () => {
    it('test createConfiguration with default source type and pipeline', () => {
        const configuration = config.createConfiguration(['hosts.txt', 'hosts2.txt']);

        expect(configuration.name).toBe('Blocklist');
        expect(configuration.sources).toEqual([
            { source: 'hosts.txt', type: 'hosts' },
            { source: 'hosts2.txt', type: 'hosts' },
        ]);
        expect(configuration.transformations).toEqual([...DEFAULT_TRANSFORMATIONS]);

        const ret = config.validateConfiguration(configuration);
        expect(ret.valid).toBe(true);
        expect(ret.errorsText).toBeNull();
    });

    it('test createConfiguration with the specified source type', () => {
        const configuration = config.createConfiguration(['rules.txt'], 'adblock');

        expect(configuration.sources).toEqual([
            { source: 'rules.txt', type: 'adblock' },
        ]);
    });

    it('test createConfiguration falls back to hosts for an empty source type', () => {
        // The CLI passes `argv['input-type']` through; yargs yields an empty
        // string for `-t ''`, which must behave like the flag being absent.
        const configuration = config.createConfiguration(['hosts.txt'], '');

        expect(configuration.sources).toEqual([
            { source: 'hosts.txt', type: 'hosts' },
        ]);
    });

    it('test createConfiguration returns an independent transformations copy', () => {
        const configuration = config.createConfiguration(['hosts.txt']);

        // Each config must own its pipeline, so customizing it later cannot
        // leak into other configs or the frozen default constant.
        expect(configuration.transformations).not.toBe(DEFAULT_TRANSFORMATIONS);
        configuration.transformations.push(TRANSFORMATIONS.ConvertToAscii);
        expect(config.createConfiguration(['hosts.txt']).transformations).toEqual(DEFAULT_TRANSFORMATIONS);
        expect(configuration.transformations).not.toEqual(DEFAULT_TRANSFORMATIONS);
    });
});

describe('Configuration', () => {
    it('renders the transformations allowed-values in the original schema order', () => {
        // Pins the declaration order of the TRANSFORMATIONS enum: the schema's
        // items.enum is Object.values(TRANSFORMATIONS), and that order is what
        // the unknown-transformation error renders as the allowed-values list.
        const expected = [
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
        ];

        expect(schema.properties.transformations.items.enum).toEqual(expected);
        expect(schema.definitions.source.properties.transformations.items.enum).toEqual(expected);
    });

    it('test invalid configuration', () => {
        const ret = config.validateConfiguration({
            name: 'test',
        });
        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toContain('sources');
    });

    it('renders the additional property error with the 1.x wording', () => {
        // Pins the better-ajv-errors version choice: 2.x and 3.x render
        // "ADDITIONAL PROPERTY", and the pin exists to keep this text stable.
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    source: 'test.txt',
                    zzz: 1,
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toContain('ADDTIONAL PROPERTY should NOT have additional properties');
        expect(ret.errorsText).toContain('zzz is not expected to be here!');
    });

    it('test valid configuration', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    source: 'test.txt',
                },
            ],
        });
        expect(ret.valid).toBe(true);
        expect(ret.errorsText).toBeNull();
    });

    it('test many transformations configuration', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    source: 'test.txt',
                    transformations: [
                        'RemoveComments',
                        'RemoveModifiers',
                        'Compress',
                        'Validate',
                        'Deduplicate',
                        'InvertAllow',
                        'ConvertToAscii',
                    ],
                },
            ],
            transformations: [
                'RemoveComments',
                'RemoveModifiers',
                'Compress',
                'Validate',
                'Deduplicate',
                'InvertAllow',
                'ConvertToAscii',
            ],
        });
        expect(ret.valid).toBe(true);
        expect(ret.errorsText).toBeNull();
    });

    it('test invalid transformation', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    source: 'test.txt',
                    transformations: [
                        'Something',
                    ],
                },
            ],
            transformations: [
                'Something',
            ],
        });
        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toBeTruthy();
    });

    it('does not include source credentials in a validation error', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    source: 'https://user:secret@example.org/source.txt',
                    transformations: [
                        'NoSuchTransformation',
                    ],
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org/source.txt');
    });

    it.each([
        [
            'a misspelled key',
            {
                name: 'test',
                sources: [
                    {
                        source: 'test.txt',
                        exclusion_sources: ['https://user:secret@example.org/exclusions.txt'],
                    },
                ],
            },
        ],
        [
            'a string instead of a sources array',
            {
                name: 'test',
                sources: 'https://user:secret@example.org/source.txt',
            },
        ],
        [
            'a string instead of a source object',
            {
                name: 'test',
                sources: ['https://user:secret@example.org/source.txt'],
            },
        ],
        [
            'an array instead of a homepage string',
            {
                name: 'test',
                homepage: ['https://user:secret@example.org/'],
                sources: ['test.txt'],
            },
        ],
    ])('does not include credentials in a validation error for %s', (_, configuration) => {
        const ret = config.validateConfiguration(configuration);

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org/');
    });

    it('does not include credentials with whitespace in userinfo from a malformed source', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: ['https://user:p s s@example.org/source.txt'],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('p s s');
        expect(ret.errorsText).toContain('https://example.org/source.txt');
    });

    it.each([
        ['a quote in the username', "https://o'brien:secret@example.org/source.txt"],
        ['a space in the username', 'https://John Smith:secret@example.org/source.txt'],
        ['a space after the password colon', 'https://user: secret@example.org/source.txt'],
        ['a literal @ and a space in the password', 'https://user:p@s s@example.org/source.txt'],
    ])('does not include credentials with %s from a malformed source', (_, source) => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [source],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).not.toContain('p@s s');
        expect(ret.errorsText).toContain('https://example.org/source.txt');
    });

    it('does not include credentials from a quote username in a misspelled key', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    url: "https://o'brien:secret@example.org",
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org');
    });

    it('does not include a password with a leading space in a misspelled key', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    url: 'https://user: secret@example.org',
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org');
    });

    it('keeps prose that looks like a port in a validation error', () => {
        const description = 'https://example.org:8080 by admin@example.com';
        const ret = config.validateConfiguration({
            name: 'test',
            description,
            sources: [
                {
                    source: 'test.txt',
                    transformations: ['NoSuchTransformation'],
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toContain(description);
    });

    it.each([
        'Mirror at https://example.org:8080, contact admin@example.com',
        'Mirror at https://example.org:8080, contact admin@example.com/path',
        'Mirror at https://example.org:8080. Contact admin@example.com/path',
        'Mirror at https://example.org:8080; contact admin@example.com/path',
        'Mirror at https://example.org:8080) contact admin@example.com/path',
    ])('keeps prose with a port followed by punctuation in a validation error: %s', (description) => {
        const ret = config.validateConfiguration({
            name: 'test',
            description,
            sources: [
                {
                    source: 'test.txt',
                    transformations: ['NoSuchTransformation'],
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toContain(description);
    });

    it('keeps prose with a later URL in a validation error', () => {
        const description = 'Maintained at https://example.org by john@example.com. '
            + 'Forum: https://forum.example.org/';
        const ret = config.validateConfiguration({
            name: 'test',
            description,
            sources: [
                {
                    source: 'test.txt',
                    transformations: ['NoSuchTransformation'],
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toContain(description);
    });

    it('does not corrupt a validation error with a path-less URL and a later email', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            homepage: 'https://example.org',
            description: 'admin@example.com',
            sources: [
                {
                    source: 'test.txt',
                    transformations: ['NoSuchTransformation'],
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toContain('"homepage":"https://example.org"');
        expect(ret.errorsText).toContain('"description":"admin@example.com"');
        expect(ret.errorsText).toContain('"source":"test.txt"');
    });

    it('does not include a literal @ password from a path-less malformed source', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: ['https://user:p@s s@example.org'],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('p@s s');
        expect(ret.errorsText).toContain('https://example.org');
    });

    it('does not include credentials from a value under an unknown key', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    url: 'https://John Smith: secret@example.org',
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org');
    });

    it('does not include a numeric password from a value under an unknown key', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [{ source: 'test.txt' }],
            unknown: 'https://user:1234, secret@example.org/list.txt',
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org/list.txt');
    });

    it('does not throw on an additional property URL key with whitespace in userinfo', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [{ source: 'test.txt' }],
            'https:John Smith:pa ss@example.org': 'value',
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('pa ss');
        expect(ret.errorsText).toContain('https:example.org');
    });

    it('does not throw on a nested additional property URL key with a path', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    source: 'test.txt',
                    'https://user:p"s@example.org/key.txt': 'value',
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('p"s');
        expect(ret.errorsText).toContain('https://example.org/key.txt');
    });

    it('does not include free-text credentials from a validation error', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            description: 'Mirror https://John Smith: secret@example.org',
            sources: [
                {
                    source: 'test.txt',
                    transformations: ['NoSuchTransformation'],
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('Mirror https://example.org');
    });

    it('keeps prose with a label after a URL in a validation error', () => {
        const description = 'https://example.org team: contact@example.com';
        const ret = config.validateConfiguration({
            name: 'test',
            description,
            sources: [
                {
                    source: 'test.txt',
                    transformations: ['NoSuchTransformation'],
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toContain(description);
    });

    it('does not include credentials from a prefixed homepage', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            homepage: ' https://user:secret@example.org/',
            sources: ['test.txt'],
            transformations: ['NoSuchTransformation'],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org/');
    });

    it('does not include credentials from a URL object key in a validation error', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: {
                'https://user:secret@example.org/source.txt': {},
            },
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org/source.txt');
    });

    it('does not include credentials from a serialized object in a validation error', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            homepage: {
                toJSON() {
                    return 'https://user:secret@example.org/';
                },
            },
            sources: ['test.txt'],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org/');
    });

    it('does not include a quote username from a serialized object without a path', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            homepage: {
                toJSON() {
                    return "https://o'brien:secret@example.org";
                },
            },
            sources: ['test.txt'],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org');
    });

    it('does not include credentials from a URL object in a validation error', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            homepage: new URL('https://user:secret@example.org/'),
            sources: ['test.txt'],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).not.toContain('secret');
        expect(ret.errorsText).toContain('https://example.org/');
    });

    it('test ValidateAllowPublicSuffix transformation in configuration', () => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    source: 'test.txt',
                    transformations: [
                        'ValidateAllowPublicSuffix',
                    ],
                },
            ],
            transformations: [
                'ValidateAllowPublicSuffix',
            ],
        });

        expect(ret.valid).toBe(true);
        expect(ret.errorsText).toBeNull();
    });

    it.each([
        ['Validate', 'ValidateAllowIp'],
        ['Validate', 'ValidateAllowPublicSuffix'],
        ['Validate', 'ValidateAllowIpAndPublicSuffix'],
        ['ValidateAllowIp', 'ValidateAllowPublicSuffix'],
        ['ValidateAllowIp', 'ValidateAllowIpAndPublicSuffix'],
        ['ValidateAllowPublicSuffix', 'ValidateAllowIpAndPublicSuffix'],
    ])('test incompatible top-level transformations configuration: %s + %s', (first, second) => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    source: 'test.txt',
                },
            ],
            transformations: [
                first,
                second,
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toBeTruthy();
    });

    it.each([
        ['Validate', 'ValidateAllowIp'],
        ['Validate', 'ValidateAllowPublicSuffix'],
        ['Validate', 'ValidateAllowIpAndPublicSuffix'],
        ['ValidateAllowIp', 'ValidateAllowPublicSuffix'],
        ['ValidateAllowIp', 'ValidateAllowIpAndPublicSuffix'],
        ['ValidateAllowPublicSuffix', 'ValidateAllowIpAndPublicSuffix'],
    ])('test incompatible source transformations configuration: %s + %s', (first, second) => {
        const ret = config.validateConfiguration({
            name: 'test',
            sources: [
                {
                    source: 'test.txt',
                    transformations: [
                        first,
                        second,
                    ],
                },
            ],
        });

        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toBeTruthy();
    });
});
