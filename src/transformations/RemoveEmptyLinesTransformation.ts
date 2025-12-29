import { TransformationType } from '../types';
import { SyncTransformation } from './base/Transformation';

/**
 * Transformation that removes empty lines from the rules.
 */
export class RemoveEmptyLinesTransformation extends SyncTransformation {
    public readonly type = TransformationType.RemoveEmptyLines;
    public readonly name = 'RemoveEmptyLines';

    public executeSync(rules: string[]): string[] {
        const filtered = rules.filter((line) => line.trim().length > 0);
        this.info(`Removed ${rules.length - filtered.length} empty lines`);
        return filtered;
    }
}
