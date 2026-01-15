import { TransformationType } from '../types/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that removes empty lines from the rules.
 */
export class RemoveEmptyLinesTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.RemoveEmptyLines;
    /** Human-readable name of the transformation */
    public readonly name = 'RemoveEmptyLines';

    /**
     * Removes all empty lines from the rules.
     * @param rules - Array of rules to process
     * @returns Array with empty lines removed
     */
    public executeSync(rules: string[]): string[] {
        const filtered = rules.filter((line) => line.trim().length > 0);
        this.info(`Removed ${rules.length - filtered.length} empty lines`);
        return filtered;
    }
}
