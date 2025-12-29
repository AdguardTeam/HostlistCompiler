import { RemoveCommentsTransformation } from '../../src/transformations/RemoveCommentsTransformation';

describe('RemoveCommentsTransformation', () => {
    let transformation: RemoveCommentsTransformation;

    beforeEach(() => {
        transformation = new RemoveCommentsTransformation();
    });

    it('should remove ! comments', () => {
        const rules = [
            '! Comment',
            '||example.org^',
            '! Another comment',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should remove # comments', () => {
        const rules = [
            '# Comment',
            '||example.org^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should remove #### comments', () => {
        const rules = [
            '#### Section',
            '||example.org^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should keep hosts rules with inline comments', () => {
        const rules = [
            '0.0.0.0 example.org # inline comment',
            '||example.org^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toHaveLength(2);
    });

    it('should handle empty array', () => {
        const result = transformation.executeSync([]);
        expect(result).toEqual([]);
    });
});
