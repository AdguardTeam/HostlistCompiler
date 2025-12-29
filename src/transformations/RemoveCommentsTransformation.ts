import { TransformationType } from '../types';
import { RuleUtils } from '../utils/index';
import { SyncTransformation } from './base/Transformation';

/**
 * Transformation that removes all comment lines from the rules.
 * Comments are lines starting with ! or #
 */
export class RemoveCommentsTransformation extends SyncTransformation {
    public readonly type = TransformationType.RemoveComments;
    public readonly name = 'RemoveComments';

    public executeSync(rules: string[]): string[] {
        const filtered = rules.filter((rule) => !RuleUtils.isComment(rule));
        this.info(`Removed ${rules.length - filtered.length} comments`);
        return filtered;
    }
}
