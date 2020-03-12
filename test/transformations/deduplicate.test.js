const deduplicate = require('../../src/transformations/deduplicate');

describe('Deduplicate', () => {
    it('simple test', () => {
        const rules = `rule1
rule1`.split(/\r?\n/);
        const filtered = deduplicate(rules);

        expect(filtered).toHaveLength(1);
        expect(filtered).toContain('rule1');
    });

    it('should keep the original order', () => {
        const rules = `rule1
rule3
rule1
rule1`.split(/\r?\n/);
        const filtered = deduplicate(rules);

        expect(filtered).toHaveLength(2);
        expect(filtered).toEqual(['rule3', 'rule1']);
    });

    it('should remove comments preceding duplicates', () => {
        const rules = `! comment to remove

! also comment to remove
rule1
! rule 1 comment to keep
rule1`.split(/\r?\n/);
        const filtered = deduplicate(rules);

        expect(filtered).toHaveLength(2);
        expect(filtered).toEqual(['! rule 1 comment to keep', 'rule1']);
    });
});
