import { TransformationType } from '../types/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that ensures the file ends with a newline.
 */
export class InsertFinalNewLineTransformation extends SyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.InsertFinalNewLine;
    /** Human-readable name of the transformation */
    public readonly name = 'InsertFinalNewLine';

    /**
     * Ensures the file ends with a newline.
     * @param rules - Array of rules to process
     * @returns Array with final newline
     */
    public executeSync(rules: string[]): string[] {
        const result = [...rules];

        if (result.length === 0 || (result.length > 0 && result[result.length - 1].trim() !== '')) {
            result.push('');
            this.info('Final newline inserted');
        }

        return result;
    }
}
