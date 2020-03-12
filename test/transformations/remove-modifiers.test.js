const removeModifiers = require('../../src/transformations/remove-modifiers');

describe('Strip third-party', () => {
    it('simple test', () => {
        const rules = `! test comment
||example.org$third-party,important
||example.net$domain=ya.ru,3p
||islandofadvert.com^$document,popup
||example.com$document
||example.com$all
||example.org^`.split(/\r?\n/);
        const filtered = removeModifiers(rules);

        expect(filtered).toHaveLength(7);
        expect(filtered[0]).toBe('! test comment');
        expect(filtered[1]).toBe('||example.org$important');
        expect(filtered[2]).toBe('||example.net$domain=ya.ru');
        expect(filtered[3]).toBe('||islandofadvert.com^');
        expect(filtered[4]).toBe('||example.com');
        expect(filtered[5]).toBe('||example.com');
        expect(filtered[6]).toBe('||example.org^');
    });
});
