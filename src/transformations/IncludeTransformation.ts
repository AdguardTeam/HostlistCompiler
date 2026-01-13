import { ILogger, ITransformationContext, TransformationType } from '../types/index.ts';
import { Wildcard } from '../utils/index.ts';
import { FilterService } from '../services/FilterService.ts';
import { AsyncTransformation } from './base/Transformation.ts';

/**
 * Transformation that includes only rules matching specified patterns.
 */
export class IncludeTransformation extends AsyncTransformation {
    public readonly type = TransformationType.Deduplicate; // Not used directly
    public readonly name = 'Include';

    private readonly filterService: FilterService;

    constructor(logger?: ILogger) {
        super(logger);
        this.filterService = new FilterService(this.logger);
    }

    public async execute(rules: string[], context?: ITransformationContext): Promise<string[]> {
        const inclusions = context?.configuration?.inclusions;
        const inclusionsSources = context?.configuration?.inclusions_sources;

        if (
            (!inclusions || inclusions.length === 0) &&
            (!inclusionsSources || inclusionsSources.length === 0)
        ) {
            return rules;
        }

        const wildcards = await this.filterService.prepareWildcards(inclusions, inclusionsSources);

        if (wildcards.length === 0) {
            return rules;
        }

        this.info(`Filtering the list of rules using ${wildcards.length} inclusion rules`);

        const filtered = rules.filter((rule) => {
            const included = wildcards.some((w) => w.test(rule));
            if (!included) {
                this.debug(`${rule} does not match inclusions list`);
            }
            return included;
        });

        this.info(`Included ${filtered.length} rules`);
        return filtered;
    }

    /**
     * Static method for direct inclusion with pre-prepared wildcards.
     */
    public static includeWithWildcards(rules: string[], wildcards: Wildcard[]): string[] {
        if (wildcards.length === 0) {
            return [];
        }

        return rules.filter((rule) => {
            return wildcards.some((w) => w.test(rule));
        });
    }
}
