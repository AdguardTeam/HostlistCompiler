const nock = require('nock');
const mock = require('mock-fs');
const compileSource = require('../src/compile-source');
const { TRANSFORMATIONS } = require('../src/transformations/transform');

describe('Source compiler', () => {
    afterEach(() => {
        // make sure FS is restored after running tests
        mock.restore();
    });

    it('compile a simple URL source', async () => {
        const scope = nock('https://example.org')
            .get('/filter.txt')
            .reply(200, 'testrule');

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
            .reply(200, rules);

        // STEP 2: MOCK EXCLUSIONS
        const exclusions = `||rule1
||rule3`;
        mock({
            'test/dir': {
                'exclusions.txt': exclusions,
            },
        });
        // STEP 3: Init source
        const source = {
            name: 'test source',
            source: 'https://example.org/filter.txt',
            exclusions: ['rule4'],
            exclusions_sources: ['test/dir/exclusions.txt'],
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
});
