import { ConfigurationValidator } from '../../src/configuration/ConfigurationValidator';
import { IConfiguration, SourceType, TransformationType } from '../../src/types';

describe('ConfigurationValidator', () => {
    let validator: ConfigurationValidator;

    beforeEach(() => {
        validator = new ConfigurationValidator();
    });

    describe('validate', () => {
        it('should validate minimal valid configuration', () => {
            const config: IConfiguration = {
                name: 'Test Filter',
                sources: [
                    { source: 'https://example.org/list.txt' },
                ],
            };
            const result = validator.validate(config);
            expect(result.valid).toBe(true);
            expect(result.errorsText).toBe(null);
        });

        it('should validate full configuration', () => {
            const config: IConfiguration = {
                name: 'Test Filter',
                description: 'Test description',
                homepage: 'https://example.org',
                license: 'MIT',
                version: '1.0.0',
                sources: [
                    {
                        source: 'https://example.org/list.txt',
                        name: 'Test Source',
                        type: SourceType.Adblock,
                        transformations: [TransformationType.RemoveComments],
                    },
                ],
                transformations: [TransformationType.Deduplicate],
            };
            const result = validator.validate(config);
            expect(result.valid).toBe(true);
        });

        it('should reject configuration without name', () => {
            const config = {
                sources: [{ source: 'https://example.org/list.txt' }],
            };
            const result = validator.validate(config);
            expect(result.valid).toBe(false);
        });

        it('should reject configuration without sources', () => {
            const config = {
                name: 'Test Filter',
            };
            const result = validator.validate(config);
            expect(result.valid).toBe(false);
        });

        it('should reject configuration with empty sources', () => {
            const config = {
                name: 'Test Filter',
                sources: [],
            };
            const result = validator.validate(config);
            expect(result.valid).toBe(false);
        });

        it('should reject source without source field', () => {
            const config = {
                name: 'Test Filter',
                sources: [{ name: 'Invalid Source' }],
            };
            const result = validator.validate(config);
            expect(result.valid).toBe(false);
        });

        it('should reject invalid source type', () => {
            const config = {
                name: 'Test Filter',
                sources: [
                    {
                        source: 'https://example.org/list.txt',
                        type: 'invalid',
                    },
                ],
            };
            const result = validator.validate(config);
            expect(result.valid).toBe(false);
        });

        it('should reject invalid transformation', () => {
            const config = {
                name: 'Test Filter',
                sources: [
                    {
                        source: 'https://example.org/list.txt',
                        transformations: ['InvalidTransformation'],
                    },
                ],
            };
            const result = validator.validate(config);
            expect(result.valid).toBe(false);
        });
    });

    describe('validateAndGet', () => {
        it('should return configuration for valid input', () => {
            const config: IConfiguration = {
                name: 'Test Filter',
                sources: [{ source: 'https://example.org/list.txt' }],
            };
            const result = validator.validateAndGet(config);
            expect(result).toEqual(config);
        });

        it('should throw for invalid configuration', () => {
            const config = { name: 'Test Filter' };
            expect(() => validator.validateAndGet(config)).toThrow('Configuration validation failed');
        });
    });
});
