import { CompressTransformation } from '../../src/transformations/CompressTransformation';

describe('CompressTransformation', () => {
    let transformation: CompressTransformation;

    beforeEach(() => {
        transformation = new CompressTransformation();
    });

    it('should convert hosts rules to adblock format', () => {
        const rules = ['0.0.0.0 example.org'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should convert plain domain to adblock format', () => {
        const rules = ['example.org'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should remove redundant subdomain rules', () => {
        const rules = [
            '||example.org^',
            '||sub.example.org^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should keep non-redundant subdomain rules', () => {
        const rules = [
            '||sub.example.org^',
            '||other.com^',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual([
            '||sub.example.org^',
            '||other.com^',
        ]);
    });

    it('should handle hosts rules with multiple domains', () => {
        const rules = ['0.0.0.0 example.org www.example.org'];
        const result = transformation.executeSync(rules);
        // www.example.org should be removed as redundant
        expect(result).toEqual(['||example.org^']);
    });

    it('should keep rules that cannot be compressed', () => {
        const rules = [
            '||example.org^',
            '||example.org^$important',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toHaveLength(2);
    });

    it('should handle empty array', () => {
        const result = transformation.executeSync([]);
        expect(result).toEqual([]);
    });

    it('should deduplicate identical hosts rules', () => {
        const rules = [
            '0.0.0.0 example.org',
            '0.0.0.0 example.org',
        ];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });
});
