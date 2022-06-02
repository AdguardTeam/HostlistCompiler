const trimLines = require('../../src/transformations/trim-lines');

describe('Trim lines', () => {
    it('test with empty file', () => {
        const rules = [];
        const filtered = trimLines(rules);
        expect(filtered).toEqual([]);
    });
    it('test with one empty line', () => {
        const rules = [''];
        const filtered = insertFinalNewLine(rules);
        expect(filtered).toEqual(['']);
    });
    it('test with three rules', () => {
        const rules = [
            'rule1',
            '   rule2 ',
            '',
            '          rule3         '
        ];
        const filtered = insertFinalNewLine(rules);
        expect(filtered).toEqual([
            'rule1',
            'rule2',
            '',
            'rule3'
        ]);
    });
    it('test with three rules and comments', () => {
        const rules = [
            'rule1',
            '   rule2 ',
            '',
            '',
            '! comment ',
            '          rule3         ',
            '    ! comment multiple   words    ',
            '',
        ];
        const filtered = insertFinalNewLine(rules);
        expect(filtered).toEqual([
            'rule1',
            'rule2',
            '',
            '',
            '! comment',
            'rule3',
            '! comment multiple   words',
            ''
        ]);
    });
});
