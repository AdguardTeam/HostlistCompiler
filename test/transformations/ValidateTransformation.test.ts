import { ValidateTransformation, ValidateAllowIpTransformation } from '../../src/transformations/ValidateTransformation';

describe('ValidateTransformation', () => {
    let transformation: ValidateTransformation;

    beforeEach(() => {
        transformation = new ValidateTransformation();
    });

    describe('valid rules', () => {
        it('should keep valid domain rules', () => {
            const rules = ['||example.org^'];
            const result = transformation.executeSync(rules);
            expect(result).toEqual(['||example.org^']);
        });

        it('should keep comments', () => {
            const rules = ['! Comment'];
            const result = transformation.executeSync(rules);
            expect(result).toEqual(['! Comment']);
        });

        it('should keep empty lines', () => {
            const rules = [''];
            const result = transformation.executeSync(rules);
            expect(result).toEqual(['']);
        });

        it('should keep valid hosts rules', () => {
            const rules = ['0.0.0.0 example.org'];
            const result = transformation.executeSync(rules);
            expect(result).toEqual(['0.0.0.0 example.org']);
        });

        it('should keep rules with supported modifiers', () => {
            const rules = ['||example.org^$important'];
            const result = transformation.executeSync(rules);
            expect(result).toEqual(['||example.org^$important']);
        });

        it('should keep regex rules', () => {
            const rules = ['/example\\.org/'];
            const result = transformation.executeSync(rules);
            expect(result).toEqual(['/example\\.org/']);
        });
    });

    describe('invalid rules', () => {
        it('should remove rules with unsupported modifiers', () => {
            const rules = ['||example.org^$unsupported'];
            const result = transformation.executeSync(rules);
            expect(result).toEqual([]);
        });

        it('should remove too short rules', () => {
            const rules = ['||ex'];
            const result = transformation.executeSync(rules);
            expect(result).toEqual([]);
        });

        it('should remove rules blocking public suffix', () => {
            const rules = ['||org^'];
            const result = transformation.executeSync(rules);
            expect(result).toEqual([]);
        });

        it('should remove IP-based rules by default', () => {
            const rules = ['||127.0.0.1^'];
            const result = transformation.executeSync(rules);
            expect(result).toEqual([]);
        });

        it('should remove preceding comments for invalid rules', () => {
            const rules = [
                '! Comment for invalid',
                '||org^',
            ];
            const result = transformation.executeSync(rules);
            expect(result).toEqual([]);
        });
    });

    describe('with denyallow modifier', () => {
        it('should allow TLD rules with denyallow', () => {
            const rules = ['||org^$denyallow=example.org'];
            const result = transformation.executeSync(rules);
            expect(result).toEqual(['||org^$denyallow=example.org']);
        });
    });
});

describe('ValidateAllowIpTransformation', () => {
    let transformation: ValidateAllowIpTransformation;

    beforeEach(() => {
        transformation = new ValidateAllowIpTransformation();
    });

    it('should allow IP-based rules', () => {
        const rules = ['||127.0.0.1^'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual(['||127.0.0.1^']);
    });

    it('should still validate other aspects', () => {
        const rules = ['||x^'];
        const result = transformation.executeSync(rules);
        expect(result).toEqual([]);
    });
});
