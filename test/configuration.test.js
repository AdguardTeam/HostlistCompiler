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
});
