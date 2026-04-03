const config = require('../src/configuration');

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
        ['ValidateAllowIp', 'ValidateAllowPublicSuffix'],
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
        ['ValidateAllowIp', 'ValidateAllowPublicSuffix'],
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
