const { validateAllowPublicSuffix } = require('../../src/transformations/validate-allow-public-suffix');

describe('validateAllowPublicSuffix', () => {
    it('keeps rules targeting public suffixes', () => {
        const rules = [
            '||hl.cn^',
            '||org^',
        ];
        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '||hl.cn^',
            '||org^',
        ]);
    });

    it('keeps /etc/hosts rules targeting public suffixes', () => {
        const rules = [
            '0.0.0.0 org',
        ];
        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '0.0.0.0 org',
        ]);
    });

    it('still removes invalid adblock rule', () => {
        const rules = [
            '||hl.cn^',
            '||invalid/rule',
        ];
        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '||hl.cn^',
        ]);
    });

    it('keeps whole public suffix variants', () => {
        const rules = [
            '||*.org^',
            '.org^',
            '*.org^',
            '||org^',
        ];
        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '||*.org^',
            '.org^',
            '*.org^',
            '||org^',
        ]);
    });

    it('keeps whole public suffix unblocking variants', () => {
        const rules = [
            '@@||*.org^',
            '@@.org^',
            '@@*.org^',
            '@@||org^',
        ];
        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '@@||*.org^',
            '@@.org^',
            '@@*.org^',
            '@@||org^',
        ]);
    });

    it('keeps short ccTLD patterns as public suffixes', () => {
        // ||uk^ and .uk^ are 4 chars — below MAX_PATTERN_LENGTH, but extractDomainPattern
        // recognises them as valid domain-style patterns so the length check is skipped.
        const rules = [
            '||uk^',
            '.uk^',
            '@@||uk^',
            '@@.uk^',
            '||example.uk^',
        ];
        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '||uk^',
            '.uk^',
            '@@||uk^',
            '@@.uk^',
            '||example.uk^',
        ]);
    });

    it('rejects structurally malformed domain patterns but keeps public-suffix-only and valid ones', () => {
        // Unlike Validate, validateAllowPublicSuffix keeps public-suffix-only patterns (.foo^, foo.^, ||*.org^, etc.),
        // because foo/org is a public suffix and allowPublicSuffix=true.
        const rules = `
||-a^
||a-^
||a..b^
||.foo^
||foo.^
||*.org^
.org^
*.org^
||org^
||foo.bar.^
||example.org^
@@||-a^
@@||a-^
@@||a..b^
@@||.foo^
@@||foo.^
@@||*.org^
@@.org^
@@*.org^
@@||org^
@@||foo.bar.^
@@||example.org^`.split(/\r?\n/);

        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '||.foo^',
            '||foo.^',
            '||*.org^',
            '.org^',
            '*.org^',
            '||org^',
            '||foo.bar.^',
            '||example.org^',
            '@@||.foo^',
            '@@||foo.^',
            '@@||*.org^',
            '@@.org^',
            '@@*.org^',
            '@@||org^',
            '@@||foo.bar.^',
            '@@||example.org^',
        ]);
    });

    it('keeps ^| variants targeting public suffixes and regular domains', () => {
        const rules = [
            '.com^|',
            '.hl.cn^|',
            '@@.com^|',
            '@@.hl.cn^|',
            '.example.org^|',
            '@@.example.org^|',
        ];
        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '.com^|',
            '.hl.cn^|',
            '@@.com^|',
            '@@.hl.cn^|',
            '.example.org^|',
            '@@.example.org^|',
        ]);
    });

    it('rejects unknown single-label patterns not in PSL, keeps valid domains of same length', () => {
        // Non-ICANN labels are rejected even with allowPublicSuffix=true.
        // Valid multi-label domains of similar length are kept for contrast.
        const rules = [
            '||a^', // unknown — rejected
            '||a.org^', // valid domain — kept
            '.a^', // unknown — rejected
            '.a.uk^', // valid domain — kept
            '||aa^', // unknown — rejected
            '||aa.com^', // valid domain — kept
            '||aaaa^', // unknown — rejected
            '||aaaa.org^', // valid domain — kept
            '||aaaaa^', // unknown — rejected
            '||1^', // unknown — rejected
            '||1.org^', // valid domain — kept
            // Exception variants: equally dangerous — broad unblocking of unknown suffix.
            '@@||a^', // unknown exception — rejected
            '@@||a.org^', // valid domain exception — kept
            '@@.aa^', // unknown exception — rejected
            '@@.aa.com^', // valid domain exception — kept
            '@@||aaaa^', // unknown exception — rejected
            '@@||aaaa.org^', // valid domain exception — kept
        ];
        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '||a.org^',
            '.a.uk^',
            '||aa.com^',
            '||aaaa.org^',
            '||1.org^',
            '@@||a.org^',
            '@@.aa.com^',
            '@@||aaaa.org^',
        ]);
    });

    it('keeps known ICANN TLDs but rejects unknown ones, with valid domain counterparts', () => {
        // aaa is a real gTLD (isIcann=true), aaaa is not.
        // foo and bar are real gTLDs, "zzzz" is not.
        // Valid domains under each suffix are always kept regardless.
        const rules = [
            '||aaa^', // real gTLD — kept (VAPS allows known public suffixes)
            '||aaa.com^', // valid domain — kept
            '||aaaa^', // unknown — rejected
            '||aaaa.com^', // valid domain — kept
            '||foo^', // real gTLD — kept
            '||test.foo^', // valid domain under .foo — kept
            '||bar^', // real gTLD — kept
            '||zzzz^', // unknown — rejected
            '||zzzz.org^', // valid domain — kept
            '@@||aaa^', // real gTLD exception — kept
            '@@||aaa.com^', // valid domain exception — kept
            '@@||aaaa^', // unknown exception — rejected
            '@@||aaaa.com^', // valid domain exception — kept
        ];
        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '||aaa^',
            '||aaa.com^',
            '||aaaa.com^',
            '||foo^',
            '||test.foo^',
            '||bar^',
            '||zzzz.org^',
            '@@||aaa^',
            '@@||aaa.com^',
            '@@||aaaa.com^',
        ]);
    });

    it('rejects broad blocking/unblocking for non-PSL hostnames, keeps valid counterparts', () => {
        // Fake TLD patterns are rejected.
        // Similar-looking valid domain patterns are kept for contrast.
        const rules = [
            // Blocking: fake TLD — rejected
            '||xyz123notreal^',
            '||xyz123notreal.com^', // valid domain — kept
            '.xyz123notreal^',
            '.xyz123notreal.org^', // valid domain — kept
            '*.xyz123notreal^',
            '||*.xyz123notreal^',
            // Unblocking: fake TLD — rejected
            '@@||xyz123notreal^',
            '@@||xyz123notreal.com^', // valid domain exception — kept
            '@@.xyz123notreal^',
            '@@.xyz123notreal.org^', // valid domain exception — kept
            '@@*.xyz123notreal^',
        ];
        const filtered = validateAllowPublicSuffix(rules);

        expect(filtered).toEqual([
            '||xyz123notreal.com^',
            '.xyz123notreal.org^',
            '@@||xyz123notreal.com^',
            '@@.xyz123notreal.org^',
        ]);
    });
});
