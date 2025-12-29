import { ConvertToAsciiTransformation } from '../../src/transformations/ConvertToAsciiTransformation';

describe('ConvertToAsciiTransformation', () => {
    let transformation: ConvertToAsciiTransformation;

    beforeEach(() => {
        transformation = new ConvertToAsciiTransformation();
    });

    it('should convert non-ASCII domain to punycode', () => {
        const rules = ['||пример.рф^'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||xn--e1afmkfd.xn--p1ai^']);
    });

    it('should not modify ASCII domains', () => {
        const rules = ['||example.org^'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||example.org^']);
    });

    it('should not modify comments', () => {
        const rules = ['! Comment with пример'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['! Comment with пример']);
    });

    it('should not modify empty lines', () => {
        const rules = [''];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['']);
    });

    it('should handle hosts rules with non-ASCII', () => {
        const rules = ['0.0.0.0 пример.рф'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['0.0.0.0 xn--e1afmkfd.xn--p1ai']);
    });

    it('should handle wildcard patterns with non-ASCII', () => {
        const rules = ['||*.пример.рф^'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||*.xn--e1afmkfd.xn--p1ai^']);
    });

    it('should handle mixed ASCII and non-ASCII', () => {
        const rules = ['||test.пример.рф^'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||test.xn--e1afmkfd.xn--p1ai^']);
    });

    it('should handle empty array', () => {
        const result = transformation.executeSync([]);
        expect(result).toEqual([]);
    });
});
