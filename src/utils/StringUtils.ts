/**
 * Utility functions for string manipulation operations.
 * These are pure functions following a functional programming approach.
 */

/**
 * Extracts a substring between two tags.
 *
 * @param str - Original string
 * @param startTag - Start tag to search for
 * @param endTag - End tag to search for
 * @returns The substring between tags, or null if not found
 *
 * @example
 * ```ts
 * substringBetween("<div>content</div>", "<div>", "</div>") // "content"
 * substringBetween("no tags", "<", ">") // null
 * ```
 */
export function substringBetween(
    str: string | null | undefined,
    startTag: string,
    endTag: string,
): string | null {
    if (!str) return null;

    const start = str.indexOf(startTag);
    if (start === -1) return null;

    const contentStart = start + startTag.length;
    const end = str.indexOf(endTag, contentStart);

    return (end > contentStart) ? str.substring(contentStart, end) : null;
}

/**
 * Splits a string by delimiter, respecting escape characters.
 *
 * @param str - String to split
 * @param delimiter - Delimiter character
 * @param escapeCharacter - Escape character
 * @param preserveAllTokens - If true, preserve empty parts
 * @returns Array of string parts
 *
 * @example
 * ```ts
 * splitByDelimiterWithEscapeCharacter("a,b\\,c,d", ",", "\\", false) // ["a", "b,c", "d"]
 * ```
 */
export function splitByDelimiterWithEscapeCharacter(
    str: string | null | undefined,
    delimiter: string,
    escapeCharacter: string,
    preserveAllTokens: boolean,
): readonly string[] {
    if (!str) return [];

    const parts: string[] = [];
    let buffer = '';
    let i = 0;

    while (i < str.length) {
        const char = str[i];

        if (char === delimiter) {
            if (i === 0) {
                // Ignore leading delimiter
            } else if (str[i - 1] === escapeCharacter) {
                // Remove escape char and add delimiter
                buffer = buffer.slice(0, -1) + char;
            } else if (preserveAllTokens || buffer.length > 0) {
                parts.push(buffer);
                buffer = '';
            }
        } else {
            buffer += char;
        }
        i++;
    }

    if (preserveAllTokens || buffer.length > 0) {
        parts.push(buffer);
    }

    return parts;
}

/**
 * Escapes special regex characters in a string.
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 *
 * @example
 * ```ts
 * escapeRegExp("example.com") // "example\\.com"
 * escapeRegExp("*") // "\\*"
 * ```
 */
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if a string is empty or contains only whitespace.
 *
 * @param str - String to check
 * @returns true if string is null, undefined, empty, or whitespace only
 *
 * @example
 * ```ts
 * isEmpty("") // true
 * isEmpty("  ") // true
 * isEmpty("text") // false
 * isEmpty(null) // true
 * ```
 */
export function isEmpty(str: string | null | undefined): str is null | undefined | '' {
    return !str || str.trim().length === 0;
}

/**
 * Trims specified characters from both ends of a string.
 *
 * @param str - String to trim
 * @param chars - Characters to remove (default: space and tab)
 * @returns Trimmed string
 *
 * @example
 * ```ts
 * trim("  text  ") // "text"
 * trim("##text##", "#") // "text"
 * ```
 */
export function trim(str: string, chars: string = ' \t'): string {
    const escapedChars = escapeRegExp(chars);
    const regex = new RegExp(`^[${escapedChars}]+|[${escapedChars}]+$`, 'g');
    return str.replace(regex, '');
}

/**
 * Legacy class-based API for backward compatibility.
 * @deprecated Use the functional exports instead.
 */
export class StringUtils {
    /**
     * Extracts a substring between two tags.
     * @deprecated Use {@link substringBetween} function instead
     */
    public static substringBetween: typeof substringBetween = substringBetween;

    /**
     * Splits a string by delimiter, respecting escape characters.
     * @deprecated Use {@link splitByDelimiterWithEscapeCharacter} function instead
     */
    public static splitByDelimiterWithEscapeCharacter: typeof splitByDelimiterWithEscapeCharacter = splitByDelimiterWithEscapeCharacter;

    /**
     * Escapes special regex characters in a string.
     * @deprecated Use {@link escapeRegExp} function instead
     */
    public static escapeRegExp: typeof escapeRegExp = escapeRegExp;

    /**
     * Checks if a string is empty or contains only whitespace.
     * @deprecated Use {@link isEmpty} function instead
     */
    public static isEmpty: typeof isEmpty = isEmpty;

    /**
     * Trims specified characters from both ends of a string.
     * @deprecated Use {@link trim} function instead
     */
    public static trim: typeof trim = trim;
}
