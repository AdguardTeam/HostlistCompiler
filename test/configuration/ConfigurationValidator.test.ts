import { assertEquals, assertThrows } from '@std/assert';
import { ConfigurationValidator } from '../../src/configuration/ConfigurationValidator.ts';
import { IConfiguration, SourceType, TransformationType } from '../../src/types/index.ts';

// validate tests
Deno.test('ConfigurationValidator.validate - should validate minimal valid configuration', () => {
    const validator = new ConfigurationValidator();
    const config: IConfiguration = {
        name: 'Test Filter',
        sources: [
            { source: 'https://example.org/list.txt' },
        ],
    };
    const result = validator.validate(config);
    assertEquals(result.valid, true);
    assertEquals(result.errorsText, null);
});

Deno.test('ConfigurationValidator.validate - should validate full configuration', () => {
    const validator = new ConfigurationValidator();
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
    assertEquals(result.valid, true);
});

Deno.test('ConfigurationValidator.validate - should reject configuration without name', () => {
    const validator = new ConfigurationValidator();
    const config = {
        sources: [{ source: 'https://example.org/list.txt' }],
    };
    const result = validator.validate(config);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject configuration without sources', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test Filter',
    };
    const result = validator.validate(config);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject configuration with empty sources', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test Filter',
        sources: [],
    };
    const result = validator.validate(config);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject source without source field', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test Filter',
        sources: [{ name: 'Invalid Source' }],
    };
    const result = validator.validate(config);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject invalid source type', () => {
    const validator = new ConfigurationValidator();
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
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject invalid transformation', () => {
    const validator = new ConfigurationValidator();
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
    assertEquals(result.valid, false);
});

// validateAndGet tests
Deno.test('ConfigurationValidator.validateAndGet - should return configuration for valid input', () => {
    const validator = new ConfigurationValidator();
    const config: IConfiguration = {
        name: 'Test Filter',
        sources: [{ source: 'https://example.org/list.txt' }],
    };
    const result = validator.validateAndGet(config);
    assertEquals(result, config);
});

Deno.test('ConfigurationValidator.validateAndGet - should throw for invalid configuration', () => {
    const validator = new ConfigurationValidator();
    const config = { name: 'Test Filter' };
    assertThrows(
        () => validator.validateAndGet(config),
        Error,
        'Configuration validation failed',
    );
});
