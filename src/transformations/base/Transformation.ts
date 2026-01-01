import { ILogger, ITransformationContext, TransformationType } from '../../types/index.ts';
import { logger as defaultLogger } from '../../utils/logger.ts';

/**
 * Abstract base class for all transformations.
 * Implements the Strategy pattern for rule transformations.
 */
export abstract class Transformation {
    protected readonly logger: ILogger;

    /** The transformation type identifier */
    public abstract readonly type: TransformationType;

    /** Human-readable name for logging */
    public abstract readonly name: string;

    constructor(logger?: ILogger) {
        this.logger = logger || defaultLogger;
    }

    /**
     * Executes the transformation on the given rules.
     * @param rules - Array of rules to transform
     * @param context - Optional transformation context
     * @returns Promise resolving to transformed rules
     */
    public abstract execute(rules: string[], context?: ITransformationContext): Promise<string[]>;

    /**
     * Log an info message
     */
    protected info(message: string): void {
        this.logger.info(message);
    }

    /**
     * Log a debug message
     */
    protected debug(message: string): void {
        this.logger.debug(message);
    }

    /**
     * Log an error message
     */
    protected error(message: string): void {
        this.logger.error(message);
    }
}

/**
 * Abstract base class for synchronous transformations.
 * Most transformations are synchronous and don't need async operations.
 */
export abstract class SyncTransformation extends Transformation {
    /**
     * Synchronously executes the transformation on the given rules.
     * @param rules - Array of rules to transform
     * @param context - Optional transformation context
     * @returns Transformed rules
     */
    public abstract executeSync(rules: string[], context?: ITransformationContext): string[];

    /**
     * Wraps the sync execution in a Promise for interface compatibility.
     */
    public execute(rules: string[], context?: ITransformationContext): Promise<string[]> {
        return Promise.resolve(this.executeSync(rules, context));
    }
}

/**
 * Abstract base class for async transformations.
 * Use this for transformations that need to fetch external resources.
 */
export abstract class AsyncTransformation extends Transformation {
    /**
     * Asynchronously executes the transformation on the given rules.
     * @param rules - Array of rules to transform
     * @param context - Optional transformation context
     * @returns Promise resolving to transformed rules
     */
    public abstract override execute(rules: string[], context?: ITransformationContext): Promise<string[]>;
}
