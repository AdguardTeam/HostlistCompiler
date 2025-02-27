const nock = require('nock');
const mock = require('mock-fs');
const path = require('path');
const exclude = require('../../src/transformations/exclude');

const testDirPath = path.resolve(__dirname, 'test/dir');
const exclusionsFilePath = path.resolve(testDirPath, 'exclusions.txt');

describe('Exclusions', () => {
    afterEach(() => {
        // make sure FS is restored after running tests
        mock.restore();
    });

    it('simple exclusion', async () => {
        const rules = ['rule1', 'rule2'];
        const filtered = await exclude(rules, ['rule2']);

        expect(filtered).toHaveLength(1);
        expect(filtered).toContain('rule1');
    });

    it('exclusions sources', async () => {
        // Mock exclusions
        const scope = nock('https://example.org')
            .get('/exclusions.txt')
            .reply(200, 'rule1', {
                'Content-Type': 'text/plain',
            })
            .get('/exclusions2.txt')
            .reply(200, 'rule2', {
                'Content-Type': 'text/plain',
            });
        mock({
            [testDirPath]: {
                'exclusions.txt': 'rule3',
            },
        });

        // Prepare the rules collection
        const rules = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5', ''];

        // Exclude!
        const filtered = await exclude(
            rules,
            ['rule4'],
            ['https://example.org/exclusions.txt', 'https://example.org/exclusions2.txt', exclusionsFilePath],
        );

        // Assert
        expect(filtered).toHaveLength(2);
        expect(filtered).toContain('rule5');
        expect(filtered).toContain('');

        // Make sure scope URLs were requested
        scope.done();
    });
});
