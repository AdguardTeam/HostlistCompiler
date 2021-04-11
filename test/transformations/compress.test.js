const compress = require('../../src/transformations/compress');

describe('Compress', () => {
    it('compress rules', () => {
        const rules = `# Test rules go here
example.net
||sub.example.net^
0.0.0.0 sub1.example.org
0.0.0.0 example.org
0.0.0.0 sub2.example.org sub3.example.org
# More rules to convert
0.0.0.0 abc1.doubleclick.net
0.0.0.0 aaa1.bbb.doubleclick.net
0.0.0.0 abc2.doubleclick.net`.split(/\r?\n/);
        const filtered = compress(rules);

        expect(filtered).toEqual([
            '# Test rules go here',
            '||example.net^',
            '||example.org^',
            '# More rules to convert',
            '||abc1.doubleclick.net^',
            '||aaa1.bbb.doubleclick.net^',
            '||abc2.doubleclick.net^',
        ]);
    });

    it('compress adblock rules, but keep non-compressable rules', () => {
        const rules = `# Keep this comment
||example.org^
@@||example.org^
@@||sub.example.org^
||sub.example.org^$important`.split(/\r?\n/);

        const filtered = compress(rules);
        expect(filtered).toEqual(rules);
    });

    it('wide rule case (not yet handled)', () => {
        const rules = `||example
||example.org^`.split(/\r?\n/);

        // TODO: ||example should cover ||example.org as well
        const filtered = compress(rules);
        expect(filtered).toEqual(rules);
    });
});
