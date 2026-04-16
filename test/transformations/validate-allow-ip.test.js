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
1.1.1.1$denyallow=001114.cn
||1.1.1.1^$denyallow=001114.cn
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

    it('normalizes and validates IP patterns', () => {
        // ValidateAllowIp now normalizes incomplete IP rules to ||ip^ format
        // and rejects patterns that don't work in AdGuard Home.
        const rules = [
            // IP-suffix (no prefix) with ^ — normalized to ||ip^ for 4 octets
            '1.1.1.1^',
            '192.168.1.1^',
            // IP-suffix (no prefix) with ^ — rejected for <4 octets (doesn't work)
            '1.1^',
            '1.1.1^',
            '192.168^',
            '10.0.1^',
            // IP-subnet with ^ and <4 octets — rejected (doesn't work in AdGuard Home)
            '||1.1^',
            '|1.1^',
            '||1.1.1^',
            '|1.1.1^',
            '||192.168^',
            '||10.0.1^',
            // Full 4-octet IPs — normalized to ||ip^
            '||1.1.1.1^',
            '|1.1.1.1^',
            '||192.168.1.1^',
            '1.2.3.4^|',
            '|1.2.3.4^|',
            '||1.2.3.4^|',
            // 3-octet subnet wildcards — allowed (all prefix forms normalize to ||)
            '||192.168.1.',
            '||192.168.1.*',
            '|192.168.1.',
            '|192.168.1.*',
            '192.168.1.',
            // 3-octet without trailing dot — rejected (ambiguous)
            '192.168.1',
            '||192.168.1',
            // 2-octet patterns — rejected (too wide)
            '||1.1.',
            '1.1.',
            // 4-octet with trailing dot or wildcard — rejected (malformed IP, not a complete address)
            '1.2.3.4.',
            '1.2.3.4.*',
            '||1.2.3.4.',
            '||1.2.3.4.*',
            // valid domain — kept
            '||example.org^',
        ];
        const filtered = validateAllowIp(rules);

        expect(filtered).toEqual([
            // 4-octet IPs normalized to ||ip^
            '||1.1.1.1^',
            '||192.168.1.1^',
            '||1.1.1.1^',
            '||1.1.1.1^',
            '||192.168.1.1^',
            '||1.2.3.4^',
            '||1.2.3.4^',
            '||1.2.3.4^',
            // 3-octet subnet wildcards (all prefix forms normalized to ||)
            '||192.168.1.',
            '||192.168.1.*',
            '||192.168.1.',
            '||192.168.1.*',
            '||192.168.1.',
            // valid domain
            '||example.org^',
        ]);
    });
});
