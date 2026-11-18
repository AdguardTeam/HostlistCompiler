const consola = require('consola');
const mock = require('mock-fs');
const path = require('path');
const mockHttp = require('./helpers/http-mock');
const compileSource = require('../src/compile-source');
const { TRANSFORMATIONS } = require('../src/transformations/enum');

const testDirPath = path.resolve(__dirname, 'test/dir');
const exclusionsFilePath = path.resolve(testDirPath, 'exclusions.txt');

describe('Source compiler', () => {
    afterEach(() => {
        // make sure FS is restored after running tests
        mock.restore();
    });

    it('compile a simple URL source', async () => {
        const scope = mockHttp('https://example.org')
            .get('/filter.txt')
            .reply(200, 'testrule', {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://example.org/filter.txt',
        };

        const rules = await compileSource(source);
        expect(rules).toHaveLength(1);
        expect(rules).toContain('testrule');

        // Make sure scope URLs were requested
        scope.done();
    });

    it('downloads a credentialed source and sends Basic authorization', async () => {
        const authorization = `Basic ${Buffer.from('user:secret').toString('base64')}`;
        const scope = mockHttp('https://example.org')
            .get('/filter.txt', { Authorization: authorization })
            .reply(200, 'testrule', {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://user:secret@example.org/filter.txt',
        };

        const rules = await compileSource(source);
        expect(rules).toContain('testrule');

        scope.done();
    });

    it('does not expose source credentials in logs', async () => {
        const scope = mockHttp('https://example.org')
            .get('/filter.txt')
            .reply(200, 'testrule', {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://user:secret@example.org/filter.txt',
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            await compileSource(source);

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('secret');
            });
            expect(infoMessages).toContain('Start compiling https://example.org/filter.txt');
        } finally {
            infoSpy.mockRestore();
        }

        scope.done();
    });

    it('does not expose credentials with whitespace in logs', async () => {
        const authorization = `Basic ${Buffer.from('user:p s s').toString('base64')}`;
        const scope = mockHttp('https://example.org')
            .get('/filter.txt', { Authorization: authorization })
            .reply(200, 'testrule', {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://user:p s s@example.org/filter.txt',
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            await compileSource(source);

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('p s s');
            });
            expect(infoMessages).toContain('Start compiling https://example.org/filter.txt');
        } finally {
            infoSpy.mockRestore();
        }

        scope.done();
    });

    it('does not expose a literal @ password in a path-less source', async () => {
        const authorization = `Basic ${Buffer.from('user:p@s s').toString('base64')}`;
        const scope = mockHttp('https://example.org')
            .get('/', { Authorization: authorization })
            .reply(200, 'testrule', {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://user:p@s s@example.org',
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            await compileSource(source);

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('p@s s');
            });
            expect(infoMessages).toContain('Start compiling https://example.org');
        } finally {
            infoSpy.mockRestore();
        }

        scope.done();
    });

    it('does not expose a quote or space in the username in logs', async () => {
        const authorization = `Basic ${Buffer.from('John Smith:secret').toString('base64')}`;
        const scope = mockHttp('https://example.org')
            .get('/filter.txt', { Authorization: authorization })
            .reply(200, 'testrule', {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://John Smith:secret@example.org/filter.txt',
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            await compileSource(source);

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('secret');
            });
            expect(infoMessages).toContain('Start compiling https://example.org/filter.txt');
        } finally {
            infoSpy.mockRestore();
        }

        scope.done();
    });

    it('does not expose credentials in a prefixed source log', async () => {
        const source = {
            name: 'test source',
            source: ' https://user:secret@example.org/filter.txt',
        };

        const infoSpy = jest.spyOn(consola, 'info').mockImplementation(() => {});

        try {
            await expect(compileSource(source)).rejects.toThrow();

            const infoMessages = infoSpy.mock.calls.map(([message]) => String(message));
            infoMessages.forEach((message) => {
                expect(message).not.toContain('secret');
            });
            expect(infoMessages).toContain('Start compiling  https://example.org/filter.txt');
        } finally {
            infoSpy.mockRestore();
        }
    });

    it('compile a simple file source', async () => {
        mock({
            'test/dir': {
                'rules.txt': 'testrule',
            },
        });

        const source = {
            name: 'test source',
            source: 'test/dir/rules.txt',
        };

        const rules = await compileSource(source);
        expect(rules).toHaveLength(1);
        expect(rules).toContain('testrule');
    });

    it('compile a source and apply transformations', async () => {
        // STEP 1: MOCK RULES SOURCE
        const rules = `! this is a source
||rule1
||rule2
||invalidrule/test
@@||rule3
||rule4`;
        const scope = mockHttp('https://example.org')
            .get('/filter.txt')
            .reply(200, rules, {
                'Content-Type': 'text/plain',
            });

        // STEP 2: MOCK EXCLUSIONS
        const exclusions = `||rule1
||rule3`;
        mock({
            [testDirPath]: {
                'exclusions.txt': exclusions,
            },
        });
        // STEP 3: Init source
        const source = {
            name: 'test source',
            source: 'https://example.org/filter.txt',
            exclusions: ['rule4'],
            exclusions_sources: [exclusionsFilePath],
            transformations: [
                TRANSFORMATIONS.Deduplicate,
                TRANSFORMATIONS.Validate,
                TRANSFORMATIONS.RemoveComments,
                TRANSFORMATIONS.RemoveModifiers,
            ],
        };

        // STEP 4: Compile source
        const compiled = await compileSource(source);
        expect(compiled).toHaveLength(1);
        expect(compiled).toContain('||rule2');

        // Make sure scope URLs were requested
        scope.done();
    });

    it('compile the source with transformations', async () => {
        const testList = `

    example.org

               test1.com

        ! comment
 test1.com

  test2.com`;
        const scope = mockHttp('https://example.org')
            .get('/test-filter.txt')
            .reply(200, testList, {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://example.org/test-filter.txt',
            transformations: [
                TRANSFORMATIONS.Deduplicate,
                TRANSFORMATIONS.RemoveComments,
                TRANSFORMATIONS.TrimLines,
                TRANSFORMATIONS.RemoveEmptyLines,
                TRANSFORMATIONS.InsertFinalNewLine,
            ],
        };
        const compiled = await compileSource(source);
        expect(compiled).toEqual([
            'example.org',
            'test1.com',
            'test2.com',
            '',
        ]);
        scope.done();
    });

    it('compile the source with converToAscii transformation', async () => {
        const testList = `
        ! comment
||*.ком^
||*.ком^
    ||*.укр^
||*.мон^
||*.ευ^
        ||*.ελ^
||*.հայ^`;
        const scope = mockHttp('https://example.org')
            .get('/test-filter.txt')
            .reply(200, testList, {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://example.org/test-filter.txt',
            transformations: [
                TRANSFORMATIONS.ConvertToAscii,
                TRANSFORMATIONS.Deduplicate,
                TRANSFORMATIONS.RemoveComments,
                TRANSFORMATIONS.TrimLines,
            ],
        };
        const compiled = await compileSource(source);
        expect(compiled).toEqual([
            '||*.xn--j1aef^',
            '||*.xn--j1amh^',
            '||*.xn--l1acc^',
            '||*.xn--qxa6a^',
            '||*.xn--qxam^',
            '||*.xn--y9a3aq^',
        ]);
        scope.done();
    });

    it('skips an empty local source with a warning', async () => {
        mock({
            'test/dir': {
                'empty.txt': '',
            },
        });

        const source = {
            name: 'test source',
            source: 'test/dir/empty.txt',
            transformations: [
                TRANSFORMATIONS.ConvertToAscii,
                TRANSFORMATIONS.Deduplicate,
                TRANSFORMATIONS.RemoveComments,
                TRANSFORMATIONS.TrimLines,
            ],
        };

        const warnSpy = jest.spyOn(consola, 'warn').mockImplementation(() => {});

        try {
            const compiled = await compileSource(source);
            expect(compiled).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(
                'Source test/dir/empty.txt is empty and is skipped',
            );
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('skips a source that contains only comments and blank lines', async () => {
        mock({
            'test/dir': {
                'comments.txt': [
                    '! adblock comment',
                    '# hosts comment',
                    '#',
                    '',
                    '   ',
                    '    #### section comment',
                ].join('\n'),
            },
        });

        const source = {
            name: 'test source',
            source: 'test/dir/comments.txt',
        };

        const warnSpy = jest.spyOn(consola, 'warn').mockImplementation(() => {});

        try {
            const compiled = await compileSource(source);
            expect(compiled).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(
                'Source test/dir/comments.txt is empty and is skipped',
            );
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('skips an empty external source with a warning', async () => {
        const scope = mockHttp('https://example.org')
            .get('/empty.txt')
            .reply(200, '', {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://example.org/empty.txt',
            transformations: [
                TRANSFORMATIONS.ConvertToAscii,
                TRANSFORMATIONS.Deduplicate,
                TRANSFORMATIONS.RemoveComments,
                TRANSFORMATIONS.TrimLines,
                TRANSFORMATIONS.Compress,
            ],
        };

        const warnSpy = jest.spyOn(consola, 'warn').mockImplementation(() => {});

        try {
            const compiled = await compileSource(source);
            expect(compiled).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(
                'Source https://example.org/empty.txt is empty and is skipped',
            );
        } finally {
            warnSpy.mockRestore();
        }

        scope.done();
    });

    it('does not expose source credentials in an empty-source warning', async () => {
        const authorization = `Basic ${Buffer.from('user:secret').toString('base64')}`;
        const scope = mockHttp('https://example.org')
            .get('/empty.txt', { Authorization: authorization })
            .reply(200, '', {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://user:secret@example.org/empty.txt',
        };

        const warnSpy = jest.spyOn(consola, 'warn').mockImplementation(() => {});

        try {
            const compiled = await compileSource(source);
            expect(compiled).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(
                'Source https://example.org/empty.txt is empty and is skipped',
            );

            const warningMessages = warnSpy.mock.calls.map(([message]) => String(message));
            warningMessages.forEach((message) => {
                expect(message).not.toContain('secret');
            });
        } finally {
            warnSpy.mockRestore();
        }

        scope.done();
    });

    it('checks incompatible validations for an empty source', async () => {
        mock({
            'test/dir': {
                'empty.txt': '',
            },
        });

        const source = {
            name: 'test source',
            source: 'test/dir/empty.txt',
            transformations: [
                TRANSFORMATIONS.Validate,
                TRANSFORMATIONS.ValidateAllowIp,
            ],
        };

        await expect(compileSource(source)).rejects.toThrow(
            'Validation transformations cannot be combined',
        );
    });

    it('warns when transformations remove every rule', async () => {
        const scope = mockHttp('https://example.org')
            .get('/invalid.txt')
            .reply(200, '||invalid/rule', {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://example.org/invalid.txt',
            transformations: [TRANSFORMATIONS.Validate],
        };

        const warnSpy = jest.spyOn(consola, 'warn').mockImplementation(() => {});

        try {
            const compiled = await compileSource(source);
            expect(compiled).toEqual([]);
            expect(warnSpy).toHaveBeenCalledWith(
                'Source https://example.org/invalid.txt is empty and is skipped',
            );
        } finally {
            warnSpy.mockRestore();
        }

        scope.done();
    });

    it('compiles a non-empty source and does not warn about an empty source', async () => {
        const scope = mockHttp('https://example.org')
            .get('/filter.txt')
            .reply(200, '! comment\n||rule1^', {
                'Content-Type': 'text/plain',
            });

        const source = {
            name: 'test source',
            source: 'https://example.org/filter.txt',
        };

        const warnSpy = jest.spyOn(consola, 'warn').mockImplementation(() => {});

        try {
            const compiled = await compileSource(source);
            expect(compiled).toEqual(['! comment', '||rule1^']);
            expect(warnSpy).not.toHaveBeenCalled();
        } finally {
            warnSpy.mockRestore();
        }

        scope.done();
    });
});
