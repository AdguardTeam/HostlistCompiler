const nock = require('nock');
const mock = require('mock-fs');
const exclude = require('../../src/transformations/exclude');

describe('Exclusions', () => {
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
            .reply(200, 'rule1');
        mock({
            'test/dir': {
                'exclusions.txt': 'rule2',
            },
        });

        // Prepare the rules collection
        const rules = ['rule1', 'rule2', 'rule3', 'rule4', ''];

        // Exclude!
        const filtered = await exclude(rules, ['rule3'], ['https://example.org/exclusions.txt', 'test/dir/exclusions.txt']);

        // Assert
        expect(filtered).toHaveLength(2);
        expect(filtered).toContain('rule4');
        expect(filtered).toContain('');

        scope.done();
        mock.restore();
    });
});
