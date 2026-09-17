const nock = require('nock');
const mock = require('mock-fs');
const path = require('path');
const { download } = require('../src/download');

const testDirPath = path.resolve(__dirname, 'dir');

describe('Download', () => {
    afterEach(() => {
        // make sure FS is restored after running tests
        mock.restore();
    });

    it('downloads a remote URL source', async () => {
        const scope = nock('https://example.org')
            .get('/filter.txt')
            .reply(200, 'rule1\nrule2\nrule3\n', {
                'Content-Type': 'text/plain',
            });

        const rules = await download('https://example.org/filter.txt');

        expect(rules).toEqual(['rule1', 'rule2', 'rule3']);

        // Make sure scope URLs were requested
        scope.done();
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
        const scope = nock('https://example.org')
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
        const scope = nock('https://example.org')
            .get('/missing.txt')
            .reply(404, 'Not Found', {
                'Content-Type': 'text/plain',
            });

        await expect(download('https://example.org/missing.txt')).rejects.toThrow();

        // Make sure scope URLs were requested
        scope.done();
    });
});
