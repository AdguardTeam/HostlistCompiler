import { IConfiguration, IValidationResult, TransformationType } from '../types/index.ts';

/**
 * Valid transformation names for validation
 */
const VALID_TRANSFORMATIONS = new Set<string>(Object.values(TransformationType));

/**
 * Valid source types
 */
const VALID_SOURCE_TYPES = new Set(['adblock', 'hosts']);

/**
 * Validation error details
 */
interface ValidationError {
    path: string;
    message: string;
}

/**
 * Validates configuration objects against the expected schema.
 * Pure TypeScript implementation without external dependencies.
 */
export class ConfigurationValidator {
    /**
     * Validates a configuration object.
     * @param configuration - Configuration object to validate
     * @returns Validation result with valid flag and error text
     */
    public validate(configuration: unknown): IValidationResult {
        const errors: ValidationError[] = [];

        if (!configuration || typeof configuration !== 'object') {
            return {
                valid: false,
                errorsText: 'Configuration must be an object',
            };
        }

        const config = configuration as Record<string, unknown>;

        // Validate required fields
        if (!this.isNonEmptyString(config.name)) {
            errors.push({ path: '/name', message: 'name is required and must be a non-empty string' });
        }

        if (!Array.isArray(config.sources) || config.sources.length === 0) {
            errors.push({ path: '/sources', message: 'sources is required and must be a non-empty array' });
        } else {
            // Validate each source
            config.sources.forEach((source, index) => {
                const sourceErrors = this.validateSource(source, `/sources/${index}`);
                errors.push(...sourceErrors);
            });
        }

        // Validate optional string fields
        if (config.description !== undefined && typeof config.description !== 'string') {
            errors.push({ path: '/description', message: 'description must be a string' });
        }
        if (config.homepage !== undefined && typeof config.homepage !== 'string') {
            errors.push({ path: '/homepage', message: 'homepage must be a string' });
        }
        if (config.license !== undefined && typeof config.license !== 'string') {
            errors.push({ path: '/license', message: 'license must be a string' });
        }
        if (config.version !== undefined && typeof config.version !== 'string') {
            errors.push({ path: '/version', message: 'version must be a string' });
        }

        // Validate transformations
        if (config.transformations !== undefined) {
            const transformErrors = this.validateTransformations(
                config.transformations,
                '/transformations'
            );
            errors.push(...transformErrors);
        }

        // Validate exclusions/inclusions arrays
        this.validateStringArray(config.exclusions, '/exclusions', errors);
        this.validateStringArray(config.exclusions_sources, '/exclusions_sources', errors);
        this.validateStringArray(config.inclusions, '/inclusions', errors);
        this.validateStringArray(config.inclusions_sources, '/inclusions_sources', errors);

        // Check for unknown properties
        const validProps = new Set([
            'name', 'description', 'homepage', 'license', 'version',
            'sources', 'transformations', 'exclusions', 'exclusions_sources',
            'inclusions', 'inclusions_sources'
        ]);
        for (const key of Object.keys(config)) {
            if (!validProps.has(key)) {
                errors.push({ path: `/${key}`, message: `unknown property: ${key}` });
            }
        }

        if (errors.length > 0) {
            const errorsText = errors
                .map(e => `${e.path}: ${e.message}`)
                .join('\n');
            return { valid: false, errorsText };
        }

        return { valid: true, errorsText: null };
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
            throw new Error(`Configuration validation failed:\n${result.errorsText}`);
        }

        return configuration as IConfiguration;
    }

    /**
     * Validates a source object.
     */
    private validateSource(source: unknown, basePath: string): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!source || typeof source !== 'object') {
            errors.push({ path: basePath, message: 'source must be an object' });
            return errors;
        }

        const src = source as Record<string, unknown>;

        // Required: source field
        if (!this.isNonEmptyString(src.source)) {
            errors.push({ path: `${basePath}/source`, message: 'source is required and must be a non-empty string' });
        }

        // Optional: name
        if (src.name !== undefined && !this.isNonEmptyString(src.name)) {
            errors.push({ path: `${basePath}/name`, message: 'name must be a non-empty string' });
        }

        // Optional: type
        if (src.type !== undefined) {
            if (typeof src.type !== 'string' || !VALID_SOURCE_TYPES.has(src.type)) {
                errors.push({ path: `${basePath}/type`, message: `type must be one of: ${[...VALID_SOURCE_TYPES].join(', ')}` });
            }
        }

        // Optional: transformations
        if (src.transformations !== undefined) {
            const transformErrors = this.validateTransformations(
                src.transformations,
                `${basePath}/transformations`
            );
            errors.push(...transformErrors);
        }

        // Validate exclusions/inclusions arrays
        this.validateStringArray(src.exclusions, `${basePath}/exclusions`, errors);
        this.validateStringArray(src.exclusions_sources, `${basePath}/exclusions_sources`, errors);
        this.validateStringArray(src.inclusions, `${basePath}/inclusions`, errors);
        this.validateStringArray(src.inclusions_sources, `${basePath}/inclusions_sources`, errors);

        // Check for unknown properties
        const validProps = new Set([
            'name', 'source', 'type', 'transformations',
            'exclusions', 'exclusions_sources', 'inclusions', 'inclusions_sources'
        ]);
        for (const key of Object.keys(src)) {
            if (!validProps.has(key)) {
                errors.push({ path: `${basePath}/${key}`, message: `unknown property: ${key}` });
            }
        }

        return errors;
    }

    /**
     * Validates transformations array.
     */
    private validateTransformations(value: unknown, path: string): ValidationError[] {
        const errors: ValidationError[] = [];

        if (!Array.isArray(value)) {
            errors.push({ path, message: 'transformations must be an array' });
            return errors;
        }

        value.forEach((item, index) => {
            if (typeof item !== 'string') {
                errors.push({ path: `${path}/${index}`, message: 'transformation must be a string' });
            } else if (!VALID_TRANSFORMATIONS.has(item)) {
                errors.push({
                    path: `${path}/${index}`,
                    message: `invalid transformation: ${item}. Valid values: ${[...VALID_TRANSFORMATIONS].join(', ')}`
                });
            }
        });

        return errors;
    }

    /**
     * Validates an optional string array field.
     */
    private validateStringArray(
        value: unknown,
        path: string,
        errors: ValidationError[]
    ): void {
        if (value === undefined) {
            return;
        }

        if (!Array.isArray(value)) {
            errors.push({ path, message: 'must be an array' });
            return;
        }

        value.forEach((item, index) => {
            if (typeof item !== 'string') {
                errors.push({ path: `${path}/${index}`, message: 'must be a string' });
            }
        });
    }

    /**
     * Checks if a value is a non-empty string.
     */
    private isNonEmptyString(value: unknown): value is string {
        return typeof value === 'string' && value.length > 0;
    }
}
