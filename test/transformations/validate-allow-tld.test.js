const { validateAllowTLD } = require('../../src/transformations/validate-allow-tld');

describe('validateAllowTLD', () => {
    it('keeps rules targeting public suffixes', () => {
        const rules = `||hl.cn^
||org^`.split(/\r?\n/);
        const filtered = validateAllowTLD(rules);

        expect(filtered).toEqual(['||hl.cn^', '||org^']);
    });

    it('still removes invalid adblock rule', () => {
        const rules = `||hl.cn^
||invalid/rule`.split(/\r?\n/);
        const filtered = validateAllowTLD(rules);

        expect(filtered).toEqual(['||hl.cn^']);
    });

    it('keeps whole public suffix variants', () => {
        const rules = `||*.org^
.org^
*.org^
||org^`.split(/\r?\n/);
        const filtered = validateAllowTLD(rules);

        expect(filtered).toEqual(['||*.org^', '.org^', '*.org^', '||org^']);
    });

    it('keeps whole public suffix unblocking variants', () => {
        const rules = `@@||*.org^
@@.org^
@@*.org^
@@||org^`.split(/\r?\n/);
        const filtered = validateAllowTLD(rules);

        expect(filtered).toEqual(['@@||*.org^', '@@.org^', '@@*.org^', '@@||org^']);
    });
});
