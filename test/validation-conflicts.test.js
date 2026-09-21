const Ajv = require('ajv');
const { TRANSFORMATIONS, VALIDATION_TRANSFORMATIONS } = require('../src/transformations/enum');
const {
    checkIncompatibleValidationTransformations,
    checkCrossLevelValidationConflicts,
    buildSchemaConflictRules,
} = require('../src/validation-conflicts');

describe('Validation conflicts', () => {
    describe('checkIncompatibleValidationTransformations', () => {
        it.each([
            ['Validate', 'ValidateAllowIp'],
            ['Validate', 'ValidateAllowPublicSuffix'],
            ['Validate', 'ValidateAllowIpAndPublicSuffix'],
            ['ValidateAllowIp', 'ValidateAllowPublicSuffix'],
            ['ValidateAllowIp', 'ValidateAllowIpAndPublicSuffix'],
            ['ValidateAllowPublicSuffix', 'ValidateAllowIpAndPublicSuffix'],
        ])('throws when incompatible validation transformations are combined: %s + %s', (first, second) => {
            const transformations = [first, second];

            expect(() => checkIncompatibleValidationTransformations(transformations))
                .toThrow(`Validation transformations cannot be combined: ${transformations.join(', ')}.`);
        });

        it('throws when three validation transformations are combined', () => {
            const transformations = ['Validate', 'ValidateAllowIp', 'ValidateAllowPublicSuffix'];

            expect(() => checkIncompatibleValidationTransformations(transformations))
                .toThrow(`Validation transformations cannot be combined: ${transformations.join(', ')}.`);
        });

        it('does not throw for a single validation transformation', () => {
            expect(() => checkIncompatibleValidationTransformations(['Validate'])).not.toThrow();
        });

        it('does not throw without validation transformations', () => {
            expect(() => checkIncompatibleValidationTransformations(['RemoveComments', 'Compress'])).not.toThrow();
            expect(() => checkIncompatibleValidationTransformations([])).not.toThrow();
        });
    });

    describe('checkCrossLevelValidationConflicts', () => {
        it('throws when validation transformations are used at both source and top level', () => {
            const configuration = {
                transformations: ['Validate'],
                sources: [
                    {
                        source: 'test.txt',
                        transformations: ['ValidateAllowPublicSuffix'],
                    },
                ],
            };

            expect(() => checkCrossLevelValidationConflicts(configuration)).toThrow(
                /Validation transformations cannot be used at both source and top level/,
            );
        });

        it('does not throw when a validation transformation is used at source level only', () => {
            const configuration = {
                sources: [
                    {
                        source: 'test.txt',
                        transformations: ['ValidateAllowPublicSuffix'],
                    },
                ],
            };

            expect(() => checkCrossLevelValidationConflicts(configuration)).not.toThrow();
        });

        it('does not throw when a validation transformation is used at top level only', () => {
            const configuration = {
                transformations: ['Validate'],
                sources: [
                    {
                        source: 'test.txt',
                    },
                ],
            };

            expect(() => checkCrossLevelValidationConflicts(configuration)).not.toThrow();
        });

        it('does not throw without validation transformations', () => {
            const configuration = {
                sources: [
                    {
                        source: 'test.txt',
                        transformations: ['RemoveComments'],
                    },
                ],
            };

            expect(() => checkCrossLevelValidationConflicts(configuration)).not.toThrow();
        });
    });

    describe('buildSchemaConflictRules', () => {
        it('generates a rule for each unordered pair of validation transformations', () => {
            // A literal list, independent of the implementation's pairing logic.
            const expectedPairs = [
                ['Validate', 'ValidateAllowIp'],
                ['Validate', 'ValidateAllowPublicSuffix'],
                ['Validate', 'ValidateAllowIpAndPublicSuffix'],
                ['ValidateAllowIp', 'ValidateAllowPublicSuffix'],
                ['ValidateAllowIp', 'ValidateAllowIpAndPublicSuffix'],
                ['ValidateAllowPublicSuffix', 'ValidateAllowIpAndPublicSuffix'],
            ];

            const generatedPairs = buildSchemaConflictRules().map((rule) => rule.not.allOf
                .map((part) => part.contains.const));

            expect(generatedPairs).toEqual(expectedPairs);
        });

        it('rejects a transformations list with multiple validation transformations', () => {
            const ajv = new Ajv();
            const validate = ajv.compile({ type: 'array', allOf: buildSchemaConflictRules() });

            expect(validate(['Validate', 'ValidateAllowIp'])).toBe(false);
            expect(validate(['Validate', 'ValidateAllowIp', 'ValidateAllowPublicSuffix'])).toBe(false);
            expect(validate(['Validate'])).toBe(true);
            expect(validate(['RemoveComments', 'Compress'])).toBe(true);
        });
    });

    it('keeps every validation transformation frozen', () => {
        expect(Object.isFrozen(VALIDATION_TRANSFORMATIONS)).toBe(true);
    });

    it('keeps every validation transformation a member of the TRANSFORMATIONS enum', () => {
        // Regression guard: VALIDATION_TRANSFORMATIONS is built from TRANSFORMATIONS.*
        // references (see src/transformations/enum.js), so a hand-typed literal or a
        // renamed enum key would produce an entry that is not a member of the enum.
        const transformationNames = Object.values(TRANSFORMATIONS);

        VALIDATION_TRANSFORMATIONS.forEach((name) => {
            expect(transformationNames).toContain(name);
        });
    });
});
