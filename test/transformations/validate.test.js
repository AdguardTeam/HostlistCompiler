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
});
