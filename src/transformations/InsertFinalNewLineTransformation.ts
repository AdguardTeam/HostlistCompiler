import { TransformationType } from '../types';
import { SyncTransformation } from './base/Transformation';

/**
 * Transformation that ensures the file ends with a newline.
 */
export class InsertFinalNewLineTransformation extends SyncTransformation {
    public readonly type = TransformationType.InsertFinalNewLine;
    public readonly name = 'InsertFinalNewLine';

    public executeSync(rules: string[]): string[] {
        const result = [...rules];

        if (result.length === 0 || (result.length > 0 && result[result.length - 1].trim() !== '')) {
            result.push('');
            this.info('Final newline inserted');
        }

        return result;
    }
}
