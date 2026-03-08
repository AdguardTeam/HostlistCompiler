import { IConfiguration, IValidationResult } from '../types/index.ts';
import { ConfigurationSchema } from './schemas.ts';
import { z } from 'zod';

/**
 * Validation error details
 */
interface ValidationError {
    path: string;
    message: string;
}

/**
 * Validates configuration objects against the expected schema.
 * Uses Zod for runtime validation with TypeScript integration.
 */
export class ConfigurationValidator {
    /**
     * Converts Zod errors to the format expected by existing code.
     * Maintains compatibility with previous error message format.
     */
    private formatZodErrors(error: z.ZodError): ValidationError[] {
        const errors: ValidationError[] = [];

        for (const issue of error.issues) {
            const path = '/' + issue.path.join('/');
            let message = issue.message;

            // Customize error messages for better compatibility
            if (issue.code === 'invalid_type') {
                const fieldName = String(issue.path[issue.path.length - 1] || 'field');
                if ('received' in issue && issue.received === 'undefined') {
                    message = `${fieldName} is required`;
                } else {
                    message = `must be ${'expected' in issue ? issue.expected : 'valid type'}`;
                }
            } else if (issue.code === 'unrecognized_keys') {
                if ('keys' in issue && Array.isArray(issue.keys)) {
                    for (const key of issue.keys) {
                        errors.push({
                            path: issue.path.length > 0 ? `/${issue.path.join('/')}/${key}` : `/${key}`,
                            message: `unknown property: ${key}`,
                        });
                    }
                    continue;
                }
            } else if (issue.code === 'too_small') {
                const fieldName = String(issue.path[issue.path.length - 1] || 'field');
                if ('minimum' in issue && issue.minimum === 1) {
                    if ('type' in issue) {
                        if (issue.type === 'string') {
                            message = `${fieldName} is required and must be a non-empty string`;
                        } else if (issue.type === 'array') {
                            message = `${fieldName} is required and must be a non-empty array`;
                        }
                    }
                }
            } else if (issue.code === 'invalid_value') {
                // Handle enum values
                if ('options' in issue && Array.isArray(issue.options)) {
                    message = `type must be one of: ${issue.options.join(', ')}`;
                }
            }

            errors.push({ path, message });
        }

        return errors;
    }

    /**
     * Validates a configuration object.
     * @param configuration - Configuration object to validate
     * @returns Validation result with valid flag and error text
     */
    public validate(configuration: unknown): IValidationResult {
        // Handle null/undefined early
        if (!configuration || typeof configuration !== 'object') {
            return {
                valid: false,
                errorsText: 'Configuration must be an object',
            };
        }

        const result = ConfigurationSchema.safeParse(configuration);

        if (!result.success) {
            const errors = this.formatZodErrors(result.error);
            const errorsText = errors
                .map((e) => `${e.path}: ${e.message}`)
                .join('\n');
            return { valid: false, errorsText };
        }

        return { valid: true, errorsText: null };
    }

    /**
     * Validates and returns a typed configuration.
     * @param configuration - Configuration object to validate
     * @returns Validated and transformed configuration (Zod-coerced values, e.g. trimmed strings)
     * @throws Error if validation fails
     */
    public validateAndGet(configuration: unknown): IConfiguration {
        if (!configuration || typeof configuration !== 'object') {
            throw new Error('Configuration must be an object');
        }
        const result = ConfigurationSchema.safeParse(configuration);
        if (!result.success) {
            const errors = this.formatZodErrors(result.error);
            throw new Error(`Configuration validation failed:\n${errors.map((e) => `${e.path}: ${e.message}`).join('\n')}`);
        }
        return result.data;
    }
}
