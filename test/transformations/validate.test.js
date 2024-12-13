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

    it('adblock-style rules', () => {
        const rules = `||asia^$denyallow=amzn.asia
||bar^$denyallow=fap.bar
||beauty^$denyallow=homelab.beauty|nic.beauty|vipbj.beauty`;
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '||asia^$denyallow=amzn.asia',
            '||bar^$denyallow=fap.bar',
            '||beauty^$denyallow=homelab.beauty|nic.beauty|vipbj.beauty',
        ]);
    });
});
