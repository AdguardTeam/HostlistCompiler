import { InsertFinalNewLineTransformation } from '../../src/transformations/InsertFinalNewLineTransformation';

describe('InsertFinalNewLineTransformation', () => {
    let transformation: InsertFinalNewLineTransformation;

    beforeEach(() => {
        transformation = new InsertFinalNewLineTransformation();
    });

    it('should add newline to non-empty list', () => {
        const rules = ['||example.org^'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^', '']);
    });

    it('should add newline to empty list', () => {
        const result = transformation.executeSync([]);
        expect(result).toEqual(['']);
    });

    it('should not add newline if already present', () => {
        const rules = ['||example.org^', ''];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^', '']);
    });

    it('should not add newline if last line is whitespace', () => {
        const rules = ['||example.org^', '   '];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^', '   ']);
    });
});
