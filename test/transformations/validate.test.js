const validate = require('../../src/transformations/validate');

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

    it('adblock-style rules', () => {
        const rules = `! here goes a comment

||example.org^
! invalid rule comment will be removed
||example.com/atata
||ex*.org^
||org^
||example.org^$third-party
||example.org^$important
||an.yandex
||an.yandex.
://example.org`.split(/\r?\n/);
        const filtered = validate(rules);

        expect(filtered).toEqual([
            '! here goes a comment',
            '',
            '||example.org^',
            '||ex*.org^', // valid because contains special characters
            '||example.org^$important',
            '||an.yandex',
            '||an.yandex.',
            '://example.org',
        ]);
    });
});
