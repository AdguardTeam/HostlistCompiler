import { ILogger, ITransformationContext, TransformationType } from '../types/index.ts';
import { Wildcard } from '../utils/index.ts';
import { FilterService } from '../services/FilterService.ts';
import { AsyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that excludes rules matching specified patterns.
 */
export class ExcludeTransformation extends AsyncTransformation {
    /** The transformation type identifier */
    public readonly type: TransformationType = TransformationType.Deduplicate; // Not used directly
    /** Human-readable name of the transformation */
    public readonly name = 'Exclude';

    private readonly filterService: FilterService;

    /**
     * Creates a new ExcludeTransformation
     * @param logger - Logger instance for output
     */
    constructor(logger?: ILogger) {
        super(logger);
        this.filterService = new FilterService(this.logger);
    }

    /**
     * Excludes rules matching specified patterns.
     * @param rules - Array of rules to process
     * @param context - Transformation context with exclusions
     * @returns Array with excluded rules removed
     */
    public async execute(rules: string[], context?: ITransformationContext): Promise<string[]> {
        const exclusions = context?.configuration?.exclusions;
        const exclusionsSources = context?.configuration?.exclusions_sources;

        if (
            (!exclusions || exclusions.length === 0) &&
            (!exclusionsSources || exclusionsSources.length === 0)
        ) {
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
