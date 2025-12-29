import { InvertAllowTransformation } from '../../src/transformations/InvertAllowTransformation';

describe('InvertAllowTransformation', () => {
    let transformation: InvertAllowTransformation;

    beforeEach(() => {
        transformation = new InvertAllowTransformation();
    });

    it('should invert blocking rules', () => {
        const rules = ['||example.org^'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['@@||example.org^']);
    });

    it('should not invert allow rules', () => {
        const rules = ['@@||example.org^'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['@@||example.org^']);
    });

    it('should not invert comments', () => {
        const rules = ['! Comment'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['! Comment']);
    });

    it('should not invert hosts rules', () => {
        const rules = ['0.0.0.0 example.org'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['0.0.0.0 example.org']);
    });

    it('should handle empty array', () => {
        const result = transformation.executeSync([]);
        expect(result).toEqual([]);
    });

    it('should handle multiple rules', () => {
        const rules = [
            '||example.org^',
            '@@||allowed.org^',
            '! Comment',
            '||test.com^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual([
            '@@||example.org^',
            '@@||allowed.org^',
            '! Comment',
            '@@||test.com^',
        ]);
    });
});
