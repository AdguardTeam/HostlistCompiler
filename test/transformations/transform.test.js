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
    it('simple transformations with ValidateAllowIp', async () => {
        const rules = `! test comment
rule1
rule2
! dup1 comment
dupl1
dupl1
||185.149.120.173^
# another comment`.split(/\r?\n/);
        const exclusions = [
            'rule2',
            '', // empty exclusions are ignored
        ];
        const configuration = {
            exclusions,
        };
        const filtered = await transform(rules, configuration, ['RemoveComments', 'ValidateAllowIp', 'Deduplicate']);
        expect(filtered).toHaveLength(3);
        expect(filtered).toEqual(['rule1', 'dupl1', '||185.149.120.173^']);
    });

    // TODO: Delete this test when ValidateAllowIp and ValidateAllowTLD support a combined mode.
    it('ValidateAllowIp and ValidateAllowTLD are not compatible when used together', async () => {
        const rules = `||185.149.120.173^
||hl.cn^
||example.com^`.split(/\r?\n/);

        const filteredIpThenTld = await transform(rules, {}, ['ValidateAllowIp', 'ValidateAllowTLD']);
        const filteredTldThenIp = await transform(rules, {}, ['ValidateAllowTLD', 'ValidateAllowIp']);

        expect(filteredIpThenTld).toEqual(['||example.com^']);
        expect(filteredTldThenIp).toEqual(['||example.com^']);
    });

    it('simple transformations with removeModifiers', async () => {
        const rules = `! test comment
rule1
rule2
||185.149.120.173^$network
||example.com^$document`.split(/\r?\n/);
        const exclusions = [
            'rule2',
            '', // empty exclusions are ignored
        ];
        const configuration = {
            exclusions,
        };
        const filtered = await transform(rules, configuration, ['RemoveModifiers', 'ValidateAllowIp']);
        expect(filtered).toHaveLength(4);
        expect(filtered).toEqual(['! test comment', 'rule1', '||185.149.120.173^', '||example.com^']);
    });

    it('simple transformations with ConvertToAscii', async () => {
        const rules = `! test comment
||*.рус^
||*.कॉम^
||*.セール^
||*.佛山^
||*.ಭಾರತ^
||*.慈善^
||*.集团^
||*.在线^`.split(/\r?\n/);
        const exclusions = [
            '', // empty exclusions are ignored
            '||*.セール^',
        ];
        const configuration = {
            exclusions,
        };
        const filtered = await transform(rules, configuration, ['ConvertToAscii']);
        expect(filtered).toHaveLength(8);
        expect(filtered).toEqual([
            '! test comment',
            '||*.xn--p1acf^',
            '||*.xn--11b4c3d^',
            '||*.xn--1qqw23a^',
            '||*.xn--2scrj9c^',
            '||*.xn--30rr7y^',
            '||*.xn--3bst00m^',
            '||*.xn--3ds443g^',
        ]);
    });
});
