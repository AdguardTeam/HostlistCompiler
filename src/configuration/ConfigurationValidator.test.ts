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

// Additional validation tests for better coverage
Deno.test('ConfigurationValidator.validate - should reject null configuration', () => {
    const validator = new ConfigurationValidator();
    const result = validator.validate(null);
    assertEquals(result.valid, false);
    assertEquals(result.errors.length > 0, true);
});

Deno.test('ConfigurationValidator.validate - should reject non-object configuration', () => {
    const validator = new ConfigurationValidator();
    const result = validator.validate('not an object' as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject empty string name', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: '',
        sources: [{ source: 'https://example.org/list.txt' }],
    };
    const result = validator.validate(config);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-string name', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 123,
        sources: [{ source: 'https://example.org/list.txt' }],
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-string description', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        description: 123,
        sources: [{ source: 'https://example.org/list.txt' }],
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-string homepage', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        homepage: 123,
        sources: [{ source: 'https://example.org/list.txt' }],
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-string license', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        license: true,
        sources: [{ source: 'https://example.org/list.txt' }],
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-string version', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        version: 1.0,
        sources: [{ source: 'https://example.org/list.txt' }],
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject unknown top-level property', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: [{ source: 'https://example.org/list.txt' }],
        unknownProp: 'value',
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-array sources', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: 'not an array',
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-object source', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: ['not an object'],
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject empty source string', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: [{ source: '' }],
    };
    const result = validator.validate(config);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-string source name', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: [
            {
                source: 'https://example.org/list.txt',
                name: 123,
            },
        ],
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject empty source name', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: [
            {
                source: 'https://example.org/list.txt',
                name: '',
            },
        ],
    };
    const result = validator.validate(config);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject unknown source property', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: [
            {
                source: 'https://example.org/list.txt',
                unknownProp: 'value',
            },
        ],
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-array transformations', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: [{ source: 'https://example.org/list.txt' }],
        transformations: 'not an array',
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-string transformation', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: [{ source: 'https://example.org/list.txt' }],
        transformations: [123],
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should reject non-array source transformations', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: [
            {
                source: 'https://example.org/list.txt',
                transformations: 'not an array',
            },
        ],
    };
    const result = validator.validate(config as any);
    assertEquals(result.valid, false);
});

Deno.test('ConfigurationValidator.validate - should accept all valid source types', () => {
    const validator = new ConfigurationValidator();
    
    // Test adblock type
    const config1 = {
        name: 'Test',
        sources: [
            {
                source: 'https://example.org/list.txt',
                type: SourceType.Adblock,
            },
        ],
    };
    assertEquals(validator.validate(config1).valid, true);
    
    // Test hosts type
    const config2 = {
        name: 'Test',
        sources: [
            {
                source: 'https://example.org/list.txt',
                type: SourceType.Hosts,
            },
        ],
    };
    assertEquals(validator.validate(config2).valid, true);
});

Deno.test('ConfigurationValidator.validate - should accept all valid transformations', () => {
    const validator = new ConfigurationValidator();
    const allTransformations = [
        TransformationType.ConvertToAscii,
        TransformationType.TrimLines,
        TransformationType.RemoveComments,
        TransformationType.Compress,
        TransformationType.RemoveModifiers,
        TransformationType.InvertAllow,
        TransformationType.Validate,
        TransformationType.ValidateAllowIp,
        TransformationType.Deduplicate,
        TransformationType.RemoveEmptyLines,
        TransformationType.InsertFinalNewLine,
    ];
    
    const config = {
        name: 'Test',
        sources: [{ source: 'https://example.org/list.txt' }],
        transformations: allTransformations,
    };
    const result = validator.validate(config);
    assertEquals(result.valid, true);
});

Deno.test('ConfigurationValidator.validate - should handle inclusions and exclusions', () => {
    const validator = new ConfigurationValidator();
    const config = {
        name: 'Test',
        sources: [{ source: 'https://example.org/list.txt' }],
        inclusions: ['*.example.com'],
        exclusions: ['ads.example.com'],
        inclusions_sources: ['https://example.org/include.txt'],
        exclusions_sources: ['https://example.org/exclude.txt'],
    };
    const result = validator.validate(config);
    assertEquals(result.valid, true);
});

Deno.test('ConfigurationValidator.validateAndGet - should throw with detailed error message', () => {
    const validator = new ConfigurationValidator();
    const config = { 
        name: '',  // Invalid: empty name
        sources: [],  // Invalid: empty sources
    };
    
    try {
        validator.validateAndGet(config);
        throw new Error('Should have thrown');
    } catch (error) {
        assertEquals(error.message.includes('Configuration validation failed'), true);
        assertEquals(error.message.length > 50, true);  // Should have detailed errors
    }
});
