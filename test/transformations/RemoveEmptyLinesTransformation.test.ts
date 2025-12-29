import { RemoveEmptyLinesTransformation } from '../../src/transformations/RemoveEmptyLinesTransformation';

describe('RemoveEmptyLinesTransformation', () => {
    let transformation: RemoveEmptyLinesTransformation;

    beforeEach(() => {
        transformation = new RemoveEmptyLinesTransformation();
    });

    it('should remove empty lines', () => {
        const rules = [
            '||example.org^',
            '',
            '||test.com^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^', '||test.com^']);
    });

    it('should remove whitespace-only lines', () => {
        const rules = [
            '||example.org^',
            '   ',
            '||test.com^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^', '||test.com^']);
    });

    it('should handle multiple empty lines', () => {
        const rules = ['', '', '||example.org^', '', ''];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should handle empty array', () => {
        const result = transformation.executeSync([]);
        expect(result).toEqual([]);
    });
});
