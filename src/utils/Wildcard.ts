import { StringUtils } from './StringUtils.ts';

/**
 * Pattern matching class that supports:
 * 1. Plain string matching (substring search)
 * 2. Wildcard patterns with * (glob-style)
 * 3. Full regular expressions when wrapped in /regex/
 */
export class Wildcard {
    private readonly regex: RegExp | null = null;
    private readonly plainStr: string;

    /**
     * Creates a new Wildcard pattern matcher.
     * @param pattern - Pattern string (plain, wildcard with *, or /regex/)
     * @throws TypeError if pattern is empty
     */
    constructor(pattern: string) {
        if (!pattern) {
            throw new TypeError('Wildcard cannot be empty');
        }

        this.plainStr = pattern;

        // Check if it's a regex pattern
        if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
            const regexStr = pattern.substring(1, pattern.length - 1);
            this.regex = new RegExp(regexStr, 'mi');
        } else if (pattern.includes('*')) {
            // Convert wildcard pattern to regex
            const regexStr = pattern
                .split(/\*+/)
                .map(StringUtils.escapeRegExp)
                .join('[\\s\\S]*');
            this.regex = new RegExp(`^${regexStr}$`, 'i');
        }
    }

    /**
     * Tests if the pattern matches the given string.
     * @param str - String to test against the pattern
     * @returns true if the string matches the pattern
     * @throws TypeError if argument is not a string
     */
    public test(str: string): boolean {
        if (typeof str !== 'string') {
            throw new TypeError('Invalid argument passed to Wildcard.test');
        }

        if (this.regex !== null) {
            return this.regex.test(str);
        }

        return str.includes(this.plainStr);
    }

    /**
     * Returns the original pattern string.
     */
    public toString(): string {
        return this.plainStr;
    }

    /**
     * Gets the pattern string.
     */
    public get pattern(): string {
        return this.plainStr;
    }

    /**
     * Checks if this is a regex pattern.
     */
    public get isRegex(): boolean {
        return this.regex !== null && this.plainStr.startsWith('/');
    }

    /**
     * Checks if this is a wildcard pattern.
     */
    public get isWildcard(): boolean {
        return this.regex !== null && !this.plainStr.startsWith('/');
    }

    /**
     * Checks if this is a plain string pattern.
     */
    public get isPlain(): boolean {
        return this.regex === null;
    }
}
