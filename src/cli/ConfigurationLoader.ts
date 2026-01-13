import type { IConfiguration, IFileSystem, ISource, SourceType, TransformationType } from '../types/index.ts';
import { DenoFileSystem } from '../downloader/ContentFetcher.ts';

/**
 * Loads and creates filter list configurations.
 * Follows Single Responsibility Principle - only handles configuration loading.
 */
export class ConfigurationLoader {
    private readonly fileSystem: IFileSystem;

    /**
     * Creates a new ConfigurationLoader
     * @param fileSystem - File system implementation (injectable for testing)
     */
    constructor(fileSystem?: IFileSystem) {
        this.fileSystem = fileSystem || new DenoFileSystem();
    }

    /**
     * Loads configuration from a JSON file
     * @param path - Path to configuration file
     * @returns Parsed configuration object
     * @throws Error if file not found or JSON is invalid
     */
    public async loadFromFile(path: string): Promise<IConfiguration> {
        try {
            const content = await this.fileSystem.readTextFile(path);
            const config = JSON.parse(content) as IConfiguration;
            return config;
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON in configuration file: ${error.message}`);
            }
            if (error instanceof Deno.errors.NotFound) {
                throw new Error(`Configuration file not found: ${path}`);
            }
            throw new Error(
                `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Creates a configuration from CLI input arguments
     * @param inputs - Array of input sources (URLs or file paths)
     * @param inputType - Type of input files ('hosts' or 'adblock')
     * @returns Generated configuration object
     */
    public createFromInputs(
        inputs: string[],
        inputType: string = 'hosts',
    ): IConfiguration {
        // Convert input type string to SourceType enum
        const sourceType: SourceType = inputType === 'adblock' ? 'adblock' as SourceType : 'hosts' as SourceType;

        const sources: ISource[] = inputs.map((input) => ({
            source: input,
            type: sourceType,
        }));

        // Default transformations for command-line mode
        const transformations: TransformationType[] = [
            'RemoveComments' as TransformationType,
            'Compress' as TransformationType,
            'RemoveModifiers' as TransformationType,
            'Validate' as TransformationType,
            'Deduplicate' as TransformationType,
            'TrimLines' as TransformationType,
            'InsertFinalNewLine' as TransformationType,
        ];

        return {
            name: 'Blocklist',
            sources,
            transformations,
        };
    }

    /**
     * Validates that a configuration object has required fields
     * @param config - Configuration to validate
     * @returns Error message if invalid, null if valid
     */
    public validateBasicStructure(config: IConfiguration): string | null {
        if (!config.name || typeof config.name !== 'string') {
            return 'Configuration must have a "name" field';
        }

        if (!config.sources || !Array.isArray(config.sources)) {
            return 'Configuration must have a "sources" array';
        }

        if (config.sources.length === 0) {
            return 'Configuration must have at least one source';
        }

        // Validate each source has required fields
        for (let i = 0; i < config.sources.length; i++) {
            const source = config.sources[i];
            if (!source.source || typeof source.source !== 'string') {
                return `Source at index ${i} must have a "source" field`;
            }
        }

        return null;
    }
}
