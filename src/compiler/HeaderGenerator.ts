import type { IConfiguration, ISource } from '../types/index.ts';

/**
 * Package metadata for header generation.
 * Version matches deno.json for JSR publishing.
 */
const PACKAGE_INFO = {
    name: '@jk-com/adblock-compiler',
    version: '0.6.88',
} as const;

/**
 * Generates headers for filter lists and sources.
 * Follows Single Responsibility Principle - only handles header generation.
 */
export class HeaderGenerator {
    /**
     * Generates the main list header with metadata.
     * @param configuration - Configuration containing list metadata
     * @returns Array of header lines
     */
    public generateListHeader(configuration: IConfiguration): string[] {
        const lines = [
            '!',
            `! Title: ${configuration.name}`,
        ];

        if (configuration.description) {
            lines.push(`! Description: ${configuration.description}`);
        }
        if (configuration.version) {
            lines.push(`! Version: ${configuration.version}`);
        }
        if (configuration.homepage) {
            lines.push(`! Homepage: ${configuration.homepage}`);
        }
        if (configuration.license) {
            lines.push(`! License: ${configuration.license}`);
        }

        lines.push(`! Last modified: ${new Date().toISOString()}`);
        lines.push('!');

        // Compiler info
        lines.push(`! Compiled by ${PACKAGE_INFO.name} v${PACKAGE_INFO.version}`);
        lines.push('!');

        return lines;
    }

    /**
     * Generates the source header.
     * @param source - Source configuration
     * @returns Array of header lines
     */
    public generateSourceHeader(source: ISource): string[] {
        const lines = ['!'];

        if (source.name) {
            lines.push(`! Source name: ${source.name}`);
        }
        lines.push(`! Source: ${source.source}`);
        lines.push('!');

        return lines;
    }
}
