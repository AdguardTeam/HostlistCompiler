const config = require('../src/configuration');
const { TRANSFORMATIONS } = require('../src/transformations/transform');

describe('createConfiguration', () => {
    it('test createConfiguration with default source type and pipeline', () => {
        const configuration = config.createConfiguration(['hosts.txt', 'hosts2.txt']);

        expect(configuration.name).toBe('Blocklist');
        expect(configuration.sources).toEqual([
            { source: 'hosts.txt', type: 'hosts' },
            { source: 'hosts2.txt', type: 'hosts' },
        ]);
        expect(configuration.transformations).toEqual([
            TRANSFORMATIONS.RemoveComments,
            TRANSFORMATIONS.Deduplicate,
            TRANSFORMATIONS.Compress,
            TRANSFORMATIONS.Validate,
            TRANSFORMATIONS.TrimLines,
            TRANSFORMATIONS.InsertFinalNewLine,
        ]);

        const ret = config.validateConfiguration(configuration);
        expect(ret.valid).toBe(true);
        expect(ret.errorsText).toBeNull();
    });

    it('test createConfiguration with the specified source type', () => {
        const configuration = config.createConfiguration(['rules.txt'], { type: 'adblock' });

        expect(configuration.sources).toEqual([
            { source: 'rules.txt', type: 'adblock' },
        ]);
    });
});

describe('Configuration', () => {
    it('test invalid configuration', () => {
        const ret = config.validateConfiguration({
            name: 'test',
        });
        expect(ret.valid).toBe(false);
        expect(ret.errorsText).toContain('sources');
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
