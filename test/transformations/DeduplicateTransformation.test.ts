import { DeduplicateTransformation } from '../../src/transformations/DeduplicateTransformation';

describe('DeduplicateTransformation', () => {
    let transformation: DeduplicateTransformation;

    beforeEach(() => {
        transformation = new DeduplicateTransformation();
    });

    it('should remove duplicate rules', () => {
        const rules = [
            '||example.org^',
            '||test.com^',
            '||example.org^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual([
            '||example.org^',
            '||test.com^',
        ]);
    });

    it('should preserve order', () => {
        const rules = [
            '||first.com^',
            '||second.com^',
            '||third.com^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual([
            '||first.com^',
            '||second.com^',
            '||third.com^',
        ]);
    });

    it('should remove preceding comments for duplicates', () => {
        const rules = [
            '||example.org^',
            '! Comment for duplicate',
            '||example.org^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should keep comments for first occurrence', () => {
        const rules = [
            '! Comment for first',
            '||example.org^',
            '||example.org^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual([
            '! Comment for first',
            '||example.org^',
        ]);
    });

    it('should handle empty array', () => {
        const result = transformation.executeSync([]);
        expect(result).toEqual([]);
    });

    it('should not deduplicate comments', () => {
        const rules = [
            '! Comment',
            '||example.org^',
            '! Comment',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual([
            '! Comment',
            '||example.org^',
            '! Comment',
        ]);
    });
});
