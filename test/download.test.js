const mock = require('mock-fs');
const path = require('path');
const mockHttp = require('./helpers/http-mock');
const { download } = require('../src/download');

const testDirPath = path.resolve(__dirname, 'dir');

describe('Download', () => {
    afterEach(() => {
        // make sure FS is restored after running tests
        mock.restore();
    });

    it('downloads a remote URL source', async () => {
        const scope = mockHttp('https://example.org')
            .get('/filter.txt')
            .reply(200, 'rule1\nrule2\nrule3\n', {
                'Content-Type': 'text/plain',
            });

        const rules = await download('https://example.org/filter.txt');

        expect(rules).toEqual(['rule1', 'rule2', 'rule3']);

        // Make sure scope URLs were requested
        scope.done();
    });

    it('downloads a source with credentials in the URL', async () => {
        const credentials = Buffer.from('user:password').toString('base64');
        const scope = mockHttp('https://example.org')
            .get('/filter.txt', {
                authorization: `Basic ${credentials}`,
            })
            .reply(200, 'rule1\nrule2\n', {
                'Content-Type': 'text/plain',
            });

        const rules = await download('https://user:password@example.org/filter.txt');

        expect(rules).toEqual(['rule1', 'rule2']);

        // Make sure scope URLs were requested
        scope.done();
    });

    it('keeps a JSON-looking body as plain text', async () => {
        const scope = mockHttp('https://example.org')
            .get('/list.json')
            .reply(200, '[]', {
                'Content-Type': 'text/plain',
            });

        expect(await download('https://example.org/list.json')).toEqual(['[]']);

        // Make sure scope URLs were requested
        scope.done();
    });

    it('does not leak the password into error messages', async () => {
        const scope = mockHttp('https://example.org')
            .get('/missing.txt')
            .reply(404, 'Not Found', {
                'Content-Type': 'text/plain',
            });

        const error = await download('https://user:secret@example.org/missing.txt')
            .catch((ex) => ex);

        // Follow `errors` as well as `cause`: a dual-stack failure is an
        // `AggregateError`, and its messages are in `errors`. This is the same
        // traversal that `logError()` in `src/cli.js` uses.
        const messages = [];
        const logged = new Set();
        const collect = (current) => {
            if (current === null || current === undefined || logged.has(current)) {
                return;
            }

            if (typeof current === 'object') {
                logged.add(current);
            }

            messages.push(String(current.message || current));

            if (Array.isArray(current.errors)) {
                current.errors.forEach(collect);
            }

            collect(current.cause);
        };
        collect(error);

        expect(error.message).toBe(
            'Response status for url https://example.org/missing.txt is invalid: 404',
        );
        expect(messages.join('\n')).not.toContain('secret');

        // Make sure scope URLs were requested
        scope.done();
    });

    it.each([
        ['a triple slash', 'https:///user:secret@example.invalid/list.txt'],
        ['a single slash', 'http:/user:secret@example.invalid/list.txt'],
        ['no slashes', 'https:user:secret@example.invalid/list.txt'],
        ['backslashes', 'https:\\user:secret@example.invalid\\list.txt'],
    ])('does not leak credentials from a source with %s into the error chain', async (_, source) => {
        const error = await download(source).catch((ex) => ex);

        const messages = [];
        const logged = new Set();
        const collect = (current) => {
            if (current === null || current === undefined || logged.has(current)) {
                return;
            }

            if (typeof current === 'object') {
                logged.add(current);
            }

            messages.push(String(current.message || current));

            if (Array.isArray(current.errors)) {
                current.errors.forEach(collect);
            }

            collect(current.cause);
        };
        collect(error);

        expect(error.message).not.toContain('secret');
        expect(error.stack).not.toContain('secret');
        expect(messages.join('\n')).not.toContain('secret');
    });

    it('downloads a local file source', async () => {
        mock({
            [testDirPath]: {
                'rules.txt': 'rule1\nrule2\n',
            },
        });

        const rules = await download(path.join(testDirPath, 'rules.txt'));

        expect(rules).toEqual(['rule1', 'rule2']);
    });

    it('resolves !#include directives in a local file source', async () => {
        mock({
            [testDirPath]: {
                'main.txt': 'rule1\n!#include included.txt',
                'included.txt': 'rule2\n',
            },
        });

        const rules = await download(path.join(testDirPath, 'main.txt'));

        expect(rules).toEqual(['rule1', 'rule2']);
    });

    it('downloads an empty local file source', async () => {
        mock({
            [testDirPath]: {
                'empty.txt': '',
            },
        });

        const rules = await download(path.join(testDirPath, 'empty.txt'));

        expect(rules).toEqual(['']);
    });

    it('downloads an empty remote source', async () => {
        const scope = mockHttp('https://example.org')
            .get('/empty.txt')
            .reply(200, '', {
                'Content-Type': 'text/plain',
            });

        const rules = await download('https://example.org/empty.txt');

        expect(rules).toEqual(['']);

        // Make sure scope URLs were requested
        scope.done();
    });

    it('throws an error when the source cannot be downloaded', async () => {
        const scope = mockHttp('https://example.org')
            .get('/missing.txt')
            .reply(404, 'Not Found', {
                'Content-Type': 'text/plain',
            });

        await expect(download('https://example.org/missing.txt')).rejects.toThrow();

        // Make sure scope URLs were requested
        scope.done();
    });
});
