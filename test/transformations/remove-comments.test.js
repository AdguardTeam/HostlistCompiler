const removeComments = require('../../src/transformations/remove-comments');

describe('Strip comments', () => {
    it('simple test', () => {
        const rules = `! test comment
rule1
rule2
# more comments`.split(/\r?\n/);
        const filtered = removeComments(rules);

        expect(filtered).toHaveLength(2);
        expect(filtered).toContain('rule1');
        expect(filtered).toContain('rule2');
    });
});
