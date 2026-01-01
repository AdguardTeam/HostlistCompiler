import type { IBasicLogger, IFileSystem } from '../types/index.ts';
import { DenoFileSystem } from '../downloader/ContentFetcher.ts';

/**
 * Writes compiled filter list output to files.
 * Follows Single Responsibility Principle - only handles output writing.
 */
export class OutputWriter {
    private readonly fileSystem: IFileSystem;
    private readonly logger: IBasicLogger;

    /**
     * Creates a new OutputWriter
     * @param logger - Logger for diagnostic messages
     * @param fileSystem - File system implementation (injectable for testing)
     */
    constructor(logger: IBasicLogger, fileSystem?: IFileSystem) {
        this.logger = logger;
        this.fileSystem = fileSystem || new DenoFileSystem();
    }

    /**
     * Writes rules to a file
     * @param path - Output file path
     * @param rules - Array of rules to write
     * @throws Error if write fails
     */
    public async writeToFile(path: string, rules: string[]): Promise<void> {
        try {
            this.logger.info(`Writing ${rules.length} rules to ${path}`);
            
            const content = rules.join('\n');
            await this.fileSystem.writeTextFile(path, content);
            
            this.logger.info(`Successfully wrote output to ${path}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to write output: ${message}`);
            throw new Error(`Output write failed: ${message}`);
        }
    }

    /**
     * Validates that a path is writable (checks directory exists)
     * @param path - Path to validate
     * @returns True if path appears valid, false otherwise
     */
    public async validateOutputPath(path: string): Promise<boolean> {
        try {
            // Extract directory from path
            const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
            if (lastSlash > 0) {
                const directory = path.substring(0, lastSlash);
                // Check if directory exists
                try {
                    await Deno.stat(directory);
                    return true;
                } catch {
                    this.logger.warn(`Output directory may not exist: ${directory}`);
                    return false;
                }
            }
            return true;
        } catch {
            return true; // Assume valid if we can't check
        }
    }
}
