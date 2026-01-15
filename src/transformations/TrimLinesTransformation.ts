import { TransformationType } from '../types/index.ts';
import { StringUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that removes leading and trailing whitespace from lines.
 */
export class TrimLinesTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.TrimLines;
    /** Human-readable name of the transformation */
    public readonly name = 'TrimLines';

    /**
     * Trims whitespace from all lines.
     * @param rules - Array of rules to process
     * @returns Array with trimmed lines
     */
    public executeSync(rules: string[]): string[] {
        const transformed = rules.map((line) => StringUtils.trim(line, ' \t'));
        this.info('Lines trimmed.');
        return transformed;
    }
}
