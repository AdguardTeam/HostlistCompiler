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

    it.each([
        ['a leading space', ' https://user:secret@example.org/', ' https://example.org/'],
        ['a tab', '\thttps://user:secret@example.org/', '\thttps://example.org/'],
        ['angle brackets', '<https://user:secret@example.org/>', '<https://example.org/>'],
        ['a double quote', '"https://user:secret@example.org/"', '"https://example.org/"'],
        ['a quote in the username', "https://o'brien:secret@example.org", 'https://example.org'],
        ['a space in the username', 'https://John Smith:secret@example.org', 'https://example.org'],
        ['a space after the password colon', 'https://user: secret@example.org', 'https://example.org'],
    ])('does not expose credentials in a homepage with %s', async (_, homepage, sanitizedHomepage) => {
        const scope = mockHttp('https://example.org')
            .get('/source.txt')
            .reply(200, '||example.org', {
                'Content-Type': 'text/plain',
            });

        const configuration = {
            name: 'Test filter',
            homepage,
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

            expect(compiledList).toContain(`! Homepage: ${sanitizedHomepage}`);
            expect(compiledList).not.toContain('secret');

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('secret');
            });
        } finally {
            infoSpy.mockRestore();
        }

        scope.done();
    });

    it('does not expose a literal @ password in a path-less homepage', async () => {
        const scope = mockHttp('https://example.org')
            .get('/source.txt')
            .reply(200, '||example.org', {
                'Content-Type': 'text/plain',
            });

        const configuration = {
            name: 'Test filter',
            homepage: 'https://user:p@s s@example.org',
            exclusions: ['@@||good.example^'],
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

            expect(compiledList).toContain('! Homepage: https://example.org');
            expect(compiledList).not.toContain('p@s s');

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('p@s s');
            });

            const configurationMessage = infoMessages
                .find((message) => message.startsWith('Configuration:'));
            expect(configurationMessage).toContain('"homepage": "https://example.org"');
            expect(configurationMessage).toContain('"@@||good.example^"');
        } finally {
            infoSpy.mockRestore();
        }

        scope.done();
    });

    it('does not corrupt the configuration log for a path-less URL and a later email', async () => {
        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            await compile({
                name: 'Test filter',
                homepage: 'https://example.org',
                description: 'admin@example.com',
                sources: [{ source: 'test/resources/rules.txt' }],
            });

            const configurationMessage = infoSpy.mock.calls
                .map(([message]) => String(message))
                .find((message) => message.startsWith('Configuration:'));

            expect(configurationMessage).toContain('"homepage": "https://example.org"');
            expect(configurationMessage).toContain('"description": "admin@example.com"');
            expect(configurationMessage).toContain('"source": "test/resources/rules.txt"');
        } finally {
            infoSpy.mockRestore();
        }
    });

    it('does not expose credentials in any header field', async () => {
        const scope = mockHttp('https://example.org')
            .get('/source.txt')
            .reply(200, '||example.org', {
                'Content-Type': 'text/plain',
            });

        const configuration = {
            name: 'Filter https://user:secret@example.org/name',
            description: 'Mirror https://user:secret@example.org/list.txt',
            version: '1.0 https://user:secret@example.org/version',
            license: 'See https://user:secret@example.org/license',
            sources: [
                {
                    name: 'Source https://user:secret@example.org/name',
                    source: 'https://example.org/source.txt',
                },
            ],
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            const list = await compile(configuration);
            const compiledList = list.join('\n');

            expect(compiledList).toContain('! Title: Filter https://example.org/name');
            expect(compiledList).toContain('! Description: Mirror https://example.org/list.txt');
            expect(compiledList).toContain('! Version: 1.0 https://example.org/version');
            expect(compiledList).toContain('! License: See https://example.org/license');
            expect(compiledList).toContain('! Source name: Source https://example.org/name');
            expect(compiledList).not.toContain('secret');
        } finally {
            infoSpy.mockRestore();
        }

        scope.done();
    });

    it.each([
        [
            'a space in the username and after the password colon',
            'Mirror https://John Smith: secret@example.org',
            'Mirror https://example.org',
        ],
        [
            'a space in the username before trailing text',
            'Mirror https://John Smith:sekret@example.org by admin@example.com',
            'Mirror https://example.org by admin@example.com',
        ],
        [
            'a quote in the username before trailing text',
            "Mirror https://o'brien:sekret@example.org by admin@example.com",
            'Mirror https://example.org by admin@example.com',
        ],
        [
            'a whitespace password with a quote in the username',
            "Mirror https://o'brien:pass phrase@example.org",
            'Mirror https://example.org',
        ],
        [
            'a whitespace password with a space in the username',
            'Mirror https://John Smith:pass phrase@example.org',
            'Mirror https://example.org',
        ],
        [
            'a numeric password followed by punctuation',
            'Mirror https://user:1234, secret@example.org/list.txt',
            'Mirror https://example.org/list.txt',
        ],
    ])('does not expose %s in the description header', async (_, description, sanitized) => {
        const list = await compile({
            name: 'Test filter',
            description,
            sources: [{ source: 'test/resources/rules.txt' }],
        });
        const header = list.slice(0, 10).join('\n');

        expect(header).toContain(`! Description: ${sanitized}`);
        expect(header).not.toContain('secret');
    });

    it('keeps prose with a port in the description header', async () => {
        const description = 'Mirror at https://example.org:8080, contact admin@example.com';
        const list = await compile({
            name: 'Test filter',
            description,
            sources: [{ source: 'test/resources/rules.txt' }],
        });
        const header = list.slice(0, 10).join('\n');

        expect(header).toContain(`! Description: ${description}`);
    });

    it.each([
        'https://example.org for more info, contact admin@example.org/help.',
        'See https://example.org or mailto:admin@example.com for support',
        'See https://example.org or e-mail:admin@example.com for support',
        'See https://example.org or Email:admin@example.com for support',
        'Homepage "https://example.org". Contact: admin@example.com. Thanks!',
    ])('keeps prose that follows a path-less URL in the description header: %s', async (description) => {
        const list = await compile({
            name: 'Test filter',
            description,
            sources: [{ source: 'test/resources/rules.txt' }],
        });
        const header = list.slice(0, 10).join('\n');

        expect(header).toContain(`! Description: ${description}`);
    });

    it('keeps prose around a URL in the title, version, and license headers', async () => {
        const prose = 'https://example.org by admin@example.com';
        const list = await compile({
            name: `My list ${prose}`,
            version: `1.0 ${prose}`,
            license: `See ${prose}`,
            sources: [{ source: 'test/resources/rules.txt' }],
        });

        expect(list).toContain(`! Title: My list ${prose}`);
        expect(list).toContain(`! Version: 1.0 ${prose}`);
        expect(list).toContain(`! License: See ${prose}`);
    });

    it('does not expose a quote in a source username in the compiled list or logs', async () => {
        const authorization = `Basic ${Buffer.from("o'brien:secret").toString('base64')}`;
        const scope = mockHttp('https://example.org')
            .get('/source.txt', { Authorization: authorization })
            .reply(200, '||example.org', {
                'Content-Type': 'text/plain',
            });

        const configuration = {
            name: 'Test filter',
            sources: [
                {
                    source: "https://o'brien:secret@example.org/source.txt",
                },
            ],
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            const list = await compile(configuration);
            const compiledList = list.join('\n');

            expect(compiledList).toContain('! Source: https://example.org/source.txt');
            expect(compiledList).not.toContain('secret');

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('secret');
            });
        } finally {
            infoSpy.mockRestore();
        }

        scope.done();
    });

    it('does not expose a literal @ password in a path-less source', async () => {
        const authorization = `Basic ${Buffer.from('user:p@s s').toString('base64')}`;
        const scope = mockHttp('https://example.org')
            .get('/', { Authorization: authorization })
            .reply(200, '||example.org', {
                'Content-Type': 'text/plain',
            });

        const configuration = {
            name: 'Test filter',
            sources: [
                {
                    source: 'https://user:p@s s@example.org',
                },
            ],
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            const list = await compile(configuration);
            const compiledList = list.join('\n');

            expect(compiledList).toContain('! Source: https://example.org');
            expect(compiledList).not.toContain('p@s s');

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('p@s s');
            });
            expect(infoMessages).toContain('Start compiling https://example.org');

            const configurationMessage = infoMessages
                .find((message) => message.startsWith('Configuration:'));
            expect(configurationMessage).toContain('"source": "https://example.org"');
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
