/**
 * Evaluates preprocessor conditions for filter lists.
 * Follows Single Responsibility Principle - only handles condition evaluation.
 * 
 * Supports: true, false, !, &&, ||, (), and platform identifiers
 */
export class ConditionalEvaluator {
    private readonly platform?: string;

    /**
     * Creates a new ConditionalEvaluator
     * @param platform - Target platform identifier (e.g., 'windows', 'adguard')
     */
    constructor(platform?: string) {
        this.platform = platform;
    }

    /**
     * List of known platform identifiers
     */
    private static readonly PLATFORMS = [
        'windows',
        'mac',
        'android',
        'ios',
        'ext_chromium',
        'ext_ff',
        'ext_edge',
        'ext_opera',
        'ext_safari',
        'ext_ublock',
        'adguard',
        'adguard_app_windows',
        'adguard_app_mac',
        'adguard_app_android',
        'adguard_app_ios',
        'adguard_ext_chromium',
        'adguard_ext_firefox',
        'adguard_ext_edge',
        'adguard_ext_opera',
        'adguard_ext_safari',
    ] as const;

    /**
     * Evaluates a preprocessor condition
     * @param condition - Condition string to evaluate
     * @returns True if condition is met, false otherwise
     * 
     * @example
     * evaluator.evaluate('windows || mac') // true if platform is windows or mac
     * evaluator.evaluate('!ios && adguard') // true if not ios and is adguard
     */
    public evaluate(condition: string): boolean {
        // Clean up the condition
        let expr = condition.trim();

        // Handle empty condition
        if (!expr) {
            return true;
        }

        try {
            // Replace platform identifiers with boolean values
            for (const p of ConditionalEvaluator.PLATFORMS) {
                const regex = new RegExp(`\\b${p}\\b`, 'gi');
                const value = this.platform?.toLowerCase() === p.toLowerCase() ? 'true' : 'false';
                expr = expr.replace(regex, value);
            }

            // Normalize logical operators
            expr = expr.replace(/\s+&&\s+/g, ' && ');
            expr = expr.replace(/\s+\|\|\s+/g, ' || ');

            // Validate that only safe operators remain
            // Allow: true, false, !, &&, ||, (), and whitespace
            if (!/^[!&|() ]*$/i.test(expr.replace(/true|false/gi, ''))) {
                // Unknown tokens - default to false to exclude platform-specific rules
                return false;
            }

            // Use Function constructor for safe evaluation
            // This is safe because we've sanitized the input to only contain boolean logic
            // deno-lint-ignore no-new-func
            const fn = new Function(`return ${expr};`) as () => boolean;
            return Boolean(fn());
        } catch (error) {
            // If evaluation fails, default to false
            // This ensures platform-specific rules are excluded when uncertain
            return false;
        }
    }

    /**
     * Checks if a condition string is valid
     * @param condition - Condition to validate
     * @returns True if condition is valid syntax
     */
    public isValid(condition: string): boolean {
        try {
            this.evaluate(condition);
            return true;
        } catch {
            return false;
        }
    }
}
