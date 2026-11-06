const consola = require('consola');
const mockHttp = require('./helpers/http-mock');
const compile = require('../src/index');

describe('Hostlist compiler', () => {
    it('compile from multiple sources', async () => {
        // Prepare source 1
        const scope = mockHttp('https://example.org')
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

    it('does not expose source credentials in the compiled list or logs', async () => {
        const scope = mockHttp('https://example.org')
            .get('/source.txt', { Authorization: 'Basic dXNlcjpzZWNyZXQ=' })
            .reply(200, '||example.org', {
                'Content-Type': 'text/plain',
            });

        const configuration = {
            name: 'Test filter',
            homepage: 'https://user:secret@example.org/',
            sources: [
                {
                    source: 'https://user:secret@example.org/source.txt',
                },
            ],
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            const list = await compile(configuration);
            const compiledList = list.join('\n');

            expect(compiledList).toContain('! Source: https://example.org/source.txt');
            expect(compiledList).toContain('! Homepage: https://example.org/');
            expect(compiledList).not.toContain('secret');

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('secret');
            });

            const configurationMessage = infoMessages
                .find((message) => message.startsWith('Configuration:'));
            expect(configurationMessage).toContain('"source": "https://example.org/source.txt"');
            expect(configurationMessage).toContain('"homepage": "https://example.org/"');
        } finally {
            infoSpy.mockRestore();
        }

        scope.done();
    });

    it('does not expose credentials with whitespace in the homepage or logs', async () => {
        const scope = mockHttp('https://example.org')
            .get('/source.txt')
            .reply(200, '||example.org', {
                'Content-Type': 'text/plain',
            });

        const configuration = {
            name: 'Test filter',
            homepage: 'https://user:p s s@example.org/',
            sources: [
                {
                    source: 'https://example.org/source.txt',
                },
            ],
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            const list = await compile(configuration);
            const compiledList = list.join('\n');

            expect(compiledList).toContain('! Homepage: https://example.org/');
            expect(compiledList).not.toContain('p s s');

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('p s s');
            });
        } finally {
            infoSpy.mockRestore();
        }

        scope.done();
    });

    it('does not expose source credentials when the configuration is invalid', async () => {
        const configuration = {
            name: 'Test filter',
            sources: [
                {
                    source: 'https://user:secret@example.org/source.txt',
                    transformations: ['NoSuchTransformation'],
                },
            ],
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            await expect(compile(configuration)).rejects.toThrow('Failed to validate configuration');

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('secret');
            });

            const validationMessage = infoMessages
                .find((message) => message.includes('ENUM should be equal to one of the allowed values'));
            expect(validationMessage).toContain('https://example.org/source.txt');
        } finally {
            infoSpy.mockRestore();
        }
    });

    it('does not modify the configuration passed to compile', async () => {
        const scope = mockHttp('https://example.org')
            .get('/source.txt')
            .reply(200, '||example.org', {
                'Content-Type': 'text/plain',
            });

        const configuration = {
            name: 'Test filter',
            sources: [
                {
                    source: 'https://user:secret@example.org/source.txt',
                },
            ],
        };

        await compile(configuration);

        expect(configuration.sources[0].source).toBe('https://user:secret@example.org/source.txt');

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
        const scope = mockHttp('https://example.org')
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
        const scope = mockHttp('https://example.org')
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
