import { TrimLinesTransformation } from '../../src/transformations/TrimLinesTransformation';

describe('TrimLinesTransformation', () => {
    let transformation: TrimLinesTransformation;

    beforeEach(() => {
        transformation = new TrimLinesTransformation();
    });

    it('should trim leading spaces', () => {
        const rules = ['  ||example.org^'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should trim trailing spaces', () => {
        const rules = ['||example.org^  '];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should trim tabs', () => {
        const rules = ['\t||example.org^\t'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should trim mixed whitespace', () => {
        const rules = ['  \t||example.org^\t  '];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should handle empty array', () => {
        const result = transformation.executeSync([]);
        expect(result).toEqual([]);
    });
});
