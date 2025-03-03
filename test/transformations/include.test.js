const nock = require('nock');
const mock = require('mock-fs');
const path = require('path');
const include = require('../../src/transformations/include');

const testDirPath = path.resolve(__dirname, 'test/dir');
const inclusionsFilePath = path.resolve(testDirPath, 'inclusions.txt');

describe('Exclusions', () => {
    afterEach(() => {
        // make sure FS is restored after running tests
        mock.restore();
    });

    it('simple inclusion', async () => {
        const rules = ['rule1', 'rule2'];
        const filtered = await include(rules, ['rule2']);

        expect(filtered).toHaveLength(1);
        expect(filtered).toContain('rule2');
    });

    it('include host-level only', async () => {
        const rules = [
            '/banner',
            '||example.org^',
            '||example.org^$third-party',
            '||example.org',
            '||example.org^$third-party,subdocument',
        ];
        const inclusions = ['/^\\|\\|[a-z0-9-.]+\\^?(\\$third-party)?$/'];
        const filtered = await include(rules, inclusions);

        expect(filtered).toHaveLength(3);
        expect(filtered).toEqual([
            '||example.org^',
            '||example.org^$third-party',
            '||example.org',
        ]);
    });

    it('inclusions sources', async () => {
        // Mock inclusions sources
        const scope = nock('https://example.org')
            .get('/inclusions.txt')
            .reply(200, 'rule1', {
                'Content-Type': 'text/plain',
            })
            .get('/inclusions2.txt')
            .reply(200, 'rule2', {
                'Content-Type': 'text/plain',
            });
        mock({
            [testDirPath]: {
                'inclusions.txt': 'rule3',
            },
        });

        // Prepare the rules collection
        const rules = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5', ''];

        // Prepare configuration
        const inclusions = ['rule4'];
        const inclusionsSources = [
            'https://example.org/inclusions.txt',
            'https://example.org/inclusions2.txt',
            inclusionsFilePath,
        ];

        // Include!
        const filtered = await include(rules, inclusions, inclusionsSources);

        // Assert
        expect(filtered).toEqual(['rule1', 'rule2', 'rule3', 'rule4']);

        // Make sure scope URLs were requested
        scope.done();
    });
});
