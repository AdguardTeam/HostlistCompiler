const nock = require('nock');
const mock = require('mock-fs');
const path = require('path');
const compileSource = require('../src/compile-source');
const { TRANSFORMATIONS } = require('../src/transformations/transform');

const testDirPath = path.resolve(__dirname, 'test/dir');
const exclusionsFilePath = path.resolve(testDirPath, 'exclusions.txt');

describe('Source compiler', () => {
    afterEach(() => {
        // make sure FS is restored after running tests
        mock.restore();
    });

    it('compile a simple URL source', async () => {
        const scope = nock('https://example.org')
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
        const scope = nock('https://example.org')
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
        const scope = nock('https://example.org')
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
        const scope = nock('https://example.org')
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

    it('compile the empty local source', async () => {
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
        const compiled = await compileSource(source);
        expect(compiled).toEqual(['']);
    });

    it('compile the empty external source', async () => {
        const scope = nock('https://example.org')
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
        const compiled = await compileSource(source);
        expect(compiled).toEqual(['']);
        scope.done();
    });
});
