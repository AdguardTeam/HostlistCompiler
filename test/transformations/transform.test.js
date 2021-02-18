const { transform } = require('../../src/transformations/transform');

describe('Transform', () => {
    it('no transformations', async () => {
        const rules = `! test comment
rule1
rule2
# another comment`.split(/\r?\n/);
        const filtered = await transform(rules, {}, []);
        expect(filtered).toHaveLength(4);
        expect(filtered).toEqual(rules);
    });

    it('simple transformations', async () => {
        const rules = `! test comment
rule1
rule2
! dup1 comment
dupl1
dupl1
# another comment`.split(/\r?\n/);
        const exclusions = [
            'rule2',
            '', // empty exclusions are ignored
        ];
        const inclusions = [
            'rule1',
            'dupl1',
        ];
        const configuration = {
            exclusions,
            inclusions,
        };
        const filtered = await transform(rules, configuration, ['RemoveComments', 'Validate', 'Deduplicate']);
        expect(filtered).toHaveLength(2);
        expect(filtered).toEqual(['rule1', 'dupl1']);
    });
});
