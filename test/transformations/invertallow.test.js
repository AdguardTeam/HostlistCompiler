const invertAllow = require('../../src/transformations/invertallow');

describe('Invert to allowlist rules', () => {
    it('invert rules to allowlist rules', () => {
        const rules = `! test comment
127.0.0.1 example.org
rule1
rule2
@@rule3

# more comments`.split(/\r?\n/);
        const filtered = invertAllow(rules);

        expect(filtered).toHaveLength(7);
        expect(filtered).toEqual([
            '! test comment',
            '127.0.0.1 example.org',
            '@@rule1',
            '@@rule2',
            '@@rule3',
            '',
            '# more comments',
        ]);
    });
});
