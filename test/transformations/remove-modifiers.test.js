const removeModifiers = require('../../src/transformations/remove-modifiers');

describe('Remove modifiers', () => {
    it('simple test', () => {
        const actual = `! test comment
! next line should have whitespaces. do not remove them. AG-23720

||example.org$third-party,important
||example.net$domain=ya.ru,3p
||islandofadvert.com^$document,popup
||example.com$document
||example.com$doc
||example.com$all
||example.com$network
||example.org^`.split(/\r?\n/);

        const expected = [
            '! test comment',
            '! next line should have whitespaces. do not remove them. AG-23720',
            // whitespaces should be trimmed
            '',
            '||example.org$important',
            '||example.net$domain=ya.ru',
            '||islandofadvert.com^',
            '||example.com',
            '||example.com',
            '||example.com',
            '||example.com',
            '||example.org^',
        ];

        expect(removeModifiers(actual)).toStrictEqual(expected);
    });
});
