const removeEmptyLines = require('../../src/transformations/remove-empty-lines');

describe('Remove empty lines', () => {
    it('test with no empty lines', () => {
        const rules = [
            'rule1',
            'rule2',
        ];
        const filtered = removeEmptyLines(rules);
        expect(filtered).toEqual([
            'rule1',
            'rule2',
        ]);
    });
    it('test with one empty line at the end', () => {
        const rules = [
            'rule1',
            'rule2',
            '',
        ];
        const filtered = removeEmptyLines(rules);
        expect(filtered).toEqual([
            'rule1',
            'rule2',
        ]);
    });
    it('test with one empty line between the rules', () => {
        const rules = [
            'rule1',
            '',
            'rule2',
        ];
        const filtered = removeEmptyLines(rules);
        expect(filtered).toEqual([
            'rule1',
            'rule2',
        ]);
    });
    it('test with two empty line', () => {
        const rules = [
            'rule1',
            '',
            '',
            'rule2',
        ];
        const filtered = removeEmptyLines(rules);
        expect(filtered).toEqual([
            'rule1',
            'rule2',
        ]);
    });
    it('test with comments, empty lines', () => {
        const rules = [
            '! aaa',
            'rule1',
            '',
            '! bbb',
            '',
            '',
            'rule2',
            '',
            '',
            '',
            '!ccc',
            '',
            '',
        ];
        const filtered = removeEmptyLines(rules);
        expect(filtered).toEqual([
            '! aaa',
            'rule1',
            '! bbb',
            'rule2',
            '!ccc',
        ]);
    });
});
