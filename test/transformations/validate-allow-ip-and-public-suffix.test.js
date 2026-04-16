const { validateAllowIpAndPublicSuffix } = require('../../src/transformations/validate-allow-ip-and-public-suffix');

describe('ValidateAllowIpAndPublicSuffix', () => {
    it('keeps valid domain rules', () => {
        const rules = [
            '||example.org^',
            '||example.com^',
        ];
        const filtered = validateAllowIpAndPublicSuffix(rules);

        expect(filtered).toEqual([
            '||example.org^',
            '||example.com^',
        ]);
    });

    it('keeps IP address rules (like ValidateAllowIp)', () => {
        const rules = [
            '||185.149.120.173^',
            '0.0.0.0 example.org',
        ];
        const filtered = validateAllowIpAndPublicSuffix(rules);

        expect(filtered).toEqual([
            '||185.149.120.173^',
            '0.0.0.0 example.org',
        ]);
    });

    it('keeps public suffix rules (like ValidateAllowPublicSuffix)', () => {
        const rules = [
            '||hl.cn^',
            '||org^',
            '||*.org^',
            '.org^',
        ];
        const filtered = validateAllowIpAndPublicSuffix(rules);

        expect(filtered).toEqual([
            '||hl.cn^',
            '||org^',
            '||*.org^',
            '.org^',
        ]);
    });

    it('keeps both IP and public suffix rules together', () => {
        const rules = [
            '||185.149.120.173^',
            '||org^',
            '||example.org^',
            '||hl.cn^',
            '0.0.0.0 example.com',
        ];
        const filtered = validateAllowIpAndPublicSuffix(rules);

        expect(filtered).toEqual([
            '||185.149.120.173^',
            '||org^',
            '||example.org^',
            '||hl.cn^',
            '0.0.0.0 example.com',
        ]);
    });

    it('normalizes IP patterns (like ValidateAllowIp)', () => {
        const rules = [
            '1.1.1.1^',
            '192.168.1.1^',
            '|1.1.1.1^',
            '||192.168.1.',
            '||192.168.1.*',
            '||example.org^',
        ];
        const filtered = validateAllowIpAndPublicSuffix(rules);

        expect(filtered).toEqual([
            '||1.1.1.1^',
            '||192.168.1.1^',
            '||1.1.1.1^',
            '||192.168.1.',
            '||192.168.1.*',
            '||example.org^',
        ]);
    });

    it('rejects invalid rules', () => {
        const rules = [
            '||invalid/rule',
            '||example.org^$domain=example.com',
            '||example.org^',
        ];
        const filtered = validateAllowIpAndPublicSuffix(rules);

        expect(filtered).toEqual([
            '||example.org^',
        ]);
    });

    it('rejects invalid IP patterns', () => {
        const rules = [
            // 3-octet without trailing dot — rejected (ambiguous)
            '192.168.1',
            '||192.168.1',
            // 3-octet with ^ — rejected (doesn't work)
            '||192.168.1^',
            // 2-octet — rejected (too wide)
            '||1.1.',
            '1.1.',
            // valid entries — kept
            '||example.org^',
            '||1.2.3.4^',
        ];
        const filtered = validateAllowIpAndPublicSuffix(rules);

        expect(filtered).toEqual([
            '||example.org^',
            '||1.2.3.4^',
        ]);
    });

    it('rejects terminated IDN TLDs (like ValidateAllowPublicSuffix)', () => {
        const rules = [
            '||*.xn--jlq61u9w7b^',
            '||xn--jlq61u9w7b^',
            '.xn--p1acf^',
            '||*.xn--p1acf^',
        ];
        const filtered = validateAllowIpAndPublicSuffix(rules);

        expect(filtered).toEqual([
            '.xn--p1acf^',
            '||*.xn--p1acf^',
        ]);
    });

    it('keeps known ICANN TLDs but rejects unknown ones', () => {
        const rules = [
            '||aaa^',
            '||aaaa^',
            '||foo^',
            '||zzzz^',
            '||example.org^',
        ];
        const filtered = validateAllowIpAndPublicSuffix(rules);

        expect(filtered).toEqual([
            '||aaa^',
            '||foo^',
            '||example.org^',
        ]);
    });

    it('removes preceding comments for invalid rules', () => {
        const rules = `! rule comment

||invalid/rule
! comment
||valid.com^`.split(/\r?\n/);
        const filtered = validateAllowIpAndPublicSuffix(rules);

        expect(filtered).toEqual([
            '! comment',
            '||valid.com^',
        ]);
    });
});
