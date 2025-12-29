import Ajv from 'ajv';
import betterAjvErrors from 'better-ajv-errors';
import { IConfiguration, IValidationResult } from '../types';
import configurationSchema from '../schemas/configuration.schema.json';

/**
 * Validates configuration objects against the JSON schema.
 */
export class ConfigurationValidator {
    private readonly ajv: Ajv.Ajv;
    private readonly schema: object;

    constructor() {
        this.ajv = new Ajv({ allErrors: true, jsonPointers: true });
        this.schema = configurationSchema;
    }

    /**
     * Validates a configuration object against the schema.
     * @param configuration - Configuration object to validate
     * @returns Validation result with valid flag and error text
     */
    public validate(configuration: unknown): IValidationResult {
        const validate = this.ajv.compile(this.schema);
        const valid = validate(configuration);

        return {
            valid: !!valid,
            errorsText: valid
                ? null
                : betterAjvErrors(this.schema, configuration, validate.errors, { format: 'cli' }) as unknown as string,
        };
    }

    /**
     * Validates and returns a typed configuration.
     * @param configuration - Configuration object to validate
     * @returns Validated configuration
     * @throws Error if validation fails
     */
    public validateAndGet(configuration: unknown): IConfiguration {
        const result = this.validate(configuration);

        if (!result.valid) {
            throw new Error(`Configuration validation failed: ${result.errorsText}`);
        }

        return configuration as IConfiguration;
    }
}
