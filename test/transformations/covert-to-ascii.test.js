const convertToAscii = require('../../src/transformations/covert-to-ascii');

describe('Exclusions', () => {
    it('convert non latin symbols in full domain to punycode', () => {
        const rules = `||*.рус^$denyallow=example.com
||*.कॉम^$denyallow=example.com
||*.セール^$denyallow=example.com`.split(/\r?\n/);
        const filtered = convertToAscii(rules);

        expect(filtered).toEqual([
            '||*.xn--p1acf^$denyallow=example.com',
            '||*.xn--11b4c3d^$denyallow=example.com',
            '||*.xn--1ck2e1b^$denyallow=example.com',
        ]);
    });

    it('convert non latin symbols in modifiers to punycode', () => {
        const rules = `||example.com^$denyallow=*.рф
||example.com^$denyallow=пример.рф
||example.com^$client=пример.рф`.split(/\r?\n/);

        const filtered = convertToAscii(rules);

        expect(filtered).toEqual([
            '||example.com^$denyallow=*.xn--p1ai',
            '||example.com^$denyallow=xn--e1afmkfd.xn--p1ai',
            '||example.com^$client=xn--e1afmkfd.xn--p1ai',
        ]);
    });
});
