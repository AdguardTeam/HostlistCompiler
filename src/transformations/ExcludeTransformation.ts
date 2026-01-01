import { ILogger, ITransformationContext, TransformationType } from '../types/index.ts';
import { Wildcard } from '../utils/index.ts';
import { FilterService } from '../services/FilterService.ts';
import { AsyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that excludes rules matching specified patterns.
 */
export class ExcludeTransformation extends AsyncTransformation {
    public readonly type = TransformationType.Deduplicate; // Not used directly
    public readonly name = 'Exclude';

    private readonly filterService: FilterService;

    constructor(logger?: ILogger) {
        super(logger);
        this.filterService = new FilterService(this.logger);
    }

    public async execute(rules: string[], context?: ITransformationContext): Promise<string[]> {
        const exclusions = context?.configuration?.exclusions;
        const exclusionsSources = context?.configuration?.exclusions_sources;

        if ((!exclusions || exclusions.length === 0)
            && (!exclusionsSources || exclusionsSources.length === 0)) {
            return rules;
        }

        const wildcards = await this.filterService.prepareWildcards(exclusions, exclusionsSources);

        if (wildcards.length === 0) {
            return rules;
        }

        this.info(`Filtering the list of rules using ${wildcards.length} exclusion rules`);

        const filtered = rules.filter((rule) => {
            const excluded = wildcards.some((w) => {
                const found = w.test(rule);
                if (found) {
                    this.debug(`${rule} excluded by ${w.toString()}`);
                }
                return found;
            });
            return !excluded;
        });

        this.info(`Excluded ${rules.length - filtered.length} rules. ${filtered.length} rules left.`);
        return filtered;
    }

    /**
     * Static method for direct exclusion with pre-prepared wildcards.
     */
    public static excludeWithWildcards(rules: string[], wildcards: Wildcard[]): string[] {
        if (wildcards.length === 0) {
            return rules;
        }

        return rules.filter((rule) => {
            return !wildcards.some((w) => w.test(rule));
        });
    }
}
