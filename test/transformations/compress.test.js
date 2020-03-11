const compress = require('../../src/transformations/compress');

describe('Compress', () => {
    it('compress /etc/hosts rules', () => {
        const rules = `# Test rules go here
0.0.0.0 sub1.example.org
0.0.0.0 example.org
0.0.0.0 sub2.example.org sub3.example.org
# More rules to convert
0.0.0.0 abc1.doubleclick.net
0.0.0.0 aaa1.bbb.doubleclick.net
0.0.0.0 abc2.doubleclick.net`.split(/\r?\n/);
        const filtered = compress(rules);

        expect(filtered).toEqual([
            '||abc1.doubleclick.net^',
            '||abc2.doubleclick.net^',
            '||aaa1.bbb.doubleclick.net^',
            '||example.org^',
        ]);
    });
});
