import type { IBasicLogger } from '../types/index.ts';
import { ConditionalEvaluator } from './ConditionalEvaluator.ts';

/**
 * Preprocessor directive types for filter lists
 */
export enum DirectiveType {
    If = '!#if',
    Else = '!#else',
    EndIf = '!#endif',
    Include = '!#include',
    Safari = '!#safari_cb_affinity',
}

/**
 * Represents a conditional block in the filter
 */
export interface ConditionalBlock {
    condition: string;
    ifLines: string[];
    elseLines: string[];
    endIndex: number;
}

/**
 * Callback for loading included files
 */
export type IncludeLoader = (path: string) => Promise<string[]>;

/**
 * Processes preprocessor directives in filter lists.
 * Follows Single Responsibility Principle - only handles directive processing.
 * 
 * Supports:
 * - !#if / !#else / !#endif conditionals
 * - !#include file inclusion
 * - !#safari_cb_affinity blocks
 */
export class PreprocessorEvaluator {
    private readonly conditionalEvaluator: ConditionalEvaluator;
    private readonly logger: IBasicLogger;
    private readonly includeLoader?: IncludeLoader;

    /**
     * Creates a new PreprocessorEvaluator
     * @param logger - Logger for diagnostic messages
     * @param platform - Platform identifier for conditional evaluation
     * @param includeLoader - Optional callback to load included files
     */
    constructor(
        logger: IBasicLogger,
        platform?: string,
        includeLoader?: IncludeLoader,
    ) {
        this.logger = logger;
        this.conditionalEvaluator = new ConditionalEvaluator(platform);
        this.includeLoader = includeLoader;
    }

    /**
     * Processes preprocessor directives in filter lines
     * @param lines - Array of filter lines to process
     * @returns Processed array with directives resolved
     * @throws Error if directive syntax is invalid
     */
    public async process(lines: string[]): Promise<string[]> {
        const result: string[] = [];
        let i = 0;

        try {
            while (i < lines.length) {
                const line = lines[i];
                const trimmed = line.trim();

                // Handle !#if directive
                if (trimmed.startsWith(DirectiveType.If)) {
                    const block = this.parseConditionalBlock(lines, i);
                    const condition = trimmed.substring(DirectiveType.If.length).trim();

                    this.logger.debug(`Evaluating condition: ${condition}`);

                    // Evaluate condition and include appropriate lines
                    if (this.conditionalEvaluator.evaluate(condition)) {
                        const processed = await this.process(block.ifLines);
                        result.push(...processed);
                    } else if (block.elseLines.length > 0) {
                        const processed = await this.process(block.elseLines);
                        result.push(...processed);
                    }

                    // Skip to after the block
                    i = block.endIndex + 1;
                    continue;
                }

                // Handle !#include directive
                if (trimmed.startsWith(DirectiveType.Include)) {
                    const includePath = trimmed.substring(DirectiveType.Include.length).trim();

                    if (!this.includeLoader) {
                        this.logger.warn(`Include directive found but no loader configured: ${includePath}`);
                        i++;
                        continue;
                    }

                    try {
                        this.logger.debug(`Including: ${includePath}`);
                        const included = await this.includeLoader(includePath);
                        result.push(...included);
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        this.logger.warn(`Failed to include ${includePath}: ${message}`);
                    }

                    i++;
                    continue;
                }

                // Handle !#safari_cb_affinity (skip these blocks for non-Safari)
                if (trimmed.startsWith(DirectiveType.Safari)) {
                    // Skip until we find the end marker or run out of lines
                    i++;
                    while (i < lines.length) {
                        const currentLine = lines[i].trim();
                        if (
                            currentLine.startsWith('!#safari_cb_affinity') &&
                            currentLine.length === DirectiveType.Safari.length
                        ) {
                            i++;
                            break;
                        }
                        i++;
                    }
                    continue;
                }

                // Regular line - add to result
                result.push(line);
                i++;
            }

            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to process directives: ${message}`);
            throw new Error(`Preprocessor evaluation failed: ${message}`);
        }
    }

    /**
     * Parses a conditional block starting at the given index
     * @param lines - All lines in the file
     * @param startIndex - Index of the !#if line
     * @returns Parsed conditional block
     * @throws Error if block structure is invalid
     */
    private parseConditionalBlock(lines: string[], startIndex: number): ConditionalBlock {
        const ifLines: string[] = [];
        const elseLines: string[] = [];
        let inElse = false;
        let depth = 1;
        let i = startIndex + 1;

        while (i < lines.length && depth > 0) {
            const trimmed = lines[i].trim();

            if (trimmed.startsWith(DirectiveType.If)) {
                depth++;
            } else if (trimmed.startsWith(DirectiveType.EndIf)) {
                depth--;
                if (depth === 0) {
                    break;
                }
            } else if (trimmed.startsWith(DirectiveType.Else) && depth === 1) {
                inElse = true;
                i++;
                continue;
            }

            if (inElse) {
                elseLines.push(lines[i]);
            } else {
                ifLines.push(lines[i]);
            }

            i++;
        }

        if (depth !== 0) {
            throw new Error(`Unmatched !#if directive at line ${startIndex + 1}`);
        }

        const condition = lines[startIndex].trim().substring(DirectiveType.If.length).trim();

        return {
            condition,
            ifLines,
            elseLines,
            endIndex: i,
        };
    }

    /**
     * Validates that all directives are properly structured
     * @param lines - Lines to validate
     * @returns True if valid, false otherwise
     */
    public validate(lines: string[]): boolean {
        let depth = 0;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            if (trimmed.startsWith(DirectiveType.If)) {
                depth++;
            } else if (trimmed.startsWith(DirectiveType.EndIf)) {
                depth--;
                if (depth < 0) {
                    this.logger.error(`Unmatched !#endif at line ${i + 1}`);
                    return false;
                }
            }
        }

        if (depth !== 0) {
            this.logger.error(`${depth} unmatched !#if directive(s)`);
            return false;
        }

        return true;
    }
}
