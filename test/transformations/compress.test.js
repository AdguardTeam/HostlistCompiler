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

    it('compresses mixed-case hostnames case-insensitively', () => {
        const rules = [
            '||2o7.net^',
            '||ziffdavisetech.112.2O7.net^',
            '||msstonojstemp.112.2O7.net^',
        ];

        expect(compress(rules)).toEqual(['||2o7.net^']);
    });

    it('keeps the first occurrence casing for mixed-case duplicates', () => {
        expect(compress(['||Example.COM^', '||example.com^']))
            .toEqual(['||Example.COM^']);
        expect(compress(['||example.com^', '||Example.COM^']))
            .toEqual(['||example.com^']);
    });

    it('compresses mixed-case /etc/hosts entries with adblock rules', () => {
        expect(compress(['0.0.0.0 EXAMPLE.com', '||example.COM^']))
            .toEqual(['||EXAMPLE.com^']);
        expect(compress(['||example.COM^', '0.0.0.0 EXAMPLE.com']))
            .toEqual(['||example.COM^']);
    });

    it('compresses mixed-case bare domains', () => {
        expect(compress(['Example.COM', '||example.com^']))
            .toEqual(['||Example.COM^']);
    });

    it('keeps differently-cased different hostnames', () => {
        expect(compress(['||Example.com^', '||example.NET^']))
            .toEqual(['||Example.com^', '||example.NET^']);
    });

    it('does not treat Object.prototype names as existing hostnames', () => {
        expect(compress(['||CONSTRUCTOR^', '||example.com^']))
            .toEqual(['||CONSTRUCTOR^', '||example.com^']);
        expect(compress(['||x.constructor^']))
            .toEqual(['||x.constructor^']);
    });

    it('wide rule case (not yet handled)', () => {
        const rules = `||example
||example.org^`.split(/\r?\n/);

        // TODO: ||example should cover ||example.org as well
        const filtered = compress(rules);
        expect(filtered).toEqual(rules);
    });
});
