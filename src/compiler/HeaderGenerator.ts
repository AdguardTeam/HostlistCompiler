/**
 * Header generation utilities for filter list compilation.
 * Extracts shared header generation logic from FilterCompiler and WorkerCompiler.
 */

import type { IConfiguration, ISource } from '../types/index.ts';
import { PACKAGE_INFO } from '../version.ts';

/**
 * Header generation options
 */
export interface HeaderOptions {
    /** Include checksum placeholder (will be filled later) */
    includeChecksumPlaceholder?: boolean;
    /** Custom timestamp (defaults to current time) */
    timestamp?: Date;
    /** Additional custom header lines */
    customLines?: string[];
}

/**
 * Generates headers for filter lists and sources.
 * Follows Single Responsibility Principle - only handles header generation.
 */
export class HeaderGenerator {
    /**
     * Generates the main list header with metadata.
     * @param configuration - Configuration containing list metadata
     * @param options - Optional header generation options
     * @returns Array of header lines
     */
    public generateListHeader(configuration: IConfiguration, options?: HeaderOptions): string[] {
        const lines = ['!', `! Title: ${configuration.name}`];

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

        const timestamp = options?.timestamp ?? new Date();
        lines.push(`! Last modified: ${timestamp.toISOString()}`);
        lines.push('!');

        // Compiler info
        lines.push(`! Compiled by ${PACKAGE_INFO.name} v${PACKAGE_INFO.version}`);

        // Add custom lines if provided
        if (options?.customLines) {
            for (const line of options.customLines) {
                lines.push(`! ${line}`);
            }
        }

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

    /**
     * Generates a section separator with optional title
     * @param title - Optional section title
     * @returns Array of separator lines
     */
    public generateSectionSeparator(title?: string): string[] {
        if (title) {
            return ['!', `! ========== ${title} ==========`, '!'];
        }
        return ['!'];
    }

    /**
     * Generates statistics header lines
     * @param stats - Statistics object
     * @returns Array of statistics header lines
     */
    public generateStatsHeader(stats: {
        totalRules: number;
        sourceCount: number;
        transformationCount: number;
        compilationTimeMs: number;
    }): string[] {
        return [
            '!',
            '! === Compilation Statistics ===',
            `! Total rules: ${stats.totalRules}`,
            `! Sources: ${stats.sourceCount}`,
            `! Transformations applied: ${stats.transformationCount}`,
            `! Compilation time: ${stats.compilationTimeMs.toFixed(2)}ms`,
            '!',
        ];
    }

    /**
     * Generates a diff summary header
     * @param diff - Diff statistics
     * @returns Array of diff header lines
     */
    public generateDiffHeader(diff: {
        added: number;
        removed: number;
        unchanged: number;
        previousVersion?: string;
    }): string[] {
        const lines = ['!', '! === Changes Since Last Compilation ==='];

        if (diff.previousVersion) {
            lines.push(`! Previous version: ${diff.previousVersion}`);
        }

        lines.push(`! Added: ${diff.added} rules`);
        lines.push(`! Removed: ${diff.removed} rules`);
        lines.push(`! Unchanged: ${diff.unchanged} rules`);
        lines.push('!');

        return lines;
    }

    /**
     * Parses an existing header to extract metadata
     * @param lines - Array of header lines
     * @returns Parsed metadata object
     */
    public parseHeader(lines: string[]): Record<string, string> {
        const metadata: Record<string, string> = {};

        for (const line of lines) {
            if (!line.startsWith('!')) {
                break; // End of header
            }

            const match = line.match(/^!\s*([^:]+):\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                metadata[key.trim().toLowerCase()] = value.trim();
            }
        }

        return metadata;
    }

    // Static methods for convenience
    static prepareHeader = (config: IConfiguration, options?: HeaderOptions): string[] =>
        new HeaderGenerator().generateListHeader(config, options);

    static prepareSourceHeader = (source: ISource): string[] =>
        new HeaderGenerator().generateSourceHeader(source);
}
