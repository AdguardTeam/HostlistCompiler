const { validateAllowIp } = require('../../src/transformations/validate-allow-ip');

describe('ValidateAllowIp', () => {
    it('simple /etc/hosts rule', () => {
        const rules = '0.0.0.0 example.org'.split(/\r?\n/);
        const filtered = validateAllowIp(rules);

        expect(filtered).toHaveLength(1);
        expect(filtered).toContain('0.0.0.0 example.org');
    });

    it('/etc/hosts rules', () => {
        const rules = `0.0.0.0 example.org
0.0.0.0 co.uk
0.0.0.0 doubleclick.net doubleclick.com`.split(/\r?\n/);
        const filtered = validateAllowIp(rules);

        expect(filtered).toHaveLength(2);
        expect(filtered).toContain('0.0.0.0 example.org');
        expect(filtered).toContain('0.0.0.0 doubleclick.net doubleclick.com');
    });

    it('remove preceding comments', () => {
        const rules = `! rule comment

||invalid/rule
! comment
||valid.com^`.split(/\r?\n/);
        const filtered = validateAllowIp(rules);

        expect(filtered).toEqual([
            '! comment',
            '||valid.com^',
        ]);
    });

    it('adblock-style rules', () => {
        const rules = `! here goes a comment

||example.org^
||185.149.120.173^
! invalid rule comment will be removed
||example.com/atata
||ex*.org^
||org^
||example.org^$third-party
||example.org^$important
||*.ga^$denyallow=example1.ga|example2.ga
://ww4.$denyallow=ww4.example.com
://example.org
||example.org^|
@@||example.org^|$important
@@||example.com^*-tracking.js
@@||example.com^-tracking.js`.split(/\r?\n/);
        const filtered = validateAllowIp(rules);

        expect(filtered).toEqual([
            '! here goes a comment',
            '',
            '||example.org^',
            '||185.149.120.173^', // valid because IP addresses is allowed
            '||ex*.org^', // valid because contains special characters
            '||example.org^$important',
            '||*.ga^$denyallow=example1.ga|example2.ga',
            '://ww4.$denyallow=ww4.example.com',
            '://example.org',
            '||example.org^|',
            '@@||example.org^|$important',
        ]);
    });

    it('allows IP-subnet patterns but rejects IP-suffix patterns', () => {
        // ValidateAllowIp allows IP-subnet patterns (with | or || prefix) because they block specific subnets.
        // But IP-suffix patterns (no prefix) are ALWAYS rejected because they block unpredictably
        // (e.g., 1.1^ blocks 1.1.1.1, 1.1.111.1, example1.1).
        const rules = [
            // IP-suffix (no prefix) — rejected ALWAYS (blocks unpredictably)
            '1.1^',
            '1.1.1^',
            '1.1.1.1^',
            '192.168^',
            '10.0.1^',
            '192.168.1.1^',
            // IP-subnet (with prefix) — allowed in ValidateAllowIp
            '||1.1^',
            '|1.1^',
            '||1.1.1^',
            '|1.1.1^',
            '||1.1.1.1^',
            '|1.1.1.1^',
            '||192.168^',
            '||10.0.1^',
            '||192.168.1.1^',
            // valid domain — kept
            '||example.org^',
        ];
        const filtered = validateAllowIp(rules);

        expect(filtered).toEqual([
            // IP-subnet patterns are allowed
            '||1.1^',
            '|1.1^',
            '||1.1.1^',
            '|1.1.1^',
            '||1.1.1.1^',
            '|1.1.1.1^',
            '||192.168^',
            '||10.0.1^',
            '||192.168.1.1^',
            // valid domain
            '||example.org^',
        ]);
    });
});
