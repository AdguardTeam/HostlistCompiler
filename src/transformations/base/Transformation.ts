import { ILogger, ITransformationContext, TransformationType } from '../../types/index.ts';
import { logger as defaultLogger } from '../../utils/logger.ts';

/**
 * Abstract base class for all transformations.
 * Implements the Strategy pattern for rule transformations.
 * All transformations are fully asynchronous to support streaming and non-blocking operations.
 */
export abstract class Transformation {
    /** Logger instance for output */
    protected readonly logger: ILogger;

    /** The transformation type identifier */
    public abstract readonly type: TransformationType;

    /** Human-readable name for logging */
    public abstract readonly name: string;

    /**
     * Creates a new transformation
     * @param logger - Logger instance for output
     */
    constructor(logger?: ILogger) {
        this.logger = logger ?? defaultLogger;
    }

    /**
     * Executes the transformation on the given rules.
     *
     * @param rules - Array of rules to transform
     * @param context - Optional transformation context
     * @returns Promise resolving to transformed rules
     *
     * @remarks
     * All transformations are async to support:
     * - Non-blocking operations
     * - Streaming large datasets
     * - External resource fetching
     * - Parallel processing
     */
    public abstract execute(
        rules: readonly string[],
        context?: ITransformationContext,
    ): Promise<readonly string[]>;

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
 * These transformations perform CPU-bound operations without I/O.
 * The sync method is wrapped in a resolved Promise for consistency with async operations.
 *
 * @remarks
 * Use this for transformations that:
 * - Don't perform I/O operations
 * - Process data purely in-memory
 * - Can complete synchronously
 */
export abstract class SyncTransformation extends Transformation {
    /**
     * Synchronously executes the transformation on the given rules.
     *
     * @param rules - Array of rules to transform
     * @param context - Optional transformation context
     * @returns Transformed rules
     */
    public abstract executeSync(
        rules: readonly string[],
        context?: ITransformationContext,
    ): readonly string[];

    /**
     * Wraps the sync execution in a resolved Promise for interface compatibility.
     */
    public override execute(
        rules: readonly string[],
        context?: ITransformationContext,
    ): Promise<readonly string[]> {
        return Promise.resolve(this.executeSync(rules, context));
    }
}

/**
 * Abstract base class for async transformations.
 * Use this for transformations that need to fetch external resources or perform I/O.
 *
 * @remarks
 * Use this for transformations that:
 * - Fetch external resources (HTTP, file system)
 * - Perform database queries
 * - Use async APIs
 * - Require explicit async/await
 */
export abstract class AsyncTransformation extends Transformation {
    /**
     * Asynchronously executes the transformation on the given rules.
     *
     * @param rules - Array of rules to transform
     * @param context - Optional transformation context
     * @returns Promise resolving to transformed rules
     */
    public abstract override execute(
        rules: readonly string[],
        context?: ITransformationContext,
    ): Promise<readonly string[]>;
}
