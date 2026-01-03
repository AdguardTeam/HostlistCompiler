import { ILogger, ISource, IConfiguration, TransformationType } from '../types/index.ts';
import { logger as defaultLogger, Wildcard, CompilerEventEmitter, createEventEmitter } from '../utils/index.ts';
import { Transformation } from './base/Transformation.ts';
import { RemoveCommentsTransformation } from './RemoveCommentsTransformation.ts';
import { TrimLinesTransformation } from './TrimLinesTransformation.ts';
import { RemoveEmptyLinesTransformation } from './RemoveEmptyLinesTransformation.ts';
import { InsertFinalNewLineTransformation } from './InsertFinalNewLineTransformation.ts';
import { ConvertToAsciiTransformation } from './ConvertToAsciiTransformation.ts';
import { InvertAllowTransformation } from './InvertAllowTransformation.ts';
import { RemoveModifiersTransformation } from './RemoveModifiersTransformation.ts';
import { DeduplicateTransformation } from './DeduplicateTransformation.ts';
import { ValidateTransformation, ValidateAllowIpTransformation } from './ValidateTransformation.ts';
import { CompressTransformation } from './CompressTransformation.ts';
import { FilterService } from '../services/FilterService.ts';

/**
 * Registry for transformation classes.
 * Implements the Registry pattern for managing transformation instances.
 */
export class TransformationRegistry {
    private readonly transformations: Map<TransformationType, Transformation>;
    private readonly logger: ILogger;

    constructor(logger?: ILogger) {
        this.logger = logger || defaultLogger;
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
    private readonly eventEmitter: CompilerEventEmitter;

    constructor(registry?: TransformationRegistry, logger?: ILogger, eventEmitter?: CompilerEventEmitter) {
        this.logger = logger || defaultLogger;
        this.registry = registry || new TransformationRegistry(this.logger);
        this.filterService = new FilterService(this.logger);
        this.eventEmitter = eventEmitter || createEventEmitter();
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
        const totalTransformations = orderedTransformations.length;

        for (let i = 0; i < orderedTransformations.length; i++) {
            const type = orderedTransformations[i];
            const transformation = this.registry.get(type);
            if (transformation) {
                const inputCount = transformed.length;
                const startTime = performance.now();

                // Emit transformation start event
                this.eventEmitter.emitTransformationStart({
                    name: type,
                    inputCount,
                });

                // Emit progress event
                this.eventEmitter.emitProgress({
                    phase: 'transformations',
                    current: i + 1,
                    total: totalTransformations,
                    message: `Applying transformation: ${type}`,
                });

                const result = await transformation.execute(transformed, {
                    configuration,
                    logger: this.logger,
                });
                // Convert readonly array back to mutable for next iteration
                transformed = Array.from(result);

                const durationMs = performance.now() - startTime;

                // Emit transformation complete event
                this.eventEmitter.emitTransformationComplete({
                    name: type,
                    inputCount,
                    outputCount: transformed.length,
                    durationMs,
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

        // Use Set for O(1) lookups instead of O(n) includes()
        const requestedSet = new Set(requested);
        return order.filter((type) => requestedSet.has(type));
    }

    /**
     * Applies exclusion patterns.
     * Optimized to partition patterns by type for faster matching.
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

        // Partition patterns by type for optimized matching
        // Plain string patterns can use fast includes() check
        const plainPatterns: string[] = [];
        const regexWildcards: Wildcard[] = [];

        for (const w of wildcards) {
            if (w.isPlain) {
                plainPatterns.push(w.pattern);
            } else {
                regexWildcards.push(w);
            }
        }

        const filtered = rules.filter((rule) => {
            // Fast path: check plain string patterns first (simple includes)
            for (const pattern of plainPatterns) {
                if (rule.includes(pattern)) {
                    this.logger.debug(`${rule} excluded by ${pattern}`);
                    return false;
                }
            }

            // Slow path: regex/wildcard patterns
            for (const w of regexWildcards) {
                if (w.test(rule)) {
                    this.logger.debug(`${rule} excluded by ${w.toString()}`);
                    return false;
                }
            }

            return true;
        });

        this.logger.info(`Excluded ${rules.length - filtered.length} rules. ${filtered.length} rules left.`);
        return filtered;
    }

    /**
     * Applies inclusion patterns.
     * Optimized to partition patterns by type for faster matching.
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

        // Partition patterns by type for optimized matching
        const plainPatterns: string[] = [];
        const regexWildcards: Wildcard[] = [];

        for (const w of wildcards) {
            if (w.isPlain) {
                plainPatterns.push(w.pattern);
            } else {
                regexWildcards.push(w);
            }
        }

        const filtered = rules.filter((rule) => {
            // Fast path: check plain string patterns first
            for (const pattern of plainPatterns) {
                if (rule.includes(pattern)) {
                    return true;
                }
            }

            // Slow path: regex/wildcard patterns
            for (const w of regexWildcards) {
                if (w.test(rule)) {
                    return true;
                }
            }

            this.logger.debug(`${rule} does not match inclusions list`);
            return false;
        });

        this.logger.info(`Included ${filtered.length} rules`);
        return filtered;
    }
}
