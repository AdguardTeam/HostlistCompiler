import consola from 'consola';
import { ILogger, ISource, IConfiguration, TransformationType } from '../types';
import { Transformation } from './base/Transformation';
import { RemoveCommentsTransformation } from './RemoveCommentsTransformation';
import { TrimLinesTransformation } from './TrimLinesTransformation';
import { RemoveEmptyLinesTransformation } from './RemoveEmptyLinesTransformation';
import { InsertFinalNewLineTransformation } from './InsertFinalNewLineTransformation';
import { ConvertToAsciiTransformation } from './ConvertToAsciiTransformation';
import { InvertAllowTransformation } from './InvertAllowTransformation';
import { RemoveModifiersTransformation } from './RemoveModifiersTransformation';
import { DeduplicateTransformation } from './DeduplicateTransformation';
import { ValidateTransformation, ValidateAllowIpTransformation } from './ValidateTransformation';
import { CompressTransformation } from './CompressTransformation';
import { FilterService } from '../services/FilterService';

/**
 * Registry for transformation classes.
 * Implements the Registry pattern for managing transformation instances.
 */
export class TransformationRegistry {
    private readonly transformations: Map<TransformationType, Transformation>;
    private readonly logger: ILogger;

    constructor(logger?: ILogger) {
        this.logger = logger || consola;
        this.transformations = new Map();
        this.registerDefaultTransformations();
    }

    /**
     * Registers the default transformations.
     */
    private registerDefaultTransformations(): void {
        this.register(TransformationType.RemoveComments, new RemoveCommentsTransformation(this.logger));
        this.register(TransformationType.TrimLines, new TrimLinesTransformation(this.logger));
        this.register(TransformationType.RemoveEmptyLines, new RemoveEmptyLinesTransformation(this.logger));
        this.register(TransformationType.InsertFinalNewLine, new InsertFinalNewLineTransformation(this.logger));
        this.register(TransformationType.ConvertToAscii, new ConvertToAsciiTransformation(this.logger));
        this.register(TransformationType.InvertAllow, new InvertAllowTransformation(this.logger));
        this.register(TransformationType.RemoveModifiers, new RemoveModifiersTransformation(this.logger));
        this.register(TransformationType.Deduplicate, new DeduplicateTransformation(this.logger));
        this.register(TransformationType.Validate, new ValidateTransformation(false, this.logger));
        this.register(TransformationType.ValidateAllowIp, new ValidateAllowIpTransformation(this.logger));
        this.register(TransformationType.Compress, new CompressTransformation(this.logger));
    }

    /**
     * Registers a transformation.
     */
    public register(type: TransformationType, transformation: Transformation): void {
        this.transformations.set(type, transformation);
    }

    /**
     * Gets a transformation by type.
     */
    public get(type: TransformationType): Transformation | undefined {
        return this.transformations.get(type);
    }

    /**
     * Checks if a transformation is registered.
     */
    public has(type: TransformationType): boolean {
        return this.transformations.has(type);
    }

    /**
     * Gets all registered transformation types.
     */
    public getRegisteredTypes(): TransformationType[] {
        return Array.from(this.transformations.keys());
    }
}

/**
 * Pipeline for executing transformations in order.
 */
export class TransformationPipeline {
    private readonly registry: TransformationRegistry;
    private readonly logger: ILogger;
    private readonly filterService: FilterService;

    constructor(registry?: TransformationRegistry, logger?: ILogger) {
        this.logger = logger || consola;
        this.registry = registry || new TransformationRegistry(this.logger);
        this.filterService = new FilterService(this.logger);
    }

    /**
     * Transforms rules using the specified transformations.
     */
    public async transform(
        rules: string[],
        configuration: IConfiguration | ISource,
        transformations?: TransformationType[],
    ): Promise<string[]> {
        const transformationList = transformations || [];
        let transformed = rules;

        // Apply exclusions first
        transformed = await this.applyExclusions(transformed, configuration);

        // Apply inclusions
        transformed = await this.applyInclusions(transformed, configuration);

        // Apply transformations in order
        const orderedTransformations = this.getOrderedTransformations(transformationList);

        for (const type of orderedTransformations) {
            const transformation = this.registry.get(type);
            if (transformation) {
                transformed = await transformation.execute(transformed, {
                    configuration,
                    logger: this.logger,
                });
            }
        }

        return transformed;
    }

    /**
     * Gets transformations in the correct execution order.
     */
    private getOrderedTransformations(requested: TransformationType[]): TransformationType[] {
        // Define the execution order
        const order: TransformationType[] = [
            TransformationType.ConvertToAscii,
            TransformationType.TrimLines,
            TransformationType.RemoveComments,
            TransformationType.Compress,
            TransformationType.RemoveModifiers,
            TransformationType.InvertAllow,
            TransformationType.Validate,
            TransformationType.ValidateAllowIp,
            TransformationType.Deduplicate,
            TransformationType.RemoveEmptyLines,
            TransformationType.InsertFinalNewLine,
        ];

        // Filter to only requested transformations, maintaining order
        return order.filter((type) => requested.includes(type));
    }

    /**
     * Applies exclusion patterns.
     */
    private async applyExclusions(
        rules: string[],
        configuration: IConfiguration | ISource,
    ): Promise<string[]> {
        const exclusions = configuration.exclusions;
        const exclusionsSources = configuration.exclusions_sources;

        if ((!exclusions || exclusions.length === 0)
            && (!exclusionsSources || exclusionsSources.length === 0)) {
            return rules;
        }

        const wildcards = await this.filterService.prepareWildcards(exclusions, exclusionsSources);

        if (wildcards.length === 0) {
            return rules;
        }

        this.logger.info(`Filtering the list of rules using ${wildcards.length} exclusion rules`);

        const filtered = rules.filter((rule) => {
            const excluded = wildcards.some((w) => {
                const found = w.test(rule);
                if (found) {
                    this.logger.debug(`${rule} excluded by ${w.toString()}`);
                }
                return found;
            });
            return !excluded;
        });

        this.logger.info(`Excluded ${rules.length - filtered.length} rules. ${filtered.length} rules left.`);
        return filtered;
    }

    /**
     * Applies inclusion patterns.
     */
    private async applyInclusions(
        rules: string[],
        configuration: IConfiguration | ISource,
    ): Promise<string[]> {
        const inclusions = configuration.inclusions;
        const inclusionsSources = configuration.inclusions_sources;

        if ((!inclusions || inclusions.length === 0)
            && (!inclusionsSources || inclusionsSources.length === 0)) {
            return rules;
        }

        const wildcards = await this.filterService.prepareWildcards(inclusions, inclusionsSources);

        if (wildcards.length === 0) {
            return rules;
        }

        this.logger.info(`Filtering the list of rules using ${wildcards.length} inclusion rules`);

        const filtered = rules.filter((rule) => {
            const included = wildcards.some((w) => w.test(rule));
            if (!included) {
                this.logger.debug(`${rule} does not match inclusions list`);
            }
            return included;
        });

        this.logger.info(`Included ${filtered.length} rules`);
        return filtered;
    }
}
