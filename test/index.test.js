const nock = require('nock');
const consola = require('consola');
const compile = require('../src/index');

describe('Hostlist compiler', () => {
    it('compile from multiple sources', async () => {
        // Prepare source 1
        const scope = nock('https://example.org')
            .get('/source1.txt')
            .reply(200, '||example.org', {
                'Content-Type': 'text/plain',
            })
            .get('/source2.txt')
            .reply(200, '||example.com', {
                'Content-Type': 'text/plain',
            });

        // compiler configuration
        const configuration = {
            name: 'Test filter',
            description: 'Our test filter',
            version: '1.0.0.9',
            sources: [
                {
                    name: 'source 1',
                    source: 'https://example.org/source1.txt',
                },
                {
                    name: 'source 2',
                    source: 'https://example.org/source2.txt',
                },
            ],
        };

        // compile the final list
        const list = await compile(configuration);

        // assert
        expect(list).toContain('||example.org');
        expect(list).toContain('||example.com');
        expect(list).toContain('! Version: 1.0.0.9');

        const str = list.join('\n');
        consola.info(str);

        scope.done();
    });

    it('throws error when validation transformations are used at both source and top level', async () => {
        // No need to mock HTTP request - error is thrown before download
        const configuration = {
            name: 'Test filter',
            transformations: ['Validate'],
            sources: [
                {
                    source: 'https://example.org/source.txt',
                    transformations: ['ValidateAllowPublicSuffix'],
                },
            ],
        };

        await expect(compile(configuration)).rejects.toThrow(
            /Validation transformations cannot be used at both source and top level/,
        );
    });

    it('allows validation transformation at source level only', async () => {
        const scope = nock('https://example.org')
            .get('/source.txt')
            .reply(200, '||org^', {
                'Content-Type': 'text/plain',
            });

        const configuration = {
            name: 'Test filter',
            sources: [
                {
                    source: 'https://example.org/source.txt',
                    transformations: ['ValidateAllowPublicSuffix'],
                },
            ],
        };

        const list = await compile(configuration);
        expect(list.join('\n')).toContain('||org^');

        scope.done();
    });

    it('allows validation transformation at top level only', async () => {
        const scope = nock('https://example.org')
            .get('/source.txt')
            .reply(200, '||org^', {
                'Content-Type': 'text/plain',
            });

        const configuration = {
            name: 'Test filter',
            transformations: ['Validate'],
            sources: [
                {
                    source: 'https://example.org/source.txt',
                },
            ],
        };

        const list = await compile(configuration);
        expect(list.join('\n')).not.toContain('||org^');

        scope.done();
    });
});
