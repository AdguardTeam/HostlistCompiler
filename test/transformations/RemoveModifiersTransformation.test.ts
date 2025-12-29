import { RemoveModifiersTransformation } from '../../src/transformations/RemoveModifiersTransformation';

describe('RemoveModifiersTransformation', () => {
    let transformation: RemoveModifiersTransformation;

    beforeEach(() => {
        transformation = new RemoveModifiersTransformation();
    });

    it('should remove third-party modifier', () => {
        const rules = ['||example.org^$third-party'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should remove 3p modifier', () => {
        const rules = ['||example.org^$3p'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should remove document modifier', () => {
        const rules = ['||example.org^$document'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should remove doc modifier', () => {
        const rules = ['||example.org^$doc'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should remove all modifier', () => {
        const rules = ['||example.org^$all'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should remove popup modifier', () => {
        const rules = ['||example.org^$popup'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should remove network modifier', () => {
        const rules = ['||example.org^$network'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should remove multiple modifiers', () => {
        const rules = ['||example.org^$third-party,document'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should keep important modifier', () => {
        const rules = ['||example.org^$third-party,important'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^$important']);
    });

    it('should not modify comments', () => {
        const rules = ['! Comment'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['! Comment']);
    });

    it('should not modify hosts rules', () => {
        const rules = ['0.0.0.0 example.org'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['0.0.0.0 example.org']);
    });

    it('should handle empty array', () => {
        const result = transformation.executeSync([]);
        expect(result).toEqual([]);
    });
});
