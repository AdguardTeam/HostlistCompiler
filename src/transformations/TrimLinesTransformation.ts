import { TransformationType } from '../types/index.ts';
import { StringUtils } from '../utils/index.ts';
import { SyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that removes leading and trailing whitespace from lines.
 */
export class TrimLinesTransformation extends SyncTransformation {
    public readonly type = TransformationType.TrimLines;
    public readonly name = 'TrimLines';

    public executeSync(rules: string[]): string[] {
        const transformed = rules.map((line) => StringUtils.trim(line, ' \t'));
        this.info('Lines trimmed.');
        return transformed;
    }
}
