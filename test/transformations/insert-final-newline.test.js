const insertFinalNewLine = require('../../src/transformations/insert-final-newline');

describe('Insert final new line', () => {
    it('test with empty file', () => {
        const rules = [];
        const filtered = insertFinalNewLine(rules);
        expect(filtered).toEqual(['']);
    });
    it('test with one empty line', () => {
        const rules = [''];
        const filtered = insertFinalNewLine(rules);
        expect(filtered).toEqual(['']);
    });
    it('test with one rule and one empty lines', () => {
        const rules = [
            'rule1',
            '',
        ];
        const filtered = insertFinalNewLine(rules);
        expect(filtered).toEqual([
            'rule1',
            '',
        ]);
    });
    it('test with many empty lines', () => {
        const rules = [
            'rule1',
            '',
            '',
        ];
        const filtered = insertFinalNewLine(rules);
        expect(filtered).toEqual([
            'rule1',
            '',
            '',
        ]);
    });
    it('test with one rule', () => {
        const rules = [
            'rule1',
        ];
        const filtered = insertFinalNewLine(rules);
        expect(filtered).toEqual([
            'rule1',
            '',
        ]);
    });
});
