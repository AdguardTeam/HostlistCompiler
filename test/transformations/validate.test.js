const { validate } = require('../../src/transformations/validate');

describe('Validate', () => {
    it('simple /etc/hosts rule', () => {
        const rules = '0.0.0.0 example.org'.split(/\r?\n/);
        const filtered = validate(rules);

        expect(filtered).toHaveLength(1);
        expect(filtered).toContain('0.0.0.0 example.org');
    });

    it('/etc/hosts rules', () => {
        const rules = `0.0.0.0 example.org
0.0.0.0 co.uk
0.0.0.0 doubleclick.net doubleclick.com`.split(/\r?\n/);
        const filtered = validate(rules);

        expect(filtered).toHaveLength(2);
        expect(filtered).toContain('0.0.0.0 example.org');
        expect(filtered).toContain('0.0.0.0 doubleclick.net doubleclick.com');
    });

    it('remove preceding comments', () => {
        const rules = `! rule comment

||invalid/rule
! comment
||valid.com^`.split(/\r?\n/);
        const filtered = validate(rules);

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
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '! here goes a comment',
            '',
            '||example.org^',
            '||ex*.org^', // valid because contains special characters
            '||example.org^$important',
            '||*.ga^$denyallow=example1.ga|example2.ga',
            '://ww4.$denyallow=ww4.example.com',
            '://example.org',
            '||example.org^|',
            '@@||example.org^|$important',
        ]);
    });

    it('adblock-style rules with wildcard and denyallow modifier', () => {
        const rules = `||*.org^$denyallow=example.com
||*.asia^
||*.example.org^
||*.asia^$denyallow=fap.bar
||xyz^$denyallow=example.com
||xyz^`.split(/\r?\n/);
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '||*.org^$denyallow=example.com',
            '||*.example.org^',
            '||*.asia^$denyallow=fap.bar',
            '||xyz^$denyallow=example.com',
        ]);
    });

    it('adblock-style rules with wildcard and badfilter modifier', () => {
        const rules = `||*.org^$badfilter
||*.asia^
||*.example.org^
||*.asia^$badfilter
||xyz^$badfilter
||xyz^`.split(/\r?\n/);
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '||*.org^$badfilter',
            '||*.example.org^',
            '||*.asia^$badfilter',
            '||xyz^$badfilter',
        ]);
    });

    it('adblock-style rules with wildcard and client modifier', () => {
        const rules = `@@||*.org^$client=127.0.0.1
||*.asia^
||*.example.org^
||*.asia^$client=192.168.0.0/24
||xyz^$client=192.168.0.0/24
||xyz^`.split(/\r?\n/);
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '@@||*.org^$client=127.0.0.1',
            '||*.example.org^',
            '||*.asia^$client=192.168.0.0/24',
            '||xyz^$client=192.168.0.0/24',
        ]);
    });

    it('check for composite TLDs', () => {
        const rules = `||*.com.tr^$denyallow=example.com
||*.com.tr^
||*.co.uk^$client=127.0.0.1
||*.co.uk^
||*.example.org^`.split(/\r?\n/);
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '||*.com.tr^$denyallow=example.com',
            '||*.co.uk^$client=127.0.0.1',
            '||*.example.org^',
        ]);
    });

    it('removes whole public suffix variants by default', () => {
        const rules = `||*.org^
.org^
*.org^
||org^
||example.org^`.split(/\r?\n/);
        const filtered = validate(rules);

        expect(filtered).toEqual(['||example.org^']);
    });

    it('removes short ccTLD patterns as public suffixes', () => {
        // ||uk^ and .uk^ are 4 chars — below MAX_PATTERN_LENGTH, but structurally valid
        // domain patterns. The length exception must not bypass the public suffix check.
        const rules = [
            '||uk^',
            '.uk^',
            '@@||uk^',
            '@@.uk^',
            '||example.uk^',
        ];
        const filtered = validate(rules);

        expect(filtered).toEqual(['||example.uk^']);
    });

    it('removes whole public suffix exception variants by default', () => {
        const rules = `@@||*.org^
@@.org^
@@*.org^
@@||org^
@@||example.org^`.split(/\r?\n/);
        const filtered = validate(rules);

        expect(filtered).toEqual(['@@||example.org^']);
    });

    it('rejects malformed domain patterns but keeps valid ones including trailing-dot FQDN', () => {
        const rules = `
||-a^
||a-^
||a..b^
||org..^
||..^
||.foo^
||foo.^
||.org^
||foo.bar.^
||example.org^
||example.org^|
@@||-a^
@@||a-^
@@||a..b^
@@||org..^
@@||..^
@@||.foo^
@@||foo.^
@@||.org^
@@||foo.bar.^
@@||example.org^
@@||example.org^|`.split(/\r?\n/);

        const filtered = validate(rules);

        expect(filtered).toEqual([
            '||foo.bar.^',
            '||example.org^',
            '||example.org^|',
            '@@||foo.bar.^',
            '@@||example.org^',
            '@@||example.org^|',
        ]);
    });

    it('rejects ^| variants targeting public suffixes, keeps ^| for regular domains', () => {
        const rules = [
            '.com^|',
            '.hl.cn^|',
            '@@.com^|',
            '@@.hl.cn^|',
            '.example.org^|',
            '@@.example.org^|',
        ];
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '.example.org^|',
            '@@.example.org^|',
        ]);
    });

    it('rejects unknown single-label patterns not in PSL, keeps valid domains of same length', () => {
        // Validate rejects all public-suffix-only patterns (known or not),
        // but non-PSL labels are rejected for an additional reason: isIcann=false.
        // Valid multi-label domains of similar length are kept to show contrast.
        const rules = [
            '||a^', // unknown, isIcann=false — rejected
            '||a.org^', // valid domain (2 chars pattern) — kept
            '||aa^', // unknown, isIcann=false — rejected
            '||ab.uk^', // valid domain (2+2 chars) — kept
            '||aaa^', // known gTLD, isIcann=true — still rejected (public suffix)
            '||aaa.com^', // valid domain under real TLD — kept
            '||org^', // known TLD, isIcann=true — still rejected (public suffix)
            '||org.example.com^', // valid subdomain — kept
            '||aaaa^', // unknown, isIcann=false — rejected
            '@@||a^', // unknown exception — broad unblock, rejected
            '@@||a.org^', // valid domain exception — kept
            '@@||org^', // known TLD exception — still rejected
            '@@||org.example.com^', // valid subdomain exception — kept
        ];
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '||a.org^',
            '||ab.uk^',
            '||aaa.com^',
            '||org.example.com^',
            '@@||a.org^',
            '@@||org.example.com^',
        ]);
    });

    it('rejects broad blocking/unblocking for non-PSL fake TLDs, keeps valid counterparts', () => {
        // Fake TLD patterns are rejected.
        // Similar-looking valid domain patterns are kept for contrast.
        const rules = [
            '||xyz123notreal^', // fake TLD — rejected
            '||xyz123notreal.com^', // valid domain under .com — kept
            '.xyz123notreal^', // fake TLD — rejected
            '.xyz123notreal.org^', // valid domain under .org — kept
            '*.xyz123notreal^', // fake TLD — rejected
            '@@||xyz123notreal^', // fake TLD exception — rejected
            '@@||xyz123notreal.com^', // valid domain exception — kept
            '@@.xyz123notreal^', // fake TLD exception — rejected
            '@@*.xyz123notreal^', // fake TLD exception — rejected
        ];
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '||xyz123notreal.com^',
            '.xyz123notreal.org^',
            '@@||xyz123notreal.com^',
        ]);
    });

    it('rejects all IP patterns in Validate (subnets and suffixes)', () => {
        // Validate rejects ALL numeric IP-like patterns:
        // - IP-suffix patterns (no | or || prefix) — block unpredictably (e.g., 1.1^ blocks 1.1.1.1, example1.1)
        // - IP-subnet patterns (with | or || prefix) — block IP subnets
        // - Full 4-octet IPs — rejected via tldts.isIp
        const rules = [
            // 1 octet — rejected (too short or invalid)
            '1^',
            '||1^',
            '|1^',
            // 2 octets — IP-suffix (no prefix) — rejected ALWAYS
            '1.1^',
            '192.168^',
            // 2 octets — IP-subnet (with prefix) — rejected in Validate
            '||1.1^',
            '|1.1^',
            '||192.168^',
            '||1.1.',
            '||1.1.^',
            // 3 octets — IP-suffix (no prefix) — rejected ALWAYS
            '1.1.1^',
            '10.0.1^',
            // 3 octets — IP-subnet (with prefix) — rejected in Validate
            '||1.1.2^',
            '|1.1.2^',
            '||10.0.1^',
            '||1.1.2.',
            '||1.1.2.^',
            // 4 octets — IP-suffix (no prefix) — rejected ALWAYS
            '1.1.1.1^',
            '192.168.1.1^',
            // 4 octets — full IP (with prefix) — rejected via tldts.isIp
            '||1.1.1.1^',
            '|1.1.1.1^',
            '||192.168.1.1^',
            '||10.0.0.1^',
            '||255.255.255.255^',
            // valid domains — kept
            '||example.org^',
            '||a.b.c.d^', // 4 labels (not numeric IP) — kept
        ];
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '||example.org^',
            '||a.b.c.d^',
        ]);
    });
});
