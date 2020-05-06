const utils = require('../src/utils');

const { Wildcard } = utils;

describe('Wildcard', () => {
    it('compile a simple URL source', () => {
        let w = new Wildcard('test');
        expect(w.test('1test1')).toBe(true);
        expect(w.test('trara')).toBe(false);

        w = new Wildcard('t*est');
        expect(w.test('test')).toBe(true);
        expect(w.test('t123est')).toBe(true);
        expect(w.test('t12\n3est')).toBe(true);

        w = new Wildcard('/t.*est/');
        expect(w.test('test')).toBe(true);
        expect(w.test('t123est')).toBe(true);
    });
});

describe('substringBetween', () => {
    it('works', () => {
        let substr = utils.substringBetween('<a>test</a>', '<a>', '</a>');
        expect(substr).toBe('test');

        substr = utils.substringBetween('<a>test</a', '<a>', '</a>');
        expect(substr).toBe(null);

        substr = utils.substringBetween('</a><a>test', '<a>', '</a>');
        expect(substr).toBe(null);

        substr = utils.substringBetween('</a>test', '<a>', '</a>');
        expect(substr).toBe(null);
    });
});
